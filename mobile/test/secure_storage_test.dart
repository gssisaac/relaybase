import 'dart:convert';

import 'package:flutter_secure_storage/flutter_secure_storage.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:relaybase/services/secure_storage_service.dart';

/// In-memory [FlutterSecureStorage] fake that records writes keyed by name.
class FakeSecureStorage extends FlutterSecureStorage {
  final Map<String, String> _store = {};

  @override
  Future<String?> read({
    required String key,
    IOSOptions? iOptions,
    AndroidOptions? aOptions,
    LinuxOptions? lOptions,
    WebOptions? webOptions,
    MacOsOptions? mOptions,
    WindowsOptions? wOptions,
  }) async =>
      _store[key];

  @override
  Future<void> write({
    required String key,
    required String? value,
    IOSOptions? iOptions,
    AndroidOptions? aOptions,
    LinuxOptions? lOptions,
    WebOptions? webOptions,
    MacOsOptions? mOptions,
    WindowsOptions? wOptions,
  }) async {
    if (value == null) {
      _store.remove(key);
    } else {
      _store[key] = value;
    }
  }

  @override
  Future<void> delete({
    required String key,
    IOSOptions? iOptions,
    AndroidOptions? aOptions,
    LinuxOptions? lOptions,
    WebOptions? webOptions,
    MacOsOptions? mOptions,
    WindowsOptions? wOptions,
  }) async {
    _store.remove(key);
  }
}

void main() {
  late FakeSecureStorage backing;
  late SecureStorageService service;

  setUp(() {
    backing = FakeSecureStorage();
    service = SecureStorageService(storage: backing);
  });

  group('migration', () {
    test('legacy single-account keys become a one-element managed list', () async {
      await service.save(
        workerUrl: 'https://worker.example.com',
        accountEmail: 'isaac@kloyapp.com',
        password: 'secret123',
      );
      // Drop the managed list so loadAccounts triggers migration.
      await backing.delete(key: 'relaybase.managedAccounts');

      final accounts = await service.loadAccounts();
      expect(accounts, hasLength(1));
      expect(accounts.first.email, 'isaac@kloyapp.com');
      expect(accounts.first.password, 'secret123');
      expect(accounts.first.workerUrl, 'https://worker.example.com');
      expect(accounts.first.isActive, isTrue);
    });

    test('returns empty list when nothing is stored', () async {
      expect(await service.loadAccounts(), isEmpty);
    });
  });

  group('saveAccounts / loadAccounts', () {
    test('persists multiple accounts and mirrors the active one to legacy keys', () async {
      final accounts = [
        const StoredAccount(
          email: 'a@kloyapp.com',
          password: 'pwA',
          workerUrl: 'https://w.example.com',
          isActive: false,
        ),
        const StoredAccount(
          email: 'b@kloyapp.com',
          password: 'pwB',
          workerUrl: 'https://w.example.com',
          isActive: true,
        ),
      ];
      await service.saveAccounts(accounts);

      final loaded = await service.loadAccounts();
      expect(loaded, hasLength(2));
      expect(loaded.where((a) => a.isActive).toList(), hasLength(1));
      expect(loaded.firstWhere((a) => a.isActive).email, 'b@kloyapp.com');

      final legacy = await service.read();
      expect(legacy, isNotNull);
      expect(legacy!.accountEmail, 'b@kloyapp.com');
      expect(legacy.password, 'pwB');
    });

    test('promotes the first account when none is marked active', () async {
      await service.saveAccounts([
        const StoredAccount(
          email: 'a@kloyapp.com',
          password: 'pwA',
          workerUrl: 'https://w.example.com',
          isActive: false,
        ),
        const StoredAccount(
          email: 'b@kloyapp.com',
          password: 'pwB',
          workerUrl: 'https://w.example.com',
          isActive: false,
        ),
      ]);
      final loaded = await service.loadAccounts();
      expect(loaded.first.isActive, isTrue);
      expect(loaded.where((a) => a.isActive).toList(), hasLength(1));
    });

    test('clears legacy keys and managed list when saving an empty list', () async {
      await service.saveAccounts([
        const StoredAccount(
          email: 'a@kloyapp.com',
          password: 'pwA',
          workerUrl: 'https://w.example.com',
          isActive: true,
        ),
      ]);
      await service.saveAccounts(const []);
      expect(await service.loadAccounts(), isEmpty);
      expect(await service.read(), isNull);
    });
  });

  group('JSON shape', () {
    test('round-trips through toJson/fromJson', () {
      const original = StoredAccount(
        email: 'a@kloyapp.com',
        password: 'pwA',
        workerUrl: 'https://w.example.com',
        isActive: true,
        domain: 'kloyapp.com',
        displayName: 'Isaac',
      );
      final json = original.toJson();
      expect(jsonDecode(jsonEncode(json)), json);
      final restored = StoredAccount.fromJson(json);
      expect(restored.email, original.email);
      expect(restored.password, original.password);
      expect(restored.workerUrl, original.workerUrl);
      expect(restored.isActive, original.isActive);
      expect(restored.domain, original.domain);
      expect(restored.displayName, original.displayName);
    });
  });
}
