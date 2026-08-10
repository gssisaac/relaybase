import 'package:flutter/cupertino.dart';

import '../../../theme/colors.dart';
import '../../../utils/date_format.dart';
import '../../../widgets/avatar.dart';

/// Collapsible message header: avatar, sender, to/cc line, date.
class MessageHeader extends StatelessWidget {
  const MessageHeader({
    super.key,
    required this.fromEmail,
    required this.toEmails,
    required this.ccEmails,
    required this.receivedAt,
    required this.avatar,
    required this.expanded,
    required this.onToggle,
  });
  final String fromEmail;
  final List<String> toEmails;
  final List<String> ccEmails;
  final String receivedAt;
  final Widget avatar;
  final bool expanded;
  final VoidCallback onToggle;

  @override
  Widget build(BuildContext context) {
    final colors = ThemeColors.of(context);
    final date = DateTime.tryParse(receivedAt);
    return GestureDetector(
      onTap: onToggle,
      child: Row(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          avatar,
          const SizedBox(width: 12),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Row(
                  children: [
                    Expanded(
                      child: Text(
                        _name(fromEmail),
                        maxLines: 1,
                        overflow: TextOverflow.ellipsis,
                        style: TextStyle(fontSize: 15, fontWeight: FontWeight.w600, color: colors.onSurface),
                      ),
                    ),
                    if (date != null)
                      Text(
                        DateFormatter.format(date),
                        style: TextStyle(fontSize: 12, color: colors.onSurfaceVariant),
                      ),
                  ],
                ),
                const SizedBox(height: 2),
                Text(
                  _recipientLine(),
                  maxLines: expanded ? 3 : 1,
                  overflow: TextOverflow.ellipsis,
                  style: TextStyle(fontSize: 13, color: colors.onSurfaceVariant),
                ),
              ],
            ),
          ),
          Icon(
            expanded ? CupertinoIcons.chevron_down : CupertinoIcons.chevron_right,
            size: 18,
            color: colors.onSurfaceVariant,
          ),
        ],
      ),
    );
  }

  String _name(String from) {
    final name = from.split('<').first.trim();
    return name.isEmpty ? from : name;
  }

  String _recipientLine() {
    final to = toEmails.join(', ');
    final cc = ccEmails.isEmpty ? '' : '  •  cc: ${ccEmails.join(', ')}';
    return 'to: $to$cc';
  }
}
