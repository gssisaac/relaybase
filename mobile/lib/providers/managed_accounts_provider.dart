import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../models/account.dart';
import '../services/mobile_api_service.dart' show AddressCounts;
import 'accounts_provider.dart';
import 'auth_provider.dart';

/// Source of truth for the account list shown in the drawer and the manage
/// accounts screen. The list itself lives in [AuthProvider] (backed by the
/// secure store); this provider exposes it as [Account] objects (no
/// passwords) and merges unread counts for the active account when available.
class ManagedAccountsState {
  const ManagedAccountsState({
    this.accounts = const [],
    this.activeEmail = '',
  });

  final List<Account> accounts;
  final String activeEmail;

  Account? get active => accounts.isEmpty
      ? null
      : accounts.firstWhere(
          (a) => a.email == activeEmail,
          orElse: () => accounts.first,
        );
}

final managedAccountsProvider = Provider<ManagedAccountsState>((ref) {
  final auth = ref.watch(authProvider);
  final counts = ref.watch(accountsProvider).counts;
  final merged = auth.managedAccounts
      .map((a) => a.copyWith(unreadCount: counts[a.email]?.unread ?? 0))
      .toList(growable: false);
  return ManagedAccountsState(
    accounts: merged,
    activeEmail: auth.config?.normalizedAccountEmail ?? '',
  );
});

/// Re-export so consumers can import only managed_accounts_provider.
typedef ManagedAddressCounts = AddressCounts;
