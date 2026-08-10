import 'package:flutter/cupertino.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../models/message.dart';
import '../../../providers/threads_provider.dart' show previewProvider;
import '../../../theme/colors.dart';
import '../../../utils/date_format.dart';
import '../../../widgets/avatar.dart';
import '../../../widgets/swipe_action.dart';

/// A single Gmail-like inbox row: avatar, sender, subject, preview,
/// timestamp, star. Swipe right = archive, swipe left = delete.
class ThreadListItem extends ConsumerWidget {
  const ThreadListItem({
    super.key,
    required this.message,
    required this.onTap,
    required this.onToggleStar,
    required this.onSwipeArchive,
    required this.onSwipeDelete,
  });
  final Message message;
  final VoidCallback onTap;
  final VoidCallback onToggleStar;
  final VoidCallback onSwipeArchive;
  final VoidCallback onSwipeDelete;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final colors = ThemeColors.of(context);
    final unread = message.isUnread;
    final preview = ref.watch(previewProvider(message));

    return SwipeAction(
      direction: SwipeDirection.right,
      icon: CupertinoIcons.archivebox_fill,
      label: 'Archive',
      color: colors.archive,
      onTriggered: onSwipeArchive,
      child: SwipeAction(
        direction: SwipeDirection.left,
        icon: CupertinoIcons.trash_fill,
        label: 'Delete',
        color: colors.delete,
        onTriggered: onSwipeDelete,
        child: CupertinoButton(
          padding: EdgeInsets.zero,
          minSize: 0,
          onPressed: onTap,
          child: Container(
            color: unread ? colors.primary.withValues(alpha: 0.04) : colors.surface,
            padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 12),
            child: Row(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Avatar(initials: _initials(message.fromEmail), email: message.fromEmail, size: 40),
                const SizedBox(width: 12),
                Expanded(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Row(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          Expanded(
                            child: Text(
                              _senderName(message.fromEmail),
                              maxLines: 1,
                              overflow: TextOverflow.ellipsis,
                              style: TextStyle(
                                fontSize: 15,
                                fontWeight: unread ? FontWeight.w700 : FontWeight.w500,
                                color: colors.onSurface,
                              ),
                            ),
                          ),
                          const SizedBox(width: 8),
                          Text(
                            DateFormatter.format(message.receivedAtDateTime),
                            style: TextStyle(
                              fontSize: 12,
                              color: unread ? colors.primary : colors.onSurfaceVariant,
                              fontWeight: unread ? FontWeight.w600 : FontWeight.w400,
                            ),
                          ),
                        ],
                      ),
                      const SizedBox(height: 2),
                      Row(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          Expanded(
                            child: Text(
                              message.subject,
                              maxLines: 1,
                              overflow: TextOverflow.ellipsis,
                              style: TextStyle(
                                fontSize: 14,
                                fontWeight: unread ? FontWeight.w700 : FontWeight.w500,
                                color: colors.onSurface,
                              ),
                            ),
                          ),
                          GestureDetector(
                            onTap: onToggleStar,
                            child: Icon(
                              message.starred ? CupertinoIcons.star_fill : CupertinoIcons.star,
                              size: 18,
                              color: message.starred ? colors.star : colors.onSurfaceVariant,
                            ),
                          ),
                        ],
                      ),
                      const SizedBox(height: 2),
                      Text(
                        preview,
                        maxLines: 1,
                        overflow: TextOverflow.ellipsis,
                        style: TextStyle(fontSize: 13, color: colors.onSurfaceVariant),
                      ),
                      if (message.attachmentCount > 0) ...[
                        const SizedBox(height: 4),
                        Row(
                          children: [
                            Icon(CupertinoIcons.paperclip, size: 14, color: colors.onSurfaceVariant),
                            const SizedBox(width: 4),
                            Text(
                              '${message.attachmentCount}',
                              style: TextStyle(fontSize: 12, color: colors.onSurfaceVariant),
                            ),
                          ],
                        ),
                      ],
                    ],
                  ),
                ),
              ],
            ),
          ),
        ),
      ),
    );
  }

  String _initials(String from) {
    final name = from.split('<').first.trim();
    final source = name.isEmpty ? from : name;
    final parts = source.split(RegExp(r'[\s@_.]+')).where((p) => p.isNotEmpty).toList();
    if (parts.length >= 2) {
      return '${parts.first[0]}${parts[1][0]}'.toUpperCase();
    }
    return source.length >= 2 ? source.substring(0, 2).toUpperCase() : source.toUpperCase();
  }

  String _senderName(String from) {
    final name = from.split('<').first.trim();
    return name.isEmpty ? from : name;
  }
}
