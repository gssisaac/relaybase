import 'dart:convert';

import 'package:flutter/foundation.dart' show visibleForTesting;
import 'package:hive_flutter/hive_flutter.dart';

import '../models/account.dart';
import '../models/draft.dart';
import '../models/message.dart';

/// Hive-backed offline cache. Boxes store JSON strings keyed by id so we do
/// not need generated type adapters.
///
/// Two layers of boxes are used:
///   * Global boxes (mailbox metadata, prefs) shared across accounts.
///   * Per-account boxes (inbox threads, message detail, sent, drafts)
///     namespaced by the active account email so switching accounts never
///     leaks another address's cached mail into the inbox. Call
///     [setActiveAccount] before reading or writing mail cache.
class StorageService {
  StorageService._(this._globalBoxes);

  /// Test-only constructor that skips Hive initialization. Per-account and
  /// global box methods are no-ops until [setActiveAccount] wires up real
  /// boxes; tests typically subclass and override the methods they need.
  @visibleForTesting
  StorageService.empty() : _globalBoxes = const {};

  static const _boxAccounts = 'relaybase_accounts';
  static const _boxPrefs = 'relaybase_prefs';

  static const _prefixThreads = 'relaybase_threads::';
  static const _prefixMessages = 'relaybase_messages::';
  static const _prefixSent = 'relaybase_sent::';
  static const _prefixDrafts = 'relaybase_drafts::';

  final Map<String, Box<String>> _globalBoxes;
  final Map<String, Box<String>> _accountBoxes = {};
  final Set<String> _openedAccountBoxNames = {};

  String? _activeEmail;

  static Future<StorageService> create() async {
    await Hive.initFlutter();
    final global = <String, Box<String>>{};
    for (final name in [_boxAccounts, _boxPrefs]) {
      global[name] = await Hive.openBox<String>(name);
    }
    return StorageService._(global);
  }

  Box<String> get _accounts => _globalBoxes[_boxAccounts]!;
  Box<String> get _prefs => _globalBoxes[_boxPrefs]!;

  Box<String> get _threads => _accountBoxes[_prefixThreads + _activeEmail!]!;
  Box<String> get _messages => _accountBoxes[_prefixMessages + _activeEmail!]!;
  Box<String> get _sent => _accountBoxes[_prefixSent + _activeEmail!]!;
  Box<String> get _drafts => _accountBoxes[_prefixDrafts + _activeEmail!]!;

  String get activeEmail => _activeEmail ?? '';

  /// Open (or reuse) the per-account boxes for [email]. Must be called before
  /// any mail-cache read/write. Switching accounts points the getters at the
  /// new account's boxes; previously opened boxes stay cached by Hive.
  Future<void> setActiveAccount(String email) async {
    final normalized = email.trim().toLowerCase();
    if (normalized.isEmpty) return;
    _activeEmail = normalized;
    await _ensureOpen(_prefixThreads + normalized);
    await _ensureOpen(_prefixMessages + normalized);
    await _ensureOpen(_prefixSent + normalized);
    await _ensureOpen(_prefixDrafts + normalized);
  }

  Future<void> _ensureOpen(String name) async {
    _openedAccountBoxNames.add(name);
    if (_accountBoxes[name] == null) {
      if (Hive.isBoxOpen(name)) {
        _accountBoxes[name] = Hive.box<String>(name);
      } else {
        _accountBoxes[name] = await Hive.openBox<String>(name);
      }
    }
    if (!_accountBoxes[name]!.isOpen) {
      _accountBoxes[name] = await Hive.openBox<String>(name);
    }
  }

  bool get _hasActiveAccount => _activeEmail != null && _activeEmail!.isNotEmpty;

  // ---- Accounts (global mailbox metadata cache) ----
  Future<void> saveAccounts(List<Account> accounts) async {
    await _accounts.clear();
    for (final a in accounts) {
      await _accounts.put(a.email, jsonEncode(a.toJson()));
    }
  }

  List<Account> loadAccounts() {
    return _accounts.values
        .map((raw) => Account.fromJson(jsonDecode(raw) as Map<String, dynamic>))
        .toList(growable: false);
  }

  // ---- Inbox messages (per-account) ----
  Future<void> saveInbox(List<Message> messages) async {
    if (!_hasActiveAccount) return;
    await _threads.clear();
    for (final m in messages) {
      await _threads.put(m.id, jsonEncode(m.toJson()));
    }
  }

  List<Message> loadInbox() {
    if (!_hasActiveAccount) return const [];
    return _threads.values
        .map((raw) => Message.fromJson(jsonDecode(raw) as Map<String, dynamic>))
        .toList(growable: false);
  }

  Future<void> upsertMessage(Message message) async {
    if (!_hasActiveAccount) return;
    await _threads.put(message.id, jsonEncode(message.toJson()));
  }

  Future<void> removeMessage(String id) async {
    if (!_hasActiveAccount) return;
    await _threads.delete(id);
  }

  // ---- Message detail cache (per-account) ----
  Future<void> saveMessageDetail(Map<String, dynamic> json) async {
    if (!_hasActiveAccount) return;
    await _messages.put(json['key'] as String? ?? '', jsonEncode(json));
  }

  Map<String, dynamic>? loadMessageDetail(String id) {
    if (!_hasActiveAccount) return null;
    final raw = _messages.get(id);
    return raw == null ? null : jsonDecode(raw) as Map<String, dynamic>;
  }

  // ---- Sent (per-account) ----
  Future<void> saveSent(List<Map<String, dynamic>> sent) async {
    if (!_hasActiveAccount) return;
    await _sent.clear();
    for (final s in sent) {
      final id = s['id'] as String? ?? s['messageId'] as String? ?? '';
      if (id.isNotEmpty) await _sent.put(id, jsonEncode(s));
    }
  }

  List<Map<String, dynamic>> loadSent() {
    if (!_hasActiveAccount) return const [];
    return _sent.values
        .map((raw) => jsonDecode(raw) as Map<String, dynamic>)
        .toList(growable: false);
  }

  // ---- Drafts (per-account) ----
  Future<void> saveDraft(DraftEmail draft) async {
    if (!_hasActiveAccount) return;
    if (draft.isEmpty) {
      await _drafts.delete(draft.id);
      return;
    }
    await _drafts.put(draft.id, jsonEncode(draft.toJson()));
  }

  DraftEmail? loadDraft(String id) {
    if (!_hasActiveAccount) return null;
    final raw = _drafts.get(id);
    return raw == null ? null : DraftEmail.fromJson(jsonDecode(raw) as Map<String, dynamic>);
  }

  List<DraftEmail> loadDrafts() {
    if (!_hasActiveAccount) return const [];
    return _drafts.values
        .map((raw) => DraftEmail.fromJson(jsonDecode(raw) as Map<String, dynamic>))
        .toList(growable: false);
  }

  Future<void> deleteDraft(String id) async {
    if (!_hasActiveAccount) return;
    await _drafts.delete(id);
  }

  // ---- Prefs (global) ----
  Future<void> setPref(String key, String value) async {
    await _prefs.put(key, value);
  }

  String? getPref(String key) => _prefs.get(key);

  static const prefLastEmail = 'lastAccountEmail';
  static const prefLastWorkerUrl = 'lastWorkerUrl';

  Future<void> rememberLastUsed({String? email, String? workerUrl}) async {
    if (email != null && email.isNotEmpty) await setPref(prefLastEmail, email);
    if (workerUrl != null && workerUrl.isNotEmpty) {
      await setPref(prefLastWorkerUrl, workerUrl);
    }
  }

  String? get lastEmail => getPref(prefLastEmail);
  String? get lastWorkerUrl => getPref(prefLastWorkerUrl);

  /// Clear all cached data: global boxes plus every per-account box that has
  /// been opened in this session. The active account is preserved so a
  /// "clear cache" from Settings does not silently disable mail caching.
  Future<void> clearAll() async {
    for (final box in _globalBoxes.values) {
      await box.clear();
    }
    for (final name in _openedAccountBoxNames.toList()) {
      Box<String>? box = _accountBoxes[name];
      box ??= Hive.isBoxOpen(name) ? Hive.box<String>(name) : null;
      if (box != null && box.isOpen) {
        await box.clear();
      }
    }
  }
}
