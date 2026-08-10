import 'package:flutter/cupertino.dart';

import '../../../models/message.dart';
import '../../../theme/colors.dart';
import 'thread_list_item.dart';

/// Gmail-style compact thread list (~72pt rows, 16pt horizontal padding).
class ThreadList extends StatelessWidget {
  const ThreadList({
    super.key,
    required this.messages,
    required this.onOpen,
    required this.onToggleStar,
    required this.onMarkRead,
    this.shrinkWrap = false,
  });
  final List<Message> messages;
  final ValueChanged<Message> onOpen;
  final ValueChanged<Message> onToggleStar;
  final void Function(Message, bool) onMarkRead;
  final bool shrinkWrap;

  @override
  Widget build(BuildContext context) {
    return ListView.separated(
      shrinkWrap: shrinkWrap,
      physics: shrinkWrap ? const NeverScrollableScrollPhysics() : null,
      itemCount: messages.length,
      separatorBuilder: (_, __) => const _Divider(),
      itemBuilder: (context, index) {
        final m = messages[index];
        return ThreadListItem(
          message: m,
          onTap: () => onOpen(m),
          onToggleStar: () => onToggleStar(m),
          onSwipeArchive: () => onMarkRead(m, true),
          onSwipeDelete: () => onMarkRead(m, true),
        );
      },
    );
  }
}

class _Divider extends StatelessWidget {
  const _Divider();
  @override
  Widget build(BuildContext context) {
    final colors = ThemeColors.of(context);
    return Container(margin: const EdgeInsets.only(left: 72), height: 0.5, color: colors.divider);
  }
}
