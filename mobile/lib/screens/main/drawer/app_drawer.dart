import 'package:flutter/cupertino.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../providers/accounts_provider.dart';
import '../../../providers/auth_provider.dart';
import '../../../providers/managed_accounts_provider.dart';
import '../../../providers/threads_provider.dart';
import '../../../theme/colors.dart';
import '../../accounts/add_account_screen.dart';
import '../../accounts/manage_accounts_screen.dart';
import '../../settings/settings_screen.dart';
import 'account_switcher.dart';
import 'folder_list.dart';

/// Gmail-style left navigation drawer: account header + folder list + footer.
class AppDrawer extends ConsumerWidget {
  const AppDrawer({
    super.key,
    required this.currentFolder,
    required this.onSelectFolder,
    required this.onSignOut,
  });
  final Folder currentFolder;
  final ValueChanged<Folder> onSelectFolder;
  final VoidCallback onSignOut;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final colors = ThemeColors.of(context);
    final managed = ref.watch(managedAccountsProvider);
    final accounts = managed.accounts;
    final currentEmail = managed.activeEmail;
    return Container(
      color: colors.surface,
      child: SafeArea(
        child: Column(
          children: [
            AccountSwitcher(
              accounts: accounts,
              currentEmail: currentEmail,
              onPick: (email) {
                if (email.isEmpty) return;
                ref.read(authProvider.notifier).switchAccount(email);
              },
            ),
            Container(height: 0.5, color: colors.divider),
            _accountActions(context, colors, accounts.length),
            Container(height: 0.5, color: colors.divider),
            Expanded(
              child: FolderList(
                current: currentFolder,
                counts: _folderCounts(ref),
                onSelect: onSelectFolder,
              ),
            ),
            Container(height: 0.5, color: colors.divider),
            _footer(context, colors),
          ],
        ),
      ),
    );
  }

  Widget _accountActions(BuildContext context, ThemeColors colors, int accountCount) {
    return Padding(
      padding: const EdgeInsets.symmetric(vertical: 4),
      child: Column(
        children: [
          _actionRow(
            context,
            icon: CupertinoIcons.person_add,
            label: 'Add account',
            colors: colors,
            onTap: () => Navigator.of(context).push(
              CupertinoPageRoute<void>(builder: (_) => const AddAccountScreen()),
            ),
          ),
          _actionRow(
            context,
            icon: CupertinoIcons.person_2_square_stack,
            label: 'Manage accounts',
            colors: colors,
            trailing: accountCount > 0 ? '$accountCount' : null,
            onTap: () => Navigator.of(context).push(
              CupertinoPageRoute<void>(
                builder: (_) => const ManageAccountsScreen(),
              ),
            ),
          ),
        ],
      ),
    );
  }

  Widget _footer(BuildContext context, ThemeColors colors) {
    return Padding(
      padding: const EdgeInsets.symmetric(vertical: 8),
      child: Column(
        children: [
          _row(CupertinoIcons.gear, 'Settings', colors, () {
            Navigator.of(context).push(
              CupertinoPageRoute<void>(builder: (_) => const SettingsScreen()),
            );
          }),
          _row(CupertinoIcons.square_arrow_right, 'Sign out', colors, onSignOut, destructive: true),
        ],
      ),
    );
  }

  Widget _row(IconData icon, String label, ThemeColors colors, VoidCallback onTap, {bool destructive = false}) {
    return CupertinoButton(
      padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 10),
      onPressed: onTap,
      child: Row(
        children: [
          Icon(icon, size: 22, color: destructive ? colors.delete : colors.onSurfaceVariant),
          const SizedBox(width: 16),
          Text(
            label,
            style: TextStyle(fontSize: 15, color: destructive ? colors.delete : colors.onSurface),
          ),
        ],
      ),
    );
  }

  Widget _actionRow(
    BuildContext context, {
    required IconData icon,
    required String label,
    required ThemeColors colors,
    required VoidCallback onTap,
    String? trailing,
  }) {
    return CupertinoButton(
      padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 10),
      onPressed: onTap,
      child: Row(
        children: [
          Icon(icon, size: 22, color: colors.onSurfaceVariant),
          const SizedBox(width: 16),
          Expanded(
            child: Text(
              label,
              style: TextStyle(fontSize: 15, color: colors.onSurface),
            ),
          ),
          if (trailing != null)
            Text(
              trailing,
              style: TextStyle(fontSize: 14, color: colors.onSurfaceVariant),
            ),
          const SizedBox(width: 6),
          Icon(CupertinoIcons.chevron_right, size: 16, color: colors.onSurfaceVariant),
        ],
      ),
    );
  }

  Map<Folder, int> _folderCounts(WidgetRef ref) {
    final unread = ref.watch(accountsProvider).counts.values.fold<int>(0, (a, c) => a + c.unread);
    return {Folder.inbox: unread};
  }
}
