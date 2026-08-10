import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../models/message.dart';
import 'threads_provider.dart';

class SearchState {
  const SearchState({this.query = '', this.results = const [], this.searching = false});
  final String query;
  final List<Message> results;
  final bool searching;

  SearchState copyWith({String? query, List<Message>? results, bool? searching}) =>
      SearchState(
        query: query ?? this.query,
        results: results ?? this.results,
        searching: searching ?? this.searching,
      );
}

class SearchNotifier extends StateNotifier<SearchState> {
  SearchNotifier(this._ref) : super(const SearchState());

  final Ref _ref;

  void updateQuery(String query) {
    state = state.copyWith(query: query);
    _run();
  }

  Future<void> _run() async {
    final query = state.query.trim().toLowerCase();
    if (query.isEmpty) {
      state = state.copyWith(results: const [], searching: false);
      return;
    }
    state = state.copyWith(searching: true);
    final threads = _ref.read(threadsProvider).messages;
    final results = threads.where((m) {
      return m.subject.toLowerCase().contains(query) ||
          m.fromEmail.toLowerCase().contains(query) ||
          m.preview.toLowerCase().contains(query) ||
          m.toEmail.toLowerCase().contains(query);
    }).toList(growable: false);
    state = state.copyWith(results: results, searching: false);
  }
}

final searchProvider =
    StateNotifierProvider<SearchNotifier, SearchState>((ref) {
  return SearchNotifier(ref);
});
