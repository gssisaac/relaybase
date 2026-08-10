import 'package:flutter/cupertino.dart';

import '../../../providers/threads_provider.dart';
import '../../../theme/colors.dart';

/// Drawer folder list: Inbox, Starred, Sent, Drafts, Trash, All Mail.
class FolderList extends StatelessWidget {
  const FolderList({
    super.key,
    required this.current,
    required this.counts,
    required this.onSelect,
  });
  final Folder current;
  final Map<Folder, int> counts;
  final ValueChanged<Folder> onSelect;

  @override
  Widget build(BuildContext context) {
    final colors = ThemeColors.of(context);
    return ListView(
      padding: const EdgeInsets.symmetric(vertical: 8),
      children: [
        _row(CupertinoIcons.tray, 'Inbox', Folder.inbox, colors),
        _row(CupertinoIcons.star_fill, 'Starred', Folder.starred, colors),
        _row(CupertinoIcons.paperplane, 'Sent', Folder.sent, colors),
        _row(CupertinoIcons.doc_text, 'Drafts', Folder.drafts, colors),
        _row(CupertinoIcons.trash, 'Trash', Folder.trash, colors),
        _row(CupertinoIcons.mail, 'All Mail', Folder.allMail, colors),
      ],
    );
  }

  Widget _row(IconData icon, String label, Folder folder, ThemeColors colors) {
    final selected = folder == current;
    final unread = counts[folder] ?? 0;
    return Container(
      margin: const EdgeInsets.symmetric(horizontal: 8, vertical: 1),
      decoration: BoxDecoration(
        color: selected ? colors.primary.withOpacity(0.12) : CupertinoColors.transparent,
        borderRadius: BorderRadius.circular(24),
      ),
      child: CupertinoButton(
        padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 10),
        onPressed: () => onSelect(folder),
        child: Row(
          children: [
            Icon(icon, size: 22, color: selected ? colors.primary : colors.onSurfaceVariant),
            const SizedBox(width: 16),
            Expanded(
              child: Text(
                label,
                style: TextStyle(
                  fontSize: 15,
                  color: colors.onSurface,
                  fontWeight: selected ? FontWeight.w600 : FontWeight.w400,
                ),
              ),
            ),
            if (unread > 0)
              Text('$unread', style: TextStyle(fontSize: 13, color: colors.onSurfaceVariant)),
          ],
        ),
      ),
    );
  }
}
