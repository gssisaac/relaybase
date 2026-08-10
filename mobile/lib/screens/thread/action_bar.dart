import 'package:flutter/cupertino.dart';

import '../../../theme/colors.dart';

/// Bottom action bar: Reply, Reply all, Forward.
class ActionBar extends StatelessWidget {
  const ActionBar({
    super.key,
    required this.onReply,
    required this.onReplyAll,
    required this.onForward,
  });
  final VoidCallback onReply;
  final VoidCallback onReplyAll;
  final VoidCallback onForward;

  @override
  Widget build(BuildContext context) {
    final colors = ThemeColors.of(context);
    return Container(
      decoration: BoxDecoration(
        color: colors.surface,
        border: Border(top: BorderSide(color: colors.divider, width: 0.5)),
      ),
      padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 6),
      child: Row(
        mainAxisAlignment: MainAxisAlignment.spaceAround,
        children: [
          _action(CupertinoIcons.arrow_turn_up_left, 'Reply', colors, onReply),
          _action(CupertinoIcons.arrow_2_circlepath, 'Reply all', colors, onReplyAll),
          _action(CupertinoIcons.arrow_turn_up_right, 'Forward', colors, onForward),
        ],
      ),
    );
  }

  Widget _action(IconData icon, String label, ThemeColors colors, VoidCallback onTap) {
    return CupertinoButton(
      padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 8),
      onPressed: onTap,
      child: Column(
        mainAxisSize: MainAxisSize.min,
        children: [
          Icon(icon, size: 22, color: colors.primary),
          const SizedBox(height: 2),
          Text(label, style: TextStyle(fontSize: 12, color: colors.primary, fontWeight: FontWeight.w500)),
        ],
      ),
    );
  }
}
