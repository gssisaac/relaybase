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
}

class ThreadsNotifier extends StateNotifier<ThreadsState> {
  ThreadsNotifier(this._ref) : super(const ThreadsState());

  final Ref _ref;

  String? _accountFilter;
  String? get accountFilter => _accountFilter;

  void setAccountFilter(String? email) {
    _accountFilter = email;
    refresh();
  }

  Future<void> load() async {
    if (!_ref.read(authProvider).isConfigured) return;
    state = state.copyWith(loading: true, error: null);
    try {
      final storage = await _ref.read(storageServiceProvider.future);
      final cached = storage.loadInbox();
      state = state.copyWith(messages: cached, loading: false);
      await refresh();
    } catch (e) {
      state = state.copyWith(loading: false, error: e.toString());
    }
  }

  Future<void> refresh() async {
    if (!_ref.read(authProvider).isConfigured) return;
    state = state.copyWith(refreshing: true, error: null);
    try {
      final api = _ref.read(mobileApiProvider);
      final messages =
          await api.fetchInbox(account: _accountFilter, limit: 50);
      final storage = await _ref.read(storageServiceProvider.future);
      await storage.saveInbox(messages);
      state = state.copyWith(messages: messages, refreshing: false);
    } catch (e) {
      state = state.copyWith(refreshing: false, error: e.toString());
    }
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

  List<Message> filtered(Folder folder) {
    switch (folder) {
      case Folder.starred:
        return state.messages.where((m) => m.starred).toList(growable: false);
      case Folder.allMail:
      case Folder.inbox:
        return state.messages;
      case Folder.sent:
      case Folder.drafts:
      case Folder.trash:
        return const [];
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
