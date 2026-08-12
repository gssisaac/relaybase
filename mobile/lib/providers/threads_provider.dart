import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../models/message.dart';
import '../services/html_service.dart';
import 'app_providers.dart';
import 'auth_provider.dart';

/// Folder type for the drawer list.
enum Folder { inbox, starred, sent, drafts, trash, allMail }

class ThreadsState {
  const ThreadsState({
    this.messages = const [],
    this.loading = false,
    this.refreshing = false,
    this.error,
  });

  final List<Message> messages;
  final bool loading;
  final bool refreshing;
  final String? error;

  ThreadsState copyWith({
    List<Message>? messages,
    bool? loading,
    bool? refreshing,
    String? error,
  }) =>
      ThreadsState(
        messages: messages ?? this.messages,
        loading: loading ?? this.loading,
        refreshing: refreshing ?? this.refreshing,
        error: error ?? this.error,
      );

  List<Message> filtered(Folder folder) {
    switch (folder) {
      case Folder.starred:
        return _sorted(messages.where((m) => m.starred).toList(growable: false));
      case Folder.allMail:
      case Folder.inbox:
        return _sorted(messages);
      case Folder.sent:
      case Folder.drafts:
      case Folder.trash:
        return const [];
    }
  }

  /// Always sort by receivedAt descending so the list order is stable
  /// regardless of the underlying messages array order (Hive insertion order
  /// vs API response order can briefly differ during a reload).
  static List<Message> _sorted(List<Message> input) {
    final copy = List<Message>.of(input, growable: false);
    copy.sort((a, b) => b.receivedAt.compareTo(a.receivedAt));
    return copy;
  }
}

class ThreadsNotifier extends StateNotifier<ThreadsState> {
  ThreadsNotifier(this._ref) : super(const ThreadsState());

  final Ref _ref;

  String? _accountFilter;
  String? get accountFilter => _accountFilter;
  bool _loaded = false;
  int _refreshGeneration = 0;

  void setAccountFilter(String? email) {
    _accountFilter = email;
    refresh();
  }

  Future<void> load() async {
    if (!_ref.read(authProvider).isConfigured) return;
    // Skip if already loaded — the state survives across InboxScreen remounts
    // (the provider is a singleton). Reloading would reset messages to the
    // Hive cache order and briefly flash a different list order before the
    // API response arrives.
    if (_loaded) return;
    _loaded = true;
    if (!mounted) return;
    state = state.copyWith(loading: true, error: null);
    try {
      final storage = await _ref.read(storageServiceProvider.future);
      if (!mounted) return;
      final cached = storage.loadInbox();
      state = state.copyWith(messages: cached, loading: false);
      await refresh();
    } catch (e) {
      if (!mounted) return;
      state = state.copyWith(loading: false, error: e.toString());
    }
  }

  Future<void> refresh() async {
    if (!_ref.read(authProvider).isConfigured) return;
    final generation = ++_refreshGeneration;
    if (!mounted) return;
    state = state.copyWith(refreshing: true, error: null);
    try {
      final api = _ref.read(mobileApiProvider);
      final messages =
          await api.fetchInbox(account: _accountFilter, limit: 50);
      // Ignore stale responses — a newer refresh (e.g. account filter change)
      // may have already completed with fresher data.
      if (_refreshGeneration != generation || !mounted) return;
      final storage = await _ref.read(storageServiceProvider.future);
      await storage.saveInbox(messages);
      if (_refreshGeneration != generation || !mounted) return;
      state = state.copyWith(messages: messages, refreshing: false);
    } catch (e) {
      if (_refreshGeneration != generation || !mounted) return;
      state = state.copyWith(refreshing: false, error: e.toString());
    }
  }

  /// Clear all state — called on sign out so a re-login does a fresh load.
  void reset() {
    _loaded = false;
    _accountFilter = null;
    _refreshGeneration++;
    state = const ThreadsState();
  }

  Future<void> toggleStar(Message message) async {
    final updated = message.copyWith(starred: !message.starred);
    final next = state.messages
        .map((m) => m.id == updated.id ? updated : m)
        .toList(growable: false);
    state = state.copyWith(messages: next);
    final storage = await _ref.read(storageServiceProvider.future);
    await storage.upsertMessage(updated);
  }

  Future<void> markRead(Message message, bool read) async {
    final updated = message.copyWith(readAt: read ? DateTime.now().toIso8601String() : null);
    final next = state.messages
        .map((m) => m.id == updated.id ? updated : m)
        .toList(growable: false);
    state = state.copyWith(messages: next);
    final storage = await _ref.read(storageServiceProvider.future);
    await storage.upsertMessage(updated);
    try {
      await _ref.read(mobileApiProvider).setRead([message.id], read);
    } catch (_) {
      // Best-effort — local state already updated.
    }
  }
}

final threadsProvider =
    StateNotifierProvider<ThreadsNotifier, ThreadsState>((ref) {
  return ThreadsNotifier(ref);
});

/// Preview text for a list row (HTML stripped).
final previewProvider = Provider.family<String, Message>((ref, message) {
  return HtmlService.toPreview(message.preview);
});
