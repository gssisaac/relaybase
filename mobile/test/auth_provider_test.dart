import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:relaybase/models/account.dart';
import 'package:relaybase/models/message.dart';
import 'package:relaybase/providers/app_providers.dart';
import 'package:relaybase/providers/auth_provider.dart';
import 'package:relaybase/services/mobile_api_service.dart';
import 'package:relaybase/services/secure_storage_service.dart';
import 'package:relaybase/services/storage_service.dart';
import 'package:relaybase/services/sync_service.dart';

import 'secure_storage_test.dart' show FakeSecureStorage;

/// Network-free [MobileApiService]. [pingConfig] always succeeds so the
/// connect flow can proceed without hitting the Worker.
class _FakeMobileApiService extends MobileApiService {
  _FakeMobileApiService() : super();

  @override
  Future<void> pingConfig() async {}

  @override
  Future<List<Account>> fetchMailbox() async => const <Account>[];

  @override
  Future<Map<String, AddressCounts>> fetchCounts() async => const {};

  @override
  Future<List<Message>> fetchInbox({String? account, int limit = 50}) async => const <Message>[];
}

/// [StorageService] that never touches Hive. Used so the auth flow can run
/// without initializing Hive in a unit test.
class _FakeStorageService extends StorageService {
  _FakeStorageService() : super.empty();

  @override
  Future<void> setActiveAccount(String email) async {}

  @override
  Future<void> clearAll() async {}
}

/// [SyncService] whose timer never starts.
class _NoopSyncService extends SyncService {
  _NoopSyncService({required super.api});

  @override
  void start() {}

  @override
  void stop() {}
}

ProviderContainer _container() {
  final fakeStorage = _FakeStorageService();
  final fakeApi = _FakeMobileApiService();
  return ProviderContainer(
    overrides: [
      secureStorageProvider.overrideWithValue(
        SecureStorageService(storage: FakeSecureStorage()),
      ),
      mobileApiProvider.overrideWithValue(fakeApi),
      storageServiceProvider.overrideWith((ref) async => fakeStorage),
      syncServiceProvider.overrideWith((ref) => _NoopSyncService(api: fakeApi)),
    ],
  );
}

void main() {
  tearDown(() {});

  group('AuthNotifier multi-account', () {
    test('connect adds an account and activates it', () async {
      final container = _container();
      addTearDown(container.dispose);
      final auth = container.read(authProvider.notifier);

      // Bootstrap finishes with no accounts.
      await Future<void>.delayed(Duration.zero);
      expect(container.read(authProvider).isConfigured, isFalse);

      final ok = await auth.connect(
        accountEmail: 'a@kloyapp.com',
        password: 'pwA',
      );
      expect(ok, isTrue);
      final state = container.read(authProvider);
      expect(state.isConfigured, isTrue);
      expect(state.config?.normalizedAccountEmail, 'a@kloyapp.com');
      expect(state.managedAccounts, hasLength(1));
      expect(state.managedAccounts.first.email, 'a@kloyapp.com');
    });

    test('connect on an existing email updates its password', () async {
      final container = _container();
      addTearDown(container.dispose);
      final auth = container.read(authProvider.notifier);

      await auth.connect(accountEmail: 'a@kloyapp.com', password: 'pwA');
      await auth.connect(accountEmail: 'a@kloyapp.com', password: 'pwA2');

      final state = container.read(authProvider);
      expect(state.managedAccounts, hasLength(1));
      final stored = await container.read(secureStorageProvider).loadAccounts();
      expect(stored.first.password, 'pwA2');
    });

    test('switchAccount activates the selected account', () async {
      final container = _container();
      addTearDown(container.dispose);
      final auth = container.read(authProvider.notifier);

      await auth.connect(accountEmail: 'a@kloyapp.com', password: 'pwA');
      await auth.connect(accountEmail: 'b@kloyapp.com', password: 'pwB');
      expect(container.read(authProvider).config?.normalizedAccountEmail, 'b@kloyapp.com');

      await auth.switchAccount('a@kloyapp.com');
      final state = container.read(authProvider);
      expect(state.config?.normalizedAccountEmail, 'a@kloyapp.com');
      expect(state.managedAccounts, hasLength(2));
    });

    test('removeAccount switches to the next account when active is removed', () async {
      final container = _container();
      addTearDown(container.dispose);
      final auth = container.read(authProvider.notifier);

      await auth.connect(accountEmail: 'a@kloyapp.com', password: 'pwA');
      await auth.connect(accountEmail: 'b@kloyapp.com', password: 'pwB');
      // Active is b. Remove b -> a becomes active.
      await auth.removeAccount('b@kloyapp.com');

      final state = container.read(authProvider);
      expect(state.managedAccounts, hasLength(1));
      expect(state.config?.normalizedAccountEmail, 'a@kloyapp.com');
    });

    test('removeAccount signs out when the last account is removed', () async {
      final container = _container();
      addTearDown(container.dispose);
      final auth = container.read(authProvider.notifier);

      await auth.connect(accountEmail: 'a@kloyapp.com', password: 'pwA');
      expect(container.read(authProvider).isConfigured, isTrue);

      await auth.removeAccount('a@kloyapp.com');

      final state = container.read(authProvider);
      expect(state.isConfigured, isFalse);
      expect(state.managedAccounts, isEmpty);
      expect(await container.read(secureStorageProvider).loadAccounts(), isEmpty);
    });
  });
}
