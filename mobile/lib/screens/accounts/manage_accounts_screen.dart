import 'package:flutter/cupertino.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../models/account.dart';
import '../../providers/auth_provider.dart';
import '../../providers/managed_accounts_provider.dart';
import '../../theme/colors.dart';
import '../../theme/radii.dart';
import '../../widgets/avatar.dart';

/// Manage stored accounts: tap a row to switch to it, tap the trailing
/// remove icon to remove it (with confirmation). Removing the last account
/// signs the user out and returns them to the Connect screen.
class ManageAccountsScreen extends ConsumerWidget {
  const ManageAccountsScreen({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final colors = ThemeColors.of(context);
    final managed = ref.watch(managedAccountsProvider);
    final auth = ref.watch(authProvider);
    return CupertinoPageScaffold(
      backgroundColor: colors.surface,
      child: SafeArea(
        child: Column(
          children: [
            _topBar(context, colors),
            Expanded(
              child: managed.accounts.isEmpty
                  ? _empty(colors)
                  : ListView.builder(
                      padding: const EdgeInsets.symmetric(vertical: 8),
                      itemCount: managed.accounts.length,
                      itemBuilder: (context, i) => _accountRow(
                        context,
                        ref,
                        colors,
                        managed.accounts[i],
                        isActive: managed.accounts[i].email == managed.activeEmail,
                        removing: auth.loading,
                      ),
                    ),
            ),
          ],
        ),
      ),
    );
  }

  Widget _topBar(BuildContext context, ThemeColors colors) {
    return Container(
      height: 52,
      padding: const EdgeInsets.symmetric(horizontal: 4),
      child: Row(
        children: [
          CupertinoButton(
            padding: EdgeInsets.zero,
            minSize: 44,
            onPressed: () => Navigator.of(context).pop(),
            child: const Icon(CupertinoIcons.back, size: 24),
          ),
          const SizedBox(width: 8),
          Text(
            'Manage accounts',
            style: TextStyle(fontSize: 18, fontWeight: FontWeight.w600, color: colors.onSurface),
          ),
        ],
      ),
    );
  }

  Widget _empty(ThemeColors colors) {
    return Center(
      child: Padding(
        padding: const EdgeInsets.all(32),
        child: Text(
          'No accounts yet. Use “Add account” to sign in.',
          textAlign: TextAlign.center,
          style: TextStyle(fontSize: 15, color: colors.onSurfaceVariant),
        ),
      ),
    );
  }

  Widget _accountRow(
    BuildContext context,
    WidgetRef ref,
    ThemeColors colors,
    Account account, {
    required bool isActive,
    required bool removing,
  }) {
    final email = account.email;
    final label = account.label;
    return Container(
      margin: const EdgeInsets.symmetric(horizontal: 16, vertical: 4),
      decoration: BoxDecoration(
        color: colors.surfaceVariant,
        borderRadius: AppRadii.field,
      ),
      child: Row(
        children: [
          Expanded(
            child: CupertinoButton(
              padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 12),
              onPressed: removing
                  ? null
                  : () async {
                      if (!isActive) {
                        await ref.read(authProvider.notifier).switchAccount(email);
                      }
                      if (context.mounted) Navigator.of(context).pop();
                    },
              child: Row(
                children: [
                  Avatar(initials: account.initials, email: email, size: 44),
                  const SizedBox(width: 12),
                  Expanded(
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Text(
                          label,
                          maxLines: 1,
                          overflow: TextOverflow.ellipsis,
                          style: TextStyle(
                            fontSize: 15,
                            fontWeight: FontWeight.w600,
                            color: colors.onSurface,
                          ),
                        ),
                        const SizedBox(height: 2),
                        Text(
                          email,
                          maxLines: 1,
                          overflow: TextOverflow.ellipsis,
                          style: TextStyle(fontSize: 13, color: colors.onSurfaceVariant),
                        ),
                      ],
                    ),
                  ),
                  if (isActive)
                    Icon(CupertinoIcons.checkmark_alt_circle_fill, size: 22, color: colors.primary),
                ],
              ),
            ),
          ),
          CupertinoButton(
            padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 12),
            onPressed: removing ? null : () => _confirmRemove(context, ref, email, label),
            child: Icon(CupertinoIcons.delete_simple, size: 22, color: colors.delete),
          ),
        ],
      ),
    );
  }

  void _confirmRemove(BuildContext context, WidgetRef ref, String email, String label) {
    showCupertinoDialog<void>(
      context: context,
      builder: (c) => CupertinoAlertDialog(
        title: const Text('Remove account?'),
        content: Text(
          '“$label” will be removed from this device. You can add it again later.',
        ),
        actions: [
          CupertinoDialogAction(
            isDefaultAction: true,
            onPressed: () => Navigator.of(c).pop(),
            child: const Text('Cancel'),
          ),
          CupertinoDialogAction(
            isDestructiveAction: true,
            onPressed: () async {
              Navigator.of(c).pop();
              await ref.read(authProvider.notifier).removeAccount(email);
            },
            child: const Text('Remove'),
          ),
        ],
      ),
    );
  }
}
