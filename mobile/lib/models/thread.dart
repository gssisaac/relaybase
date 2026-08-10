import 'message.dart';
import 'attachment.dart';

/// Full message detail returned by `/mobile/inbox/:id`.
class MessageDetail {
  const MessageDetail({
    required this.id,
    required this.fromEmail,
    required this.toEmail,
    required this.subject,
    required this.bodyText,
    required this.receivedAt,
    required this.attachments,
    this.toEmails = const [],
    this.ccEmails = const [],
    this.bodyHtml,
    this.messageId,
    this.inReplyTo,
    this.references,
    this.readAt,
  });

  final String id;
  final String fromEmail;
  final String toEmail;
  final List<String> toEmails;
  final List<String> ccEmails;
  final String subject;
  final String bodyText;
  final String? bodyHtml;
  final String receivedAt;
  final List<Attachment> attachments;
  final String? messageId;
  final String? inReplyTo;
  final String? references;
  final String? readAt;

  bool get isUnread => readAt == null;

  factory MessageDetail.fromJson(Map<String, dynamic> json) => MessageDetail(
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
        bodyText: json['bodyText'] as String? ?? '',
        bodyHtml: json['bodyHtml'] as String?,
        receivedAt: json['receivedAt'] as String? ?? '',
        attachments: (json['attachments'] as List<dynamic>? ?? const [])
            .map((e) => Attachment.fromJson(e as Map<String, dynamic>))
            .toList(growable: false),
        messageId: json['messageId'] as String?,
        inReplyTo: json['inReplyTo'] as String?,
        references: json['references'] as String?,
        readAt: json['readAt'] as String?,
      );

  Message toListItem() => Message(
        id: id,
        fromEmail: fromEmail,
        toEmail: toEmail,
        toEmails: toEmails,
        ccEmails: ccEmails,
        subject: subject,
        preview: bodyText,
        receivedAt: receivedAt,
        attachmentCount: attachments.length,
        messageId: messageId,
        inReplyTo: inReplyTo,
        references: references,
        readAt: readAt,
      );

  Map<String, dynamic> toJson() => {
        'key': id,
        'fromEmail': fromEmail,
        'toEmail': toEmail,
        'toEmails': toEmails,
        'ccEmails': ccEmails,
        'subject': subject,
        'bodyText': bodyText,
        if (bodyHtml != null) 'bodyHtml': bodyHtml,
        'receivedAt': receivedAt,
        'attachments': attachments.map((a) => a.toJson()).toList(),
        'messageId': messageId,
        'inReplyTo': inReplyTo,
        'references': references,
        'readAt': readAt,
      };
}
