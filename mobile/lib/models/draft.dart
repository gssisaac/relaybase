/// A compose draft. Autosaved to Hive; sent via `/mobile/send`.
class DraftEmail {
  const DraftEmail({
    required this.id,
    this.from,
    this.to = const [],
    this.cc = const [],
    this.bcc = const [],
    this.subject = '',
    this.body = '',
    this.inReplyTo,
    this.references,
    this.updatedAt,
  });

  final String id;
  final String? from;
  final List<String> to;
  final List<String> cc;
  final List<String> bcc;
  final String subject;
  final String body;
  final String? inReplyTo;
  final String? references;
  final DateTime? updatedAt;

  bool get isEmpty =>
      (from == null || from!.isEmpty) &&
      to.isEmpty &&
      cc.isEmpty &&
      bcc.isEmpty &&
      subject.trim().isEmpty &&
      body.trim().isEmpty;

  DraftEmail copyWith({
    String? from,
    List<String>? to,
    List<String>? cc,
    List<String>? bcc,
    String? subject,
    String? body,
    String? inReplyTo,
    String? references,
    DateTime? updatedAt,
  }) =>
      DraftEmail(
        id: id,
        from: from ?? this.from,
        to: to ?? this.to,
        cc: cc ?? this.cc,
        bcc: bcc ?? this.bcc,
        subject: subject ?? this.subject,
        body: body ?? this.body,
        inReplyTo: inReplyTo ?? this.inReplyTo,
        references: references ?? this.references,
        updatedAt: updatedAt ?? this.updatedAt,
      );

  Map<String, dynamic> toJson() => {
        'id': id,
        'from': from,
        'to': to,
        'cc': cc,
        'bcc': bcc,
        'subject': subject,
        'body': body,
        'inReplyTo': inReplyTo,
        'references': references,
        'updatedAt': updatedAt?.toIso8601String(),
      };

  factory DraftEmail.fromJson(Map<String, dynamic> json) => DraftEmail(
        id: json['id'] as String? ?? '',
        from: json['from'] as String?,
        to: (json['to'] as List<dynamic>? ?? const [])
            .map((e) => e.toString())
            .toList(growable: false),
        cc: (json['cc'] as List<dynamic>? ?? const [])
            .map((e) => e.toString())
            .toList(growable: false),
        bcc: (json['bcc'] as List<dynamic>? ?? const [])
            .map((e) => e.toString())
            .toList(growable: false),
        subject: json['subject'] as String? ?? '',
        body: json['body'] as String? ?? '',
        inReplyTo: json['inReplyTo'] as String?,
        references: json['references'] as String?,
        updatedAt: json['updatedAt'] == null
            ? null
            : DateTime.tryParse(json['updatedAt'] as String),
      );
}
