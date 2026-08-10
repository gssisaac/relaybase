import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../models/account.dart';
import '../services/mobile_api_service.dart' show AddressCounts;
import 'app_providers.dart';
import 'auth_provider.dart';

class AccountsState {
  const AccountsState({
    this.accounts = const [],
    this.counts = const {},
    this.loading = false,
    this.error,
  });

  final List<Account> accounts;
  final Map<String, AddressCounts> counts;
  final bool loading;
  final String? error;

  AccountsState copyWith({
    List<Account>? accounts,
    Map<String, AddressCounts>? counts,
    bool? loading,
    String? error,
  }) =>
      AccountsState(
        accounts: accounts ?? this.accounts,
        counts: counts ?? this.counts,
        loading: loading ?? this.loading,
        error: error ?? this.error,
      );
}

class AccountsNotifier extends StateNotifier<AccountsState> {
  AccountsNotifier(this._ref) : super(const AccountsState());

  final Ref _ref;

  Future<void> refresh() async {
    if (!_ref.read(authProvider).isConfigured) return;
    state = state.copyWith(loading: true, error: null);
    try {
      final api = _ref.read(mobileApiProvider);
      final accounts = await api.fetchMailbox();
      final counts = await api.fetchCounts();
      final merged = accounts
          .map((a) => a.copyWith(unreadCount: counts[a.email]?.unread ?? 0))
          .toList(growable: false);
      state = state.copyWith(accounts: merged, counts: counts, loading: false);
      final storage = await _ref.read(storageServiceProvider.future);
      await storage.saveAccounts(merged);
    } catch (e) {
      // Fall back to cache.
      final storage = await _ref.read(storageServiceProvider.future);
      final cached = storage.loadAccounts();
      state = state.copyWith(accounts: cached, loading: false, error: e.toString());
    }
  }
}

final accountsProvider =
    StateNotifierProvider<AccountsNotifier, AccountsState>((ref) {
  return AccountsNotifier(ref);
});
