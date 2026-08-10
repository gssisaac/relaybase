/// Attachment metadata for an inbound message.
class Attachment {
  const Attachment({
    required this.id,
    required this.filename,
    required this.contentType,
    required this.size,
    this.disposition,
    this.contentId,
  });

  final String id;
  final String filename;
  final String contentType;
  final int size;
  final String? disposition;
  final String? contentId;

  bool get isInline => disposition == 'inline';

  factory Attachment.fromJson(Map<String, dynamic> json) => Attachment(
        id: json['id'] as String? ?? '',
        filename: json['filename'] as String? ?? 'attachment',
        contentType: json['contentType'] as String? ?? 'application/octet-stream',
        size: (json['size'] as num?)?.toInt() ?? 0,
        disposition: json['disposition'] as String?,
        contentId: json['contentId'] as String?,
      );

  Map<String, dynamic> toJson() => {
        'id': id,
        'filename': filename,
        'contentType': contentType,
        'size': size,
        if (disposition != null) 'disposition': disposition,
        if (contentId != null) 'contentId': contentId,
      };
}
