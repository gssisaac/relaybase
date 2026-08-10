import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../models/thread.dart';
import 'app_providers.dart';
import 'auth_provider.dart';

class ThreadDetailState {
  const ThreadDetailState({this.detail, this.loading = false, this.error});
  final MessageDetail? detail;
  final bool loading;
  final String? error;

  ThreadDetailState copyWith({MessageDetail? detail, bool? loading, String? error}) =>
      ThreadDetailState(
        detail: detail ?? this.detail,
        loading: loading ?? this.loading,
        error: error ?? this.error,
      );
}

class ThreadDetailNotifier extends StateNotifier<ThreadDetailState> {
  ThreadDetailNotifier(this._ref) : super(const ThreadDetailState());

  final Ref _ref;

  Future<void> load(String id, {String? domain}) async {
    if (!_ref.read(authProvider).isConfigured) return;
    state = const ThreadDetailState(loading: true);
    try {
      // Cache-first.
      final storage = await _ref.read(storageServiceProvider.future);
      final cached = storage.loadMessageDetail(id);
      if (cached != null) {
        state = ThreadDetailState(detail: MessageDetail.fromJson(cached), loading: false);
      }
      final detail = await _ref.read(mobileApiProvider).fetchMessage(id, domain: domain);
      await storage.saveMessageDetail(detail.toJson());
      state = ThreadDetailState(detail: detail, loading: false);
    } catch (e) {
      state = ThreadDetailState(loading: false, error: e.toString());
    }
  }
}

final threadDetailProvider =
    StateNotifierProvider<ThreadDetailNotifier, ThreadDetailState>((ref) {
  return ThreadDetailNotifier(ref);
});
