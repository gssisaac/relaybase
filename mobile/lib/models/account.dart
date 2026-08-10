/// A mailbox address the mobile app is allowed to see.
class Account {
  const Account({
    required this.email,
    required this.domain,
    this.displayName,
    this.inboundEnabled = true,
    this.mobileEnabled = true,
    this.unreadCount = 0,
  });

  final String email;
  final String domain;
  final String? displayName;
  final bool inboundEnabled;
  final bool mobileEnabled;
  final int unreadCount;

  String get label => displayName?.isNotEmpty == true ? displayName! : email;

  Account copyWith({int? unreadCount}) => Account(
        email: email,
        domain: domain,
        displayName: displayName,
        inboundEnabled: inboundEnabled,
        mobileEnabled: mobileEnabled,
        unreadCount: unreadCount ?? this.unreadCount,
      );

  String get initials {
    final source = displayName?.isNotEmpty == true ? displayName! : email;
    final parts = source.split(RegExp(r'[\s@_.]+')).where((p) => p.isNotEmpty);
    if (parts.length >= 2) {
      return '${parts.first[0]}${parts.elementAt(1)[0]}'.toUpperCase();
    }
    return source.length >= 2
        ? source.substring(0, 2).toUpperCase()
        : source.toUpperCase();
  }

  factory Account.fromJson(Map<String, dynamic> json) => Account(
        email: json['email'] as String,
        domain: json['domain'] as String? ?? '',
        displayName: json['displayName'] as String?,
        inboundEnabled: json['inboundEnabled'] as bool? ?? true,
        mobileEnabled: json['mobileEnabled'] as bool? ?? true,
        unreadCount: 0,
      );

  Map<String, dynamic> toJson() => {
        'email': email,
        'domain': domain,
        if (displayName != null) 'displayName': displayName,
        'inboundEnabled': inboundEnabled,
        'mobileEnabled': mobileEnabled,
        'unreadCount': unreadCount,
      };
}
