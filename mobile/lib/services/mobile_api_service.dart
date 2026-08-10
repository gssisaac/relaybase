import 'dart:convert';

import 'package:http/http.dart' as http;

import '../config/app_config.dart';
import '../models/account.dart';
import '../models/message.dart';
import '../models/thread.dart';

/// Thrown when a `/mobile/*` request fails.
class MobileApiException implements Exception {
  const MobileApiException(this.message, {this.status});
  final String message;
  final int? status;

  @override
  String toString() => 'MobileApiException($status): $message';
}

/// Thin HTTP wrapper around the Worker `/mobile/*` route family. Injects
/// `Authorization: Bearer {mobilePassword}` on every call.
class MobileApiService {
  MobileApiService({http.Client? client}) : _client = client ?? http.Client();

  final http.Client _client;
  AppConfig? _config;

  void configure(AppConfig config) => _config = config;

  AppConfig? get config => _config;

  bool get isConfigured => _config?.isConfigured ?? false;

  String get _base => _config!.normalizedWorkerUrl;

  Map<String, String> get _headers => {
        'Authorization': 'Bearer ${_config!.mobilePassword}',
        'Accept': 'application/json',
      };

  /// Validate the connection (used by the Connect screen).
  Future<void> pingConfig() async {
    final res = await _get('/mobile/config');
    if (!res.ok) {
      throw MobileApiException(
        _errorMessage(res.body) ?? 'Mobile access is not configured',
        status: res.statusCode,
      );
    }
  }

  Future<List<Account>> fetchMailbox() async {
    final res = await _get('/mobile/mailbox');
    if (!res.ok) throw MobileApiException(_errorMessage(res.body) ?? 'Failed to load mailbox', status: res.statusCode);
    final data = jsonDecode(res.body) as Map<String, dynamic>;
    final addresses = (data['addresses'] as List<dynamic>? ?? const [])
        .map((e) => Account.fromJson(e as Map<String, dynamic>))
        .toList(growable: false);
    return addresses;
  }

  Future<List<Message>> fetchInbox({String? account, int limit = 50}) async {
    final query = <String, String>{'limit': limit.toString()};
    if (account != null && account.isNotEmpty) query['account'] = account;
    final res = await _get('/mobile/inbox', query);
    if (!res.ok) throw MobileApiException(_errorMessage(res.body) ?? 'Failed to load inbox', status: res.statusCode);
    final data = jsonDecode(res.body) as Map<String, dynamic>;
    final messages = (data['messages'] as List<dynamic>? ?? const [])
        .map((e) => Message.fromJson(e as Map<String, dynamic>))
        .toList(growable: false);
    return messages;
  }

  Future<Map<String, AddressCounts>> fetchCounts() async {
    final res = await _get('/mobile/inbox/counts');
    if (!res.ok) throw MobileApiException(_errorMessage(res.body) ?? 'Failed to load counts', status: res.statusCode);
    final data = jsonDecode(res.body) as Map<String, dynamic>;
    final counts = <String, AddressCounts>{};
    final raw = data['counts'] as Map<String, dynamic>? ?? const {};
    for (final entry in raw.entries) {
      final value = entry.value as Map<String, dynamic>;
      counts[entry.key] = AddressCounts(
        total: value['total'] as int? ?? 0,
        unread: value['unread'] as int? ?? 0,
      );
    }
    return counts;
  }

  Future<void> setRead(List<String> ids, bool read) async {
    final res = await _post('/mobile/inbox/read', {
      'ids': ids,
      'read': read,
    });
    if (!res.ok) throw MobileApiException(_errorMessage(res.body) ?? 'Failed to update read state', status: res.statusCode);
  }

  Future<MessageDetail> fetchMessage(String id, {String? domain}) async {
    final query = <String, String>{};
    if (domain != null && domain.isNotEmpty) query['domain'] = domain;
    final res = await _get('/mobile/inbox/$id', query);
    if (!res.ok) throw MobileApiException(_errorMessage(res.body) ?? 'Message not found', status: res.statusCode);
    final data = jsonDecode(res.body) as Map<String, dynamic>;
    return MessageDetail.fromJson(data['message'] as Map<String, dynamic>);
  }

  Future<String> attachmentUrl(String messageId, String attachmentId, {required String domain}) {
    final query = Uri(queryParameters: {'domain': domain}).query;
    return Future.value('$_base/mobile/inbox/$messageId/attachments/$attachmentId?$query');
  }

  Future<List<Map<String, dynamic>>> fetchSent({int limit = 50}) async {
    final res = await _get('/mobile/sent', {'limit': limit.toString()});
    if (!res.ok) throw MobileApiException(_errorMessage(res.body) ?? 'Failed to load sent', status: res.statusCode);
    final data = jsonDecode(res.body) as Map<String, dynamic>;
    final sent = (data['sent'] as List<dynamic>? ?? const [])
        .map((e) => e as Map<String, dynamic>)
        .toList(growable: false);
    return sent;
  }

  Future<Map<String, dynamic>> sendEmail(Map<String, dynamic> body) async {
    final res = await _post('/mobile/send', body);
    if (!res.ok) throw MobileApiException(_errorMessage(res.body) ?? 'Failed to send', status: res.statusCode);
    return jsonDecode(res.body) as Map<String, dynamic>;
  }

  Future<List<InboundEvent>> fetchNotifications({int limit = 25}) async {
    final res = await _get('/mobile/notifications', {'limit': limit.toString()});
    if (!res.ok) throw MobileApiException(_errorMessage(res.body) ?? 'Failed to poll notifications', status: res.statusCode);
    final data = jsonDecode(res.body) as Map<String, dynamic>;
    final events = (data['events'] as List<dynamic>? ?? const [])
        .map((e) => InboundEvent.fromJson(e as Map<String, dynamic>))
        .toList(growable: false);
    return events;
  }

  Future<void> ackNotifications(String domain, List<String> ids) async {
    final res = await _post('/mobile/notifications/ack', {
      'domain': domain,
      'ids': ids,
    });
    if (!res.ok) throw MobileApiException(_errorMessage(res.body) ?? 'Failed to ack', status: res.statusCode);
  }

  // ---- internals ----
  Future<http.Response> _get(String path, [Map<String, String>? query]) async {
    final uri = Uri.parse('$_base$path${_querySuffix(query)}');
    return _client.get(uri, headers: _headers);
  }

  Future<http.Response> _post(String path, Map<String, dynamic> body) async {
    final uri = Uri.parse('$_base$path');
    return _client.post(
      uri,
      headers: {..._headers, 'Content-Type': 'application/json'},
      body: jsonEncode(body),
    );
  }

  String _querySuffix(Map<String, String>? query) {
    if (query == null || query.isEmpty) return '';
    return '?${Uri(queryParameters: query).query}';
  }

  String? _errorMessage(String body) {
    if (body.isEmpty) return null;
    try {
      final data = jsonDecode(body);
      if (data is Map<String, dynamic>) {
        return data['error'] as String?;
      }
    } catch (_) {
      // ignore
    }
    return null;
  }

  void close() => _client.close();
}

class AddressCounts {
  const AddressCounts({required this.total, required this.unread});
  final int total;
  final int unread;
}

class InboundEvent {
  const InboundEvent({
    required this.id,
    required this.domain,
    required this.messageId,
    required this.from,
    required this.to,
    required this.subject,
    required this.receivedAt,
  });

  final String id;
  final String domain;
  final String messageId;
  final String from;
  final String to;
  final String subject;
  final String receivedAt;

  factory InboundEvent.fromJson(Map<String, dynamic> json) {
    final data = json['data'] as Map<String, dynamic>? ?? const {};
    return InboundEvent(
      id: json['id'] as String? ?? '',
      domain: data['domain'] as String? ?? '',
      messageId: data['messageId'] as String? ?? '',
      from: data['from'] as String? ?? '',
      to: data['to'] as String? ?? '',
      subject: data['subject'] as String? ?? '',
      receivedAt: data['receivedAt'] as String? ?? '',
    );
  }
}
