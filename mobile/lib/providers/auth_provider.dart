import 'package:flutter/foundation.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../config/app_config.dart';
import '../config/deep_links.dart';
import '../models/account.dart';
import '../services/secure_storage_service.dart' show StoredAccount;
import 'app_providers.dart';
import 'threads_provider.dart';

/// Authentication / pairing state. On boot we read the secure store; if a
/// config exists we apply it to the API service and start the sync loop.
class AuthState {
  const AuthState({
    this.config,
    this.loading = true,
    this.bootstrapped = false,
    this.error,
    this.managedAccounts = const [],
  });

  final AppConfig? config;
  final bool loading;
  /// True once the initial secure-store read has finished. Distinguishes the
  /// first-boot splash from a connect attempt (so the Connect screen stays
  /// mounted and its inputs aren't cleared during a sign-in attempt).
  final bool bootstrapped;
  final String? error;
  /// Every account stored on this device (no passwords). The active account
  /// is the one whose [config] is currently applied.
  final List<Account> managedAccounts;

  bool get isConfigured => config?.isConfigured ?? false;

  AuthState copyWith({
    AppConfig? config,
    bool? loading,
    bool? bootstrapped,
    String? error,
    List<Account>? managedAccounts,
  }) =>
      AuthState(
        config: config ?? this.config,
        loading: loading ?? this.loading,
        bootstrapped: bootstrapped ?? this.bootstrapped,
        error: error ?? this.error,
        managedAccounts: managedAccounts ?? this.managedAccounts,
      );
}

class AuthNotifier extends StateNotifier<AuthState> {
  AuthNotifier(this._ref) : super(const AuthState()) {
    _bootstrap();
  }

  final Ref _ref;

  Future<void> _bootstrap() async {
    try {
      final secure = _ref.read(secureStorageProvider);
      final stored = await secure.loadAccounts();
      if (stored.isNotEmpty) {
        final active = stored.firstWhere(
          (a) => a.isActive,
          orElse: () => stored.first,
        );
        final config = AppConfig(
          workerUrl: active.workerUrl,
          accountEmail: active.email,
          mobilePassword: active.password,
        );
        await _apply(config);
        await _switchStorageAccount(config.normalizedAccountEmail);
        state = state.copyWith(
          config: config,
          loading: false,
          bootstrapped: true,
          managedAccounts: _toAccounts(stored),
        );
      } else {
        state = state.copyWith(loading: false, bootstrapped: true);
      }
    } catch (e) {
      state = state.copyWith(
        loading: false,
        bootstrapped: true,
        error: e.toString(),
      );
    }
  }

  /// Validate account email + password against the Worker and persist on
  /// success. The Worker URL is NOT entered by the user — it is baked into
  /// the build via [AppConfig.defaultWorkerUrl]. An optional QR scan can
  /// override it, but no pairing is required to sign in.
  ///
  /// On success the verified account is added to the managed list (or its
  /// password updated if it already existed) and made the active account.
  Future<bool> connect({
    required String accountEmail,
    required String password,
    String? workerUrl,
  }) async {
    debugPrint('auth.connect: start email=$accountEmail');
    state = state.copyWith(loading: true, error: null);
    final resolvedWorkerUrl =
        (workerUrl != null && workerUrl.isNotEmpty)
            ? workerUrl
            : AppConfig.defaultWorkerUrl;
    final candidate = AppConfig(
      workerUrl: resolvedWorkerUrl,
      accountEmail: accountEmail,
      mobilePassword: password,
    );
    final api = _ref.read(mobileApiProvider);
    api.configure(candidate);
    try {
      debugPrint('auth.connect: pingConfig ${candidate.normalizedWorkerUrl}');
      await api.pingConfig();
      debugPrint('auth.connect: ping ok, saving');
      await _addAndActivate(
        email: candidate.normalizedAccountEmail,
        password: password,
        workerUrl: candidate.normalizedWorkerUrl,
      );
      await _apply(candidate);
      await _switchStorageAccount(candidate.normalizedAccountEmail);
      state = state.copyWith(config: candidate, loading: false);
      debugPrint('auth.connect: success');
      return true;
    } catch (e) {
      debugPrint('auth.connect: error: $e');
      state = state.copyWith(loading: false, error: e.toString());
      return false;
    }
  }

  /// Convenience for QR pairing: parse the deep link then connect. The QR
  /// encodes the Worker URL + account email + password, so this works for a
  /// fresh install (no prior Worker URL stored).
  Future<bool> connectFromDeepLink(String uri) async {
    final params = ConnectDeepLink.parse(uri);
    if (params == null) {
      state = state.copyWith(error: 'Invalid pairing link');
      return false;
    }
    return connect(
      accountEmail: params.email,
      password: params.password,
      workerUrl: params.workerUrl,
    );
  }

  /// Make [email] the active account. No-op if it is not stored. Re-applies
  /// the stored config, resets the thread cache, and restarts sync so the
  /// inbox reflects the new account.
  Future<void> switchAccount(String email) async {
    final normalized = email.trim().toLowerCase();
    if (normalized.isEmpty) return;
    final secure = _ref.read(secureStorageProvider);
    final stored = await secure.loadAccounts();
    final match = stored.where((a) => a.normalizedEmail == normalized).toList();
    if (match.isEmpty) return;
    final updated = stored.map((a) {
      final isActive = a.normalizedEmail == normalized;
      return isActive ? a.copyWith(isActive: true) : a.copyWith(isActive: false);
    }).toList();
    await secure.saveAccounts(updated);
    final active = match.first;
    final config = AppConfig(
      workerUrl: active.workerUrl,
      accountEmail: active.email,
      mobilePassword: active.password,
    );
    await _apply(config);
    await _switchStorageAccount(normalized);
    _ref.read(threadsProvider.notifier).reset();
    state = state.copyWith(
      config: config,
      managedAccounts: _toAccounts(updated),
      error: null,
    );
    // Kick off a fresh load for the newly active account.
    _ref.read(threadsProvider.notifier).load();
  }

  /// Remove [email] from the managed list. If it was the active account, the
  /// next remaining account is activated. When no accounts remain, the user
  /// is signed out (secure storage + cache cleared, returns to Connect).
  Future<void> removeAccount(String email) async {
    final normalized = email.trim().toLowerCase();
    if (normalized.isEmpty) return;
    final secure = _ref.read(secureStorageProvider);
    final stored = await secure.loadAccounts();
    final remaining = stored.where((a) => a.normalizedEmail != normalized).toList();
    if (remaining.isEmpty) {
      await signOut();
      return;
    }
    final removedWasActive =
        stored.firstWhere((a) => a.normalizedEmail == normalized, orElse: () => stored.first).isActive;
    if (removedWasActive && remaining.where((a) => a.isActive).isEmpty) {
      remaining[0] = remaining.first.copyWith(isActive: true);
    }
    await secure.saveAccounts(remaining);
    if (removedWasActive) {
      final next = remaining.firstWhere((a) => a.isActive, orElse: () => remaining.first);
      final config = AppConfig(
        workerUrl: next.workerUrl,
        accountEmail: next.email,
        mobilePassword: next.password,
      );
      await _apply(config);
      await _switchStorageAccount(next.normalizedEmail);
      _ref.read(threadsProvider.notifier).reset();
      state = state.copyWith(
        config: config,
        managedAccounts: _toAccounts(remaining),
        error: null,
      );
      _ref.read(threadsProvider.notifier).load();
    } else {
      state = state.copyWith(managedAccounts: _toAccounts(remaining));
    }
  }

  /// Sign out of every account: clear secure storage, wipe the offline cache,
  /// and reset providers so a re-login starts fresh.
  Future<void> signOut() async {
    await _ref.read(secureStorageProvider).clear();
    final storage = await _ref.read(storageServiceProvider.future);
    await storage.clearAll();
    _ref.read(threadsProvider.notifier).reset();
    _ref.read(mobileApiProvider).configure(
      const AppConfig(workerUrl: '', accountEmail: '', mobilePassword: ''),
    );
    _ref.read(syncServiceProvider).stop();
    state = const AuthState(loading: false, bootstrapped: true);
  }

  Future<void> _addAndActivate({
    required String email,
    required String password,
    required String workerUrl,
  }) async {
    final secure = _ref.read(secureStorageProvider);
    final stored = await secure.loadAccounts();
    final existingIndex = stored.indexWhere((a) => a.normalizedEmail == email);
    final updated = stored.map((a) => a.copyWith(isActive: false)).toList();
    final record = StoredAccount(
      email: email,
      password: password,
      workerUrl: workerUrl,
      isActive: true,
      updatedAt: DateTime.now(),
    );
    if (existingIndex >= 0) {
      updated[existingIndex] = record.copyWith(
        displayName: stored[existingIndex].displayName,
        domain: stored[existingIndex].domain,
      );
    } else {
      updated.add(record);
    }
    await secure.saveAccounts(updated);
    state = state.copyWith(managedAccounts: _toAccounts(updated));
  }

  Future<void> _switchStorageAccount(String email) async {
    try {
      final storage = await _ref.read(storageServiceProvider.future);
      await storage.setActiveAccount(email);
    } catch (e) {
      debugPrint('auth: setActiveAccount failed: $e');
    }
  }

  List<Account> _toAccounts(List<StoredAccount> stored) {
    return stored
        .map((a) => Account(
              email: a.email,
              domain: a.domain ?? '',
              displayName: a.displayName,
              mobileEnabled: a.mobileEnabled,
              inboundEnabled: a.inboundEnabled,
            ))
        .toList(growable: false);
  }

  Future<void> _apply(AppConfig config) async {
    _ref.read(appConfigProvider.notifier).state = config;
    _ref.read(mobileApiProvider).configure(config);
    _ref.read(syncServiceProvider).start();
  }
}

final authProvider = StateNotifierProvider<AuthNotifier, AuthState>((ref) {
  return AuthNotifier(ref);
});
