/// A single inbound message (list item shape returned by `/mobile/inbox`).
class Message {
  const Message({
    required this.id,
    required this.fromEmail,
    required this.toEmail,
    required this.subject,
    required this.preview,
    required this.receivedAt,
    required this.attachmentCount,
    this.toEmails = const [],
    this.ccEmails = const [],
    this.messageId,
    this.inReplyTo,
    this.references,
    this.readAt,
    this.starred = false,
  });

  final String id;
  final String fromEmail;
  final String toEmail;
  final List<String> toEmails;
  final List<String> ccEmails;
  final String subject;
  final String preview;
  final String receivedAt;
  final int attachmentCount;
  final String? messageId;
  final String? inReplyTo;
  final String? references;
  final String? readAt;
  final bool starred;

  bool get isUnread => readAt == null;

  DateTime get receivedAtDateTime => DateTime.tryParse(receivedAt) ?? DateTime.now();

  factory Message.fromJson(Map<String, dynamic> json) => Message(
        id: json['key'] as String? ?? json['id'] as String? ?? '',
        fromEmail: json['fromEmail'] as String? ?? '',
        toEmail: json['toEmail'] as String? ?? '',
        toEmails: (json['toEmails'] as List<dynamic>? ?? const [])
            .map((e) => e.toString())
            .toList(growable: false),
        ccEmails: (json['ccEmails'] as List<dynamic>? ?? const [])
            .map((e) => e.toString())
            .toList(growable: false),
        subject: json['subject'] as String? ?? '(no subject)',
        preview: json['bodyPreview'] as String? ?? '',
        receivedAt: json['receivedAt'] as String? ?? '',
        attachmentCount: json['attachmentCount'] as int? ?? 0,
        messageId: json['messageId'] as String?,
        inReplyTo: json['inReplyTo'] as String?,
        references: json['references'] as String?,
        readAt: json['readAt'] as String?,
      );

  Map<String, dynamic> toJson() => {
        'key': id,
        'fromEmail': fromEmail,
        'toEmail': toEmail,
        'toEmails': toEmails,
        'ccEmails': ccEmails,
        'subject': subject,
        'bodyPreview': preview,
        'receivedAt': receivedAt,
        'attachmentCount': attachmentCount,
        'messageId': messageId,
        'inReplyTo': inReplyTo,
        'references': references,
        'readAt': readAt,
        'starred': starred,
      };

  Message copyWith({
    String? readAt,
    bool? starred,
  }) =>
      Message(
        id: id,
        fromEmail: fromEmail,
        toEmail: toEmail,
        toEmails: toEmails,
        ccEmails: ccEmails,
        subject: subject,
        preview: preview,
        receivedAt: receivedAt,
        attachmentCount: attachmentCount,
        messageId: messageId,
        inReplyTo: inReplyTo,
        references: references,
        readAt: readAt ?? this.readAt,
        starred: starred ?? this.starred,
      );
}
