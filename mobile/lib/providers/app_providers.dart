import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../config/app_config.dart';
import '../services/mobile_api_service.dart';
import '../services/secure_storage_service.dart';
import '../services/storage_service.dart';
import '../services/sync_service.dart';

/// Singletons shared across the app. Services are constructed lazily and
/// configured once the user pairs (see [authProvider]).
final secureStorageProvider = Provider<SecureStorageService>((ref) {
  return SecureStorageService();
});

final storageServiceProvider = FutureProvider<StorageService>((ref) async {
  return StorageService.create();
});

final mobileApiProvider = Provider<MobileApiService>((ref) {
  final api = MobileApiService();
  ref.onDispose(api.close);
  return api;
});

final syncServiceProvider = Provider<SyncService>((ref) {
  final api = ref.watch(mobileApiProvider);
  final sync = SyncService(api: api);
  ref.onDispose(sync.dispose);
  return sync;
});

/// The resolved app config (Worker URL + mobile password). Null until paired.
final appConfigProvider = StateProvider<AppConfig?>((ref) => null);
