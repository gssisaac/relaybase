import 'dart:async';

import 'package:flutter/foundation.dart';

import 'mobile_api_service.dart';

/// Polls `/mobile/notifications` on an interval, acks events, and notifies
/// listeners so folder providers can refresh affected mail. Background fetch
/// on iOS is best-effort (the app must be foregrounded for reliable polling).
class SyncService {
  SyncService({required this.api, this.interval = const Duration(seconds: 45)});

  final MobileApiService api;
  final Duration interval;

  Timer? _timer;
  final _controller = StreamController<List<InboundEvent>>.broadcast();

  Stream<List<InboundEvent>> get events => _controller.stream;

  void start() {
    _timer ??= Timer.periodic(interval, (_) => _tick());
  }

  void stop() {
    _timer?.cancel();
    _timer = null;
  }

  Future<void> pollOnce() => _tick();

  Future<void> _tick() async {
    if (!api.isConfigured) return;
    try {
      final events = await api.fetchNotifications();
      if (events.isEmpty) return;
      _controller.add(events);
      // Group by domain and ack.
      final byDomain = <String, List<String>>{};
      for (final e in events) {
        byDomain.putIfAbsent(e.domain, () => []).add(e.id);
      }
      for (final entry in byDomain.entries) {
        await api.ackNotifications(entry.key, entry.value);
      }
    } catch (e) {
      // Polling failures are non-fatal — keep retrying on the next tick.
      debugPrint('sync tick failed: $e');
    }
  }

  void dispose() {
    stop();
    _controller.close();
  }
}
