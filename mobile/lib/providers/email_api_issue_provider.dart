import 'package:flutter_riverpod/flutter_riverpod.dart';

/// Sticky header banner after a send fails because the Worker email API
/// (CF_API_TOKEN) is missing. Survives popping compose back to inbox.
final emailApiIssueProvider = StateProvider<bool>((ref) => false);
