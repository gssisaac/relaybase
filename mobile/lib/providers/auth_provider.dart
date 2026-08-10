import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../config/app_config.dart';
import '../config/deep_links.dart';
import 'app_providers.dart';

/// Authentication / pairing state. On boot we read the secure store; if a
/// config exists we apply it to the API service and start the sync loop.
class AuthState {
  const AuthState({
    this.config,
    this.loading = true,
    this.bootstrapped = false,
    this.error,
  });

  final AppConfig? config;
  final bool loading;
  /// True once the initial secure-store read has finished. Distinguishes the
  /// first-boot splash from a connect attempt (so the Connect screen stays
  /// mounted and its inputs aren't cleared during a sign-in attempt).
  final bool bootstrapped;
  final String? error;

  bool get isConfigured => config?.isConfigured ?? false;

  AuthState copyWith({
    AppConfig? config,
    bool? loading,
    bool? bootstrapped,
    String? error,
  }) =>
      AuthState(
        config: config ?? this.config,
        loading: loading ?? this.loading,
        bootstrapped: bootstrapped ?? this.bootstrapped,
        error: error ?? this.error,
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
      final stored = await secure.read();
      if (stored != null) {
        await _apply(AppConfig(
          workerUrl: stored.workerUrl,
          accountEmail: stored.accountEmail,
          mobilePassword: stored.password,
        ));
      }
      state = state.copyWith(loading: false, bootstrapped: true);
    } catch (e) {
      state = state.copyWith(
        loading: false,
        bootstrapped: true,
        error: e.toString(),
      );
    }
  }

  /// The stored Worker URL (from a previous QR pairing). Null until the user
  /// has scanned a pairing QR at least once. Manual login uses this.
  Future<String?> storedWorkerUrl() async {
    final secure = _ref.read(secureStorageProvider);
    final stored = await secure.read();
    return stored?.workerUrl;
  }

  /// Validate account email + password against the Worker and persist on
  /// success. The Worker URL must already be known (from a prior QR scan);
  /// if not, the caller should scan a pairing QR first.
  Future<bool> connect({
    required String accountEmail,
    required String password,
    String? workerUrl,
  }) async {
    state = state.copyWith(loading: true, error: null);
    final resolvedWorkerUrl = workerUrl ?? await storedWorkerUrl();
    if (resolvedWorkerUrl == null || resolvedWorkerUrl.isEmpty) {
      state = state.copyWith(
        loading: false,
        error: 'Scan a pairing QR first to connect to your Worker.',
      );
      return false;
    }
    final candidate = AppConfig(
      workerUrl: resolvedWorkerUrl,
      accountEmail: accountEmail,
      mobilePassword: password,
    );
    final api = _ref.read(mobileApiProvider);
    api.configure(candidate);
    try {
      await api.pingConfig();
      await _ref.read(secureStorageProvider).save(
            workerUrl: candidate.normalizedWorkerUrl,
            accountEmail: candidate.normalizedAccountEmail,
            password: password,
          );
      await _apply(candidate);
      state = state.copyWith(loading: false);
      return true;
    } catch (e) {
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

  Future<void> signOut() async {
    await _ref.read(secureStorageProvider).clear();
    final storage = await _ref.read(storageServiceProvider.future);
    await storage.clearAll();
    _ref.read(mobileApiProvider).configure(
      const AppConfig(workerUrl: '', accountEmail: '', mobilePassword: ''),
    );
    _ref.read(syncServiceProvider).stop();
    state = const AuthState(loading: false);
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
