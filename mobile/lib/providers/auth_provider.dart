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
    this.error,
  });

  final AppConfig? config;
  final bool loading;
  final String? error;

  bool get isConfigured => config?.isConfigured ?? false;

  AuthState copyWith({AppConfig? config, bool? loading, String? error}) =>
      AuthState(
        config: config ?? this.config,
        loading: loading ?? this.loading,
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
          mobilePassword: stored.password,
        ));
      }
      state = state.copyWith(loading: false);
    } catch (e) {
      state = state.copyWith(loading: false, error: e.toString());
    }
  }

  /// Validate a candidate config against the Worker and persist on success.
  Future<bool> connect({required String workerUrl, required String password}) async {
    state = state.copyWith(loading: true, error: null);
    final candidate = AppConfig(workerUrl: workerUrl, mobilePassword: password);
    final api = _ref.read(mobileApiProvider);
    api.configure(candidate);
    try {
      await api.pingConfig();
      await _ref.read(secureStorageProvider).save(
            workerUrl: candidate.normalizedWorkerUrl,
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

  /// Convenience for QR pairing: parse the deep link then connect.
  Future<bool> connectFromDeepLink(String uri) async {
    final params = ConnectDeepLink.parse(uri);
    if (params == null) {
      state = state.copyWith(error: 'Invalid pairing link');
      return false;
    }
    return connect(workerUrl: params.workerUrl, password: params.password);
  }

  Future<void> signOut() async {
    await _ref.read(secureStorageProvider).clear();
    final storage = await _ref.read(storageServiceProvider.future);
    await storage.clearAll();
    _ref.read(mobileApiProvider).configure(const AppConfig(workerUrl: '', mobilePassword: ''));
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
