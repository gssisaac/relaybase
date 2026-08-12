import 'dart:convert';

import 'package:flutter_secure_storage/flutter_secure_storage.dart';

/// A single managed account record persisted in the platform keystore.
///
/// The mobile app stores one or more of these so a teammate can switch
/// between mailbox addresses on the same device. Exactly one record is
/// marked active at a time; its credentials are also mirrored into the
/// legacy single-account keys so [MobileApiService] can keep reading the
/// active config directly.
class StoredAccount {
  const StoredAccount({
    required this.email,
    required this.password,
    required this.workerUrl,
    this.isActive = false,
  this.displayName,
  this.domain,
  this.inboundEnabled = true,
    this.mobileEnabled = true,
  this.updatedAt,
  });

  final String email;
  final String password;
  final String workerUrl;
  final bool isActive;
  final String? displayName;
  final String? domain;
  final bool inboundEnabled;
  final bool mobileEnabled;
  final DateTime? updatedAt;

  String get normalizedEmail => email.trim().toLowerCase();

  StoredAccount copyWith({
    String? email,
    String? password,
    String? workerUrl,
    bool? isActive,
    String? displayName,
    String? domain,
    bool? inboundEnabled,
    bool? mobileEnabled,
    DateTime? updatedAt,
  }) =>
      StoredAccount(
        email: email ?? this.email,
        password: password ?? this.password,
        workerUrl: workerUrl ?? this.workerUrl,
        isActive: isActive ?? this.isActive,
        displayName: displayName ?? this.displayName,
        domain: domain ?? this.domain,
        inboundEnabled: inboundEnabled ?? this.inboundEnabled,
        mobileEnabled: mobileEnabled ?? this.mobileEnabled,
        updatedAt: updatedAt ?? this.updatedAt,
      );

  Map<String, dynamic> toJson() => {
        'email': email,
        'password': password,
        'workerUrl': workerUrl,
        'isActive': isActive,
        if (displayName != null) 'displayName': displayName,
        if (domain != null) 'domain': domain,
        'inboundEnabled': inboundEnabled,
        'mobileEnabled': mobileEnabled,
        if (updatedAt != null) 'updatedAt': updatedAt!.toIso8601String(),
      };

  factory StoredAccount.fromJson(Map<String, dynamic> json) => StoredAccount(
        email: json['email'] as String? ?? '',
        password: json['password'] as String? ?? '',
        workerUrl: json['workerUrl'] as String? ?? '',
        isActive: json['isActive'] as bool? ?? false,
        displayName: json['displayName'] as String?,
        domain: json['domain'] as String?,
        inboundEnabled: json['inboundEnabled'] as bool? ?? true,
        mobileEnabled: json['mobileEnabled'] as bool? ?? true,
        updatedAt: json['updatedAt'] == null
            ? null
            : DateTime.tryParse(json['updatedAt'] as String),
      );
}

/// Stores the Worker URL + account email + mobile password in the platform
/// keystore (iOS Keychain / Android Keystore). Never written to disk in
/// plaintext. The Worker URL is obtained via QR pairing; the email + password
/// are the mobile app's login credentials.
///
/// Two layers are persisted:
///   * The full managed-account list under [_keyManagedAccounts] (JSON).
///   * The active account mirrored into the legacy single-account keys so
///     [MobileApiService] can keep reading the active config directly.
class SecureStorageService {
  SecureStorageService({FlutterSecureStorage? storage})
      : _storage = storage ?? const FlutterSecureStorage();

  final FlutterSecureStorage _storage;

  static const _keyWorkerUrl = 'relaybase.workerUrl';
  static const _keyAccountEmail = 'relaybase.accountEmail';
  static const _keyMobilePassword = 'relaybase.mobilePassword';
  static const _keyManagedAccounts = 'relaybase.managedAccounts';

  /// Persist the active account into the legacy single-account keys.
  Future<void> save({
    required String workerUrl,
    required String accountEmail,
    required String password,
  }) async {
    await _storage.write(key: _keyWorkerUrl, value: workerUrl);
    await _storage.write(key: _keyAccountEmail, value: accountEmail);
    await _storage.write(key: _keyMobilePassword, value: password);
  }

  Future<({String workerUrl, String accountEmail, String password})?> read() async {
    final workerUrl = await _storage.read(key: _keyWorkerUrl);
    final accountEmail = await _storage.read(key: _keyAccountEmail);
    final password = await _storage.read(key: _keyMobilePassword);
    if (workerUrl == null || accountEmail == null || password == null) {
      return null;
    }
    return (workerUrl: workerUrl, accountEmail: accountEmail, password: password);
  }

  /// Load every managed account. Migrates the legacy single-account keys into
  /// a one-element managed list on first read so existing installs keep
  /// working.
  Future<List<StoredAccount>> loadAccounts() async {
    final raw = await _storage.read(key: _keyManagedAccounts);
    if (raw != null && raw.isNotEmpty) {
      try {
        final decoded = jsonDecode(raw);
        if (decoded is List) {
          return decoded
              .map((e) => StoredAccount.fromJson(e as Map<String, dynamic>))
              .toList(growable: true);
        }
      } catch (_) {
        // Fall through to migration.
      }
    }
    // Migrate legacy single-account keys into the managed list.
    final legacy = await read();
    if (legacy == null) return const [];
    final migrated = [
      StoredAccount(
        email: legacy.accountEmail,
        password: legacy.password,
        workerUrl: legacy.workerUrl,
        isActive: true,
        updatedAt: DateTime.now(),
      ),
    ];
    await saveAccounts(migrated);
    return migrated;
  }

  /// Persist the full managed-account list. Exactly one record should be
  /// marked active; if more than one is active the first wins, if none is
  /// active the first record is promoted. The active account is also mirrored
  /// into the legacy single-account keys.
  Future<void> saveAccounts(List<StoredAccount> accounts) async {
    if (accounts.isEmpty) {
      await _storage.delete(key: _keyManagedAccounts);
      await clear();
      return;
    }
    final normalized = _normalizeActive(accounts);
    await _storage.write(
      key: _keyManagedAccounts,
      value: jsonEncode(normalized.map((a) => a.toJson()).toList()),
    );
    final active = normalized.firstWhere(
      (a) => a.isActive,
      orElse: () => normalized.first,
    );
    await save(
      workerUrl: active.workerUrl,
      accountEmail: active.normalizedEmail,
      password: active.password,
    );
  }

  List<StoredAccount> _normalizeActive(List<StoredAccount> accounts) {
    final activeIndex = accounts.indexWhere((a) => a.isActive);
    final normalized = <StoredAccount>[];
    for (var i = 0; i < accounts.length; i++) {
      final a = accounts[i];
      final shouldBeActive = activeIndex == -1 ? i == 0 : i == activeIndex;
      normalized.add(shouldBeActive == a.isActive ? a : a.copyWith(isActive: shouldBeActive));
    }
    return normalized;
  }

  Future<void> clear() async {
    await _storage.delete(key: _keyWorkerUrl);
    await _storage.delete(key: _keyAccountEmail);
    await _storage.delete(key: _keyMobilePassword);
    await _storage.delete(key: _keyManagedAccounts);
  }
}
