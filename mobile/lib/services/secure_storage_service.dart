import 'package:flutter_secure_storage/flutter_secure_storage.dart';

/// Stores the Worker URL + mobile password in the platform keystore
/// (iOS Keychain / Android Keystore). Never written to disk in plaintext.
class SecureStorageService {
  SecureStorageService({FlutterSecureStorage? storage})
      : _storage = storage ?? const FlutterSecureStorage();

  final FlutterSecureStorage _storage;

  static const _keyWorkerUrl = 'relaybase.workerUrl';
  static const _keyMobilePassword = 'relaybase.mobilePassword';

  Future<void> save({required String workerUrl, required String password}) async {
    await _storage.write(key: _keyWorkerUrl, value: workerUrl);
    await _storage.write(key: _keyMobilePassword, value: password);
  }

  Future<({String workerUrl, String password})?> read() async {
    final workerUrl = await _storage.read(key: _keyWorkerUrl);
    final password = await _storage.read(key: _keyMobilePassword);
    if (workerUrl == null || password == null) return null;
    return (workerUrl: workerUrl, password: password);
  }

  Future<void> clear() async {
    await _storage.delete(key: _keyWorkerUrl);
    await _storage.delete(key: _keyMobilePassword);
  }
}
