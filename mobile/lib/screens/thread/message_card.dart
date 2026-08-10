import 'package:flutter/cupertino.dart';
import 'package:flutter_widget_from_html/flutter_widget_from_html.dart';

import '../../../models/thread.dart';
import '../../../theme/colors.dart';
import '../../../widgets/avatar.dart';
import 'attachment_list.dart';
import 'message_header.dart';

/// A single stacked message card in the conversation view.
class MessageCard extends StatefulWidget {
  const MessageCard({super.key, required this.detail});
  final MessageDetail detail;

  @override
  State<MessageCard> createState() => _MessageCardState();
}

class _MessageCardState extends State<MessageCard> {
  bool _expanded = true;

  @override
  Widget build(BuildContext context) {
    final colors = ThemeColors.of(context);
    final d = widget.detail;
    return Container(
      margin: const EdgeInsets.symmetric(horizontal: 12, vertical: 6),
      padding: const EdgeInsets.all(12),
      decoration: BoxDecoration(
        color: colors.surface,
        borderRadius: BorderRadius.circular(12),
        border: Border.all(color: colors.divider),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          MessageHeader(
            fromEmail: d.fromEmail,
            toEmails: d.toEmails.isEmpty ? [d.toEmail] : d.toEmails,
            ccEmails: d.ccEmails,
            receivedAt: d.receivedAt,
            avatar: Avatar(initials: _initials(d.fromEmail), email: d.fromEmail, size: 40),
            expanded: _expanded,
            onToggle: () => setState(() => _expanded = !_expanded),
          ),
          if (_expanded) ...[
            const SizedBox(height: 12),
            _body(colors),
            if (d.attachments.isNotEmpty) ...[
              const SizedBox(height: 12),
              AttachmentList(attachments: d.attachments),
            ],
          ],
        ],
      ),
    );
  }

  Widget _body(ThemeColors colors) {
    final html = widget.detail.bodyHtml;
    final text = widget.detail.bodyText;
    final body = (html != null && html.trim().isNotEmpty) ? html : text;
    if (body.contains('<') && body.contains('>')) {
      return HtmlWidget(
        body,
        textStyle: TextStyle(fontSize: 15, color: colors.onSurface, height: 1.4),
      );
    }
    return Text(
      body,
      style: TextStyle(fontSize: 15, color: colors.onSurface, height: 1.4),
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
}
