import 'package:flutter/cupertino.dart';

import '../../../models/attachment.dart';
import '../../../theme/colors.dart';
import '../../../theme/radii.dart';

/// Attachment chips for a message card.
class AttachmentList extends StatelessWidget {
  const AttachmentList({super.key, required this.attachments});
  final List<Attachment> attachments;

  @override
  Widget build(BuildContext context) {
    final colors = ThemeColors.of(context);
    return Wrap(
      spacing: 8,
      runSpacing: 8,
      children: attachments
          .where((a) => !a.isInline)
          .map((a) => _chip(a, colors))
          .toList(growable: false),
    );
  }

  Widget _chip(Attachment a, ThemeColors colors) {
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 8),
      decoration: BoxDecoration(
        color: colors.surfaceVariant,
        borderRadius: AppRadii.button,
        border: Border.all(color: colors.divider),
      ),
      child: Row(
        mainAxisSize: MainAxisSize.min,
        children: [
          Icon(_iconFor(a.contentType), size: 18, color: colors.primary),
          const SizedBox(width: 8),
          Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Text(
                a.filename,
                maxLines: 1,
                overflow: TextOverflow.ellipsis,
                style: TextStyle(fontSize: 13, fontWeight: FontWeight.w500, color: colors.onSurface),
              ),
              Text(
                _sizeLabel(a.size),
                style: TextStyle(fontSize: 11, color: colors.onSurfaceVariant),
              ),
            ],
          ),
        ],
      ),
    );
  }

  IconData _iconFor(String contentType) {
    if (contentType.startsWith('image/')) return CupertinoIcons.photo;
    if (contentType.startsWith('video/')) return CupertinoIcons.film;
    if (contentType.startsWith('audio/')) return CupertinoIcons.music_note;
    if (contentType.contains('pdf')) return CupertinoIcons.doc_richtext;
    return CupertinoIcons.doc;
  }

  String _sizeLabel(int bytes) {
    if (bytes < 1024) return '$bytes B';
    if (bytes < 1024 * 1024) return '${(bytes / 1024).toStringAsFixed(1)} KB';
    return '${(bytes / 1024 / 1024).toStringAsFixed(1)} MB';
  }
}
