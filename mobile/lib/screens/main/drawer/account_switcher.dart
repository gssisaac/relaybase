import 'package:flutter/cupertino.dart';

import '../../../models/account.dart';
import '../../../theme/colors.dart';
import '../../../widgets/avatar.dart';

/// Drawer header: current account avatar + email + dropdown to switch.
class AccountSwitcher extends StatefulWidget {
  const AccountSwitcher({
    super.key,
    required this.accounts,
    required this.currentEmail,
    required this.onPick,
  });
  final List<Account> accounts;
  final String currentEmail;
  final ValueChanged<String> onPick;

  @override
  State<AccountSwitcher> createState() => _AccountSwitcherState();
}

class _AccountSwitcherState extends State<AccountSwitcher> {
  bool _expanded = false;

  Account get _current => widget.accounts.firstWhere(
        (a) => a.email == widget.currentEmail,
        orElse: () => widget.accounts.isEmpty
            ? const Account(email: '', domain: '')
            : widget.accounts.first,
      );

  @override
  Widget build(BuildContext context) {
    final colors = ThemeColors.of(context);
    final current = _current;
    // A team member only has access to their own account, so the switcher
    // is a static header (no dropdown) when there's a single account.
    final canSwitch = widget.accounts.length > 1;
    return Container(
      padding: const EdgeInsets.fromLTRB(16, 20, 16, 16),
      color: colors.surface,
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          GestureDetector(
            behavior: canSwitch ? HitTestBehavior.opaque : HitTestBehavior.deferToChild,
            onTap: canSwitch ? () => setState(() => _expanded = !_expanded) : null,
            child: Row(
              children: [
                if (current.email.isEmpty)
                  Container(
                    width: 48,
                    height: 48,
                    decoration: BoxDecoration(color: colors.surfaceVariant, shape: BoxShape.circle),
                    child: Icon(CupertinoIcons.person_fill, color: colors.onSurfaceVariant),
                  )
                else
                  Avatar(initials: current.initials, email: current.email, size: 48),
                const SizedBox(width: 12),
                Expanded(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Text(
                        current.label,
                        maxLines: 1,
                        overflow: TextOverflow.ellipsis,
                        style: TextStyle(fontSize: 16, fontWeight: FontWeight.w600, color: colors.onSurface),
                      ),
                      const SizedBox(height: 2),
                      Text(
                        current.email.isEmpty ? 'No accounts' : current.email,
                        maxLines: 1,
                        overflow: TextOverflow.ellipsis,
                        style: TextStyle(fontSize: 13, color: colors.onSurfaceVariant),
                      ),
                    ],
                  ),
                ),
                if (canSwitch)
                  Icon(
                    _expanded ? CupertinoIcons.chevron_up : CupertinoIcons.chevron_down,
                    size: 18,
                    color: colors.onSurfaceVariant,
                  ),
              ],
            ),
          ),
          if (canSwitch && _expanded) ...[
            const SizedBox(height: 8),
            ...widget.accounts.map((a) => _option(a, colors)),
          ],
        ],
      ),
    );
  }

  Widget _option(Account a, ThemeColors colors) {
    final selected = a.email == widget.currentEmail;
    return _item(
      icon: null,
      avatar: Avatar(initials: a.initials, email: a.email, size: 28),
      label: a.label,
      colors: colors,
      trailing: a.unreadCount > 0 ? Text('${a.unreadCount}', style: TextStyle(color: colors.onSurfaceVariant, fontSize: 13)) : null,
      onTap: () {
        widget.onPick(a.email);
        setState(() => _expanded = false);
      },
      selected: selected,
    );
  }

  Widget _item({
    IconData? icon,
    Widget? avatar,
    required String label,
    required ThemeColors colors,
    Widget? trailing,
    bool selected = false,
    required VoidCallback onTap,
  }) {
    return CupertinoButton(
      padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 8),
      onPressed: onTap,
      child: Row(
        children: [
          if (avatar != null) avatar else if (icon != null) Icon(icon, size: 22, color: colors.onSurfaceVariant),
          const SizedBox(width: 12),
          Expanded(
            child: Text(
              label,
              maxLines: 1,
              overflow: TextOverflow.ellipsis,
              style: TextStyle(
                fontSize: 14,
                color: colors.onSurface,
                fontWeight: selected ? FontWeight.w600 : FontWeight.w400,
              ),
            ),
          ),
          if (trailing != null) trailing,
        ],
      ),
    );
  }
}
