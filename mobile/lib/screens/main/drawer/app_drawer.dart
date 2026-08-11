import 'package:flutter/cupertino.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../providers/accounts_provider.dart';
import '../../../providers/threads_provider.dart';
import '../../../theme/colors.dart';
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
    final accounts = ref.watch(accountsProvider);
    final currentEmail = accounts.accounts.isEmpty ? '' : accounts.accounts.first.email;
    return Container(
      color: colors.surface,
      child: SafeArea(
        child: Column(
          children: [
            AccountSwitcher(
              accounts: accounts.accounts,
              currentEmail: currentEmail,
              onPick: (email) {
                ref.read(threadsProvider.notifier).setAccountFilter(
                      email.isEmpty ? null : email,
                    );
              },
            ),
            Container(height: 0.5, color: colors.divider),
            Expanded(
              child: FolderList(
                current: currentFolder,
                counts: _folderCounts(accounts),
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

  Map<Folder, int> _folderCounts(AccountsState state) {
    final unread = state.counts.values.fold<int>(0, (a, c) => a + c.unread);
    return {Folder.inbox: unread};
  }
}
