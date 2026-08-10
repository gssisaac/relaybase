import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../models/draft.dart';
import 'app_providers.dart';
import 'auth_provider.dart';

class ComposeState {
  const ComposeState({this.draft, this.sending = false, this.error, this.sent = false});
  final DraftEmail? draft;
  final bool sending;
  final String? error;
  final bool sent;

  ComposeState copyWith({
    DraftEmail? draft,
    bool? sending,
    String? error,
    bool? sent,
  }) =>
      ComposeState(
        draft: draft ?? this.draft,
        sending: sending ?? this.sending,
        error: error ?? this.error,
        sent: sent ?? this.sent,
      );
}

class ComposeNotifier extends StateNotifier<ComposeState> {
  ComposeNotifier(this._ref) : super(const ComposeState());

  final Ref _ref;

  void startNew({String? from}) {
    state = ComposeState(
      draft: DraftEmail(id: 'draft_${DateTime.now().millisecondsSinceEpoch}', from: from),
    );
  }

  void startReply({required String from, required String to, String? subject, String? inReplyTo, String? references}) {
    state = ComposeState(
      draft: DraftEmail(
        id: 'draft_${DateTime.now().millisecondsSinceEpoch}',
        from: from,
        to: [to],
        subject: subject == null ? '' : (subject.startsWith('Re:') ? subject : 'Re: $subject'),
        inReplyTo: inReplyTo,
        references: references,
      ),
    );
  }

  void update({
    String? from,
    List<String>? to,
    List<String>? cc,
    List<String>? bcc,
    String? subject,
    String? body,
  }) {
    final current = state.draft;
    if (current == null) return;
    final next = current.copyWith(
      from: from,
      to: to,
      cc: cc,
      bcc: bcc,
      subject: subject,
      body: body,
      updatedAt: DateTime.now(),
    );
    state = state.copyWith(draft: next, sent: false);
    _persist(next);
  }

  Future<void> _persist(DraftEmail draft) async {
    try {
      final storage = await _ref.read(storageServiceProvider.future);
      await storage.saveDraft(draft);
    } catch (_) {
      // ignore
    }
  }

  Future<bool> send() async {
    final draft = state.draft;
    if (draft == null || !_ref.read(authProvider).isConfigured) return false;
    state = state.copyWith(sending: true, error: null, sent: false);
    try {
      final api = _ref.read(mobileApiProvider);
      await api.sendEmail({
        'from': draft.from,
        'to': draft.to,
        'cc': draft.cc,
        'subject': draft.subject,
        'text': draft.body,
        'inReplyTo': draft.inReplyTo,
        'references': draft.references,
      });
      final storage = await _ref.read(storageServiceProvider.future);
      await storage.deleteDraft(draft.id);
      state = state.copyWith(sending: false, sent: true);
      return true;
    } catch (e) {
      state = state.copyWith(sending: false, error: e.toString());
      return false;
    }
  }
}

final composeProvider =
    StateNotifierProvider<ComposeNotifier, ComposeState>((ref) {
  return ComposeNotifier(ref);
});
