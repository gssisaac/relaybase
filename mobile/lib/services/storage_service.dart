import 'dart:convert';

import 'package:hive_flutter/hive_flutter.dart';

import '../models/account.dart';
import '../models/draft.dart';
import '../models/message.dart';

/// Hive-backed offline cache. Boxes store JSON strings keyed by id so we do
/// not need generated type adapters.
class StorageService {
  StorageService._(this._boxes);

  static const _boxAccounts = 'relaybase_accounts';
  static const _boxThreads = 'relaybase_threads';
  static const _boxMessages = 'relaybase_messages';
  static const _boxSent = 'relaybase_sent';
  static const _boxDrafts = 'relaybase_drafts';
  static const _boxPrefs = 'relaybase_prefs';

  final Map<String, Box<String>> _boxes;

  static Future<StorageService> create() async {
    await Hive.initFlutter;
    final boxes = <String, Box<String>>{};
    for (final name in [
      _boxAccounts,
      _boxThreads,
      _boxMessages,
      _boxSent,
      _boxDrafts,
      _boxPrefs,
    ]) {
      boxes[name] = await Hive.openBox<String>(name);
    }
    return StorageService._(boxes);
  }

  Box<String> get _accounts => _boxes[_boxAccounts]!;
  Box<String> get _threads => _boxes[_boxThreads]!;
  Box<String> get _messages => _boxes[_boxMessages]!;
  Box<String> get _sent => _boxes[_boxSent]!;
  Box<String> get _drafts => _boxes[_boxDrafts]!;
  Box<String> get _prefs => _boxes[_boxPrefs]!;

  // ---- Accounts ----
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

  // ---- Inbox messages ----
  Future<void> saveInbox(List<Message> messages) async {
    await _threads.clear();
    for (final m in messages) {
      await _threads.put(m.id, jsonEncode(m.toJson()));
    }
  }

  List<Message> loadInbox() {
    return _threads.values
        .map((raw) => Message.fromJson(jsonDecode(raw) as Map<String, dynamic>))
        .toList(growable: false);
  }

  Future<void> upsertMessage(Message message) async {
    await _threads.put(message.id, jsonEncode(message.toJson()));
  }

  Future<void> removeMessage(String id) async {
    await _threads.delete(id);
  }

  // ---- Message detail cache ----
  Future<void> saveMessageDetail(Map<String, dynamic> json) async {
    await _messages.put(json['key'] as String? ?? '', jsonEncode(json));
  }

  Map<String, dynamic>? loadMessageDetail(String id) {
    final raw = _messages.get(id);
    return raw == null ? null : jsonDecode(raw) as Map<String, dynamic>;
  }

  // ---- Sent ----
  Future<void> saveSent(List<Map<String, dynamic>> sent) async {
    await _sent.clear();
    for (final s in sent) {
      final id = s['id'] as String? ?? s['messageId'] as String? ?? '';
      if (id.isNotEmpty) await _sent.put(id, jsonEncode(s));
    }
  }

  List<Map<String, dynamic>> loadSent() {
    return _sent.values
        .map((raw) => jsonDecode(raw) as Map<String, dynamic>)
        .toList(growable: false);
  }

  // ---- Drafts ----
  Future<void> saveDraft(DraftEmail draft) async {
    if (draft.isEmpty) {
      await _drafts.delete(draft.id);
      return;
    }
    await _drafts.put(draft.id, jsonEncode(draft.toJson()));
  }

  DraftEmail? loadDraft(String id) {
    final raw = _drafts.get(id);
    return raw == null ? null : DraftEmail.fromJson(jsonDecode(raw) as Map<String, dynamic>);
  }

  List<DraftEmail> loadDrafts() {
    return _drafts.values
        .map((raw) => DraftEmail.fromJson(jsonDecode(raw) as Map<String, dynamic>))
        .toList(growable: false);
  }

  Future<void> deleteDraft(String id) async {
    await _drafts.delete(id);
  }

  // ---- Prefs ----
  Future<void> setPref(String key, String value) async {
    await _prefs.put(key, value);
  }

  String? getPref(String key) => _prefs.get(key);

  Future<void> clearAll() async {
    for (final box in _boxes.values) {
      await box.clear();
    }
  }
}
