import 'package:flutter/cupertino.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../models/thread.dart';
import '../../../providers/accounts_provider.dart';
import '../../../providers/compose_provider.dart';
import '../../../theme/colors.dart';
import '../../../theme/radii.dart';
import 'body_editor.dart';
import 'compose_app_bar.dart';
import 'recipient_field.dart';
import 'subject_field.dart';

/// Reply mode for the compose screen.
enum ReplyMode { newDraft, reply, replyAll, forward }

/// Compose screen: To/Cc/Bcc, subject, body, from-account selector, send.
class ComposeScreen extends ConsumerStatefulWidget {
  const ComposeScreen({
    super.key,
    this.initialFrom,
    this.replyTo,
    this.replyMode = ReplyMode.newDraft,
  });
  final String? initialFrom;
  final MessageDetail? replyTo;
  final ReplyMode replyMode;

  @override
  ConsumerState<ComposeScreen> createState() => _ComposeScreenState();
}

class _ComposeScreenState extends ConsumerState<ComposeScreen> {
  bool _showCc = false;
  bool _showBcc = false;

  @override
  void initState() {
    super.initState();
    WidgetsBinding.instance.addPostFrameCallback((_) => _seed());
  }

  void _seed() {
    final notifier = ref.read(composeProvider.notifier);
    final accounts = ref.read(accountsProvider).accounts;
    final from = widget.initialFrom ?? (accounts.isEmpty ? null : accounts.first.email);
    if (widget.replyTo != null) {
      final d = widget.replyTo!;
      switch (widget.replyMode) {
        case ReplyMode.reply:
          notifier.startReply(
            from: from ?? '',
            to: d.fromEmail,
            subject: d.subject,
            inReplyTo: d.messageId,
            references: d.references,
          );
          break;
        case ReplyMode.replyAll:
          notifier.startReply(
            from: from ?? '',
            to: d.fromEmail,
            subject: d.subject,
            inReplyTo: d.messageId,
            references: d.references,
          );
          final allRecipients = [d.fromEmail, ...d.toEmails.where((e) => e != (from ?? ''))];
          notifier.update(to: allRecipients);
          if (d.ccEmails.isNotEmpty) {
            setState(() => _showCc = true);
            notifier.update(cc: d.ccEmails);
          }
          break;
        case ReplyMode.forward:
          notifier.startNew(from: from);
          notifier.update(
            subject: d.subject.startsWith('Fwd:') ? d.subject : 'Fwd: ${d.subject}',
            body: '\n\n---------- Forwarded message ----------\nFrom: ${d.fromEmail}\nSubject: ${d.subject}\n\n${d.bodyText}',
          );
          break;
        case ReplyMode.newDraft:
          notifier.startNew(from: from);
          break;
      }
    } else {
      notifier.startNew(from: from);
    }
  }

  Future<void> _send() async {
    final ok = await ref.read(composeProvider.notifier).send();
    if (!mounted) return;
    if (ok) {
      Navigator.of(context).pop();
    } else {
      final error = ref.read(composeProvider).error ?? 'Failed to send';
      showCupertinoDialog<void>(
        context: context,
        builder: (c) => CupertinoAlertDialog(
          title: const Text('Send failed'),
          content: Text(error),
          actions: [
            CupertinoDialogAction(
              isDefaultAction: true,
              onPressed: () => Navigator.of(c).pop(),
              child: const Text('OK'),
            ),
          ],
        ),
      );
    }
  }

  void _discard() {
    final draft = ref.read(composeProvider).draft;
    if (draft == null || draft.isEmpty) {
      Navigator.of(context).pop();
      return;
    }
    showCupertinoDialog<void>(
      context: context,
      builder: (c) => CupertinoAlertDialog(
        title: const Text('Discard draft?'),
        actions: [
          CupertinoDialogAction(
            isDefaultAction: true,
            onPressed: () => Navigator.of(c).pop(),
            child: const Text('Cancel'),
          ),
          CupertinoDialogAction(
            isDestructiveAction: true,
            onPressed: () {
              Navigator.of(c).pop();
              ref.read(composeProvider.notifier).startNew(from: widget.initialFrom);
              Navigator.of(context).pop();
            },
            child: const Text('Discard'),
          ),
        ],
      ),
    );
  }

  @override
  Widget build(BuildContext context) {
    final compose = ref.watch(composeProvider);
    final accounts = ref.watch(accountsProvider);
    final colors = ThemeColors.of(context);
    final draft = compose.draft;

    return CupertinoPageScaffold(
      backgroundColor: colors.surface,
      child: SafeArea(
        child: Column(
          children: [
            ComposeAppBar(
              sending: compose.sending,
              onDiscard: _discard,
              onSend: _send,
              canSend: draft != null && draft.to.isNotEmpty && draft.subject.trim().isNotEmpty,
            ),
            Container(height: 0.5, color: colors.divider),
            Expanded(
              child: SingleChildScrollView(
                padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 8),
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.stretch,
                  children: [
                    _fromRow(accounts, colors),
                    RecipientField(
                      label: 'To',
                      recipients: draft?.to ?? const [],
                      onChanged: (v) => ref.read(composeProvider.notifier).update(to: v),
                    ),
                    if (_showCc)
                      RecipientField(
                        label: 'Cc',
                        recipients: draft?.cc ?? const [],
                        onChanged: (v) => ref.read(composeProvider.notifier).update(cc: v),
                      ),
                    if (_showBcc)
                      RecipientField(
                        label: 'Bcc',
                        recipients: draft?.bcc ?? const [],
                        onChanged: (v) => ref.read(composeProvider.notifier).update(bcc: v),
                      ),
                    _toggleRow(colors),
                    SubjectField(
                      value: draft?.subject ?? '',
                      onChanged: (v) => ref.read(composeProvider.notifier).update(subject: v),
                    ),
                    const SizedBox(height: 8),
                    BodyEditor(
                      value: draft?.body ?? '',
                      onChanged: (v) => ref.read(composeProvider.notifier).update(body: v),
                    ),
                  ],
                ),
              ),
            ),
          ],
        ),
      ),
    );
  }

  Widget _fromRow(AccountsState accounts, ThemeColors colors) {
    final draft = ref.watch(composeProvider).draft;
    final from = draft?.from ?? widget.initialFrom ?? '';
    return Padding(
      padding: const EdgeInsets.symmetric(vertical: 6),
      child: Row(
        children: [
          Text('From', style: TextStyle(fontSize: 14, color: colors.onSurfaceVariant)),
          const SizedBox(width: 12),
          Expanded(
            child: CupertinoButton(
              padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 6),
              color: colors.surfaceVariant,
              borderRadius: AppRadii.button,
              onPressed: () => _showFromPicker(accounts),
              child: Text(from.isEmpty ? 'Select account' : from,
                  style: TextStyle(fontSize: 14, color: colors.onSurface)),
            ),
          ),
        ],
      ),
    );
  }

  void _showFromPicker(AccountsState accounts) {
    showCupertinoModalPopup<void>(
      context: context,
      builder: (c) => CupertinoActionSheet(
        actions: accounts.accounts
            .map(
              (a) => CupertinoActionSheetAction(
                onPressed: () {
                  ref.read(composeProvider.notifier).update(from: a.email);
                  Navigator.of(c).pop();
                },
                child: Text(a.email),
              ),
            )
            .toList(growable: false),
        cancelButton: CupertinoActionSheetAction(
          isDefaultAction: true,
          onPressed: () => Navigator.of(c).pop(),
          child: const Text('Cancel'),
        ),
      ),
    );
  }

  Widget _toggleRow(ThemeColors colors) {
    return Row(
      children: [
        if (!_showCc)
          _toggle('Cc', () => setState(() => _showCc = true), colors),
        if (!_showBcc) ...[
          const SizedBox(width: 8),
          _toggle('Bcc', () => setState(() => _showBcc = true), colors),
        ],
      ],
    );
  }

  Widget _toggle(String label, VoidCallback onTap, ThemeColors colors) {
    return CupertinoButton(
      padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 6),
      onPressed: onTap,
      child: Text(label, style: TextStyle(fontSize: 13, color: colors.primary)),
    );
  }
}
