import 'package:flutter/cupertino.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../models/message.dart';
import '../../../models/thread.dart';
import '../../../providers/accounts_provider.dart';
import '../../../providers/thread_provider.dart';
import '../../../theme/colors.dart';
import '../../../widgets/empty_state.dart';
import '../../../widgets/loading_shimmer.dart';
import '../compose/compose_screen.dart';
import 'action_bar.dart';
import 'message_card.dart';

/// Full-screen thread detail: stacked message cards + bottom action bar.
class ThreadDetailScreen extends ConsumerStatefulWidget {
  const ThreadDetailScreen({super.key, required this.message});
  final Message message;

  @override
  ConsumerState<ThreadDetailScreen> createState() => _ThreadDetailScreenState();
}

class _ThreadDetailScreenState extends ConsumerState<ThreadDetailScreen> {
  @override
  void initState() {
    super.initState();
    WidgetsBinding.instance.addPostFrameCallback((_) {
      ref.read(threadDetailProvider.notifier).load(
            widget.message.id,
            domain: _domain(widget.message.toEmail),
          );
    });
  }

  String? _domain(String to) {
    if (to.isEmpty) return null;
    final at = to.indexOf('@');
    return at < 0 ? null : to.substring(at + 1);
  }

  MessageDetail _replySource() {
    final detail = ref.read(threadDetailProvider).detail;
    if (detail != null) return detail;
    final m = widget.message;
    return MessageDetail(
      id: m.id,
      fromEmail: m.fromEmail,
      toEmail: m.toEmail,
      toEmails: m.toEmails,
      ccEmails: m.ccEmails,
      subject: m.subject,
      bodyText: m.preview,
      receivedAt: m.receivedAt,
      attachments: const [],
      messageId: m.messageId,
      inReplyTo: m.inReplyTo,
      references: m.references,
      readAt: m.readAt,
    );
  }

  void _reply() {
    final from = _fromAddress();
    Navigator.of(context).push(
      CupertinoPageRoute<void>(
        builder: (_) => ComposeScreen(
          replyTo: _replySource(),
          replyMode: ReplyMode.reply,
          initialFrom: from,
        ),
      ),
    );
  }

  void _replyAll() {
    final from = _fromAddress();
    Navigator.of(context).push(
      CupertinoPageRoute<void>(
        builder: (_) => ComposeScreen(
          replyTo: _replySource(),
          replyMode: ReplyMode.replyAll,
          initialFrom: from,
        ),
      ),
    );
  }

  void _forward() {
    final from = _fromAddress();
    Navigator.of(context).push(
      CupertinoPageRoute<void>(
        builder: (_) => ComposeScreen(
          replyTo: _replySource(),
          replyMode: ReplyMode.forward,
          initialFrom: from,
        ),
      ),
    );
  }

  String? _fromAddress() {
    final accounts = ref.read(accountsProvider).accounts;
    if (accounts.isEmpty) return null;
    final toDomain = _domain(widget.message.toEmail);
    if (toDomain == null) return accounts.first.email;
    return accounts.firstWhere(
      (a) => a.domain == toDomain,
      orElse: () => accounts.first,
    ).email;
  }

  @override
  Widget build(BuildContext context) {
    final state = ref.watch(threadDetailProvider);
    final colors = ThemeColors.of(context);
    return CupertinoPageScaffold(
      backgroundColor: colors.surface,
      child: SafeArea(
        child: Column(
          children: [
            _topBar(colors),
            Container(height: 0.5, color: colors.divider),
            Expanded(child: _body(state, colors)),
            ActionBar(
              onReply: _reply,
              onReplyAll: _replyAll,
              onForward: _forward,
            ),
          ],
        ),
      ),
    );
  }

  Widget _topBar(ThemeColors colors) {
    return Container(
      height: 52,
      padding: const EdgeInsets.symmetric(horizontal: 4),
      child: Row(
        children: [
          CupertinoButton(
            padding: EdgeInsets.zero,
            minSize: 44,
            onPressed: () => Navigator.of(context).pop(),
            child: const Icon(CupertinoIcons.back, size: 24),
          ),
          Expanded(
            child: Text(
              widget.message.subject,
              maxLines: 1,
              overflow: TextOverflow.ellipsis,
              style: TextStyle(fontSize: 16, fontWeight: FontWeight.w600, color: colors.onSurface),
            ),
          ),
          CupertinoButton(
            padding: EdgeInsets.zero,
            minSize: 44,
            onPressed: () {},
            child: Icon(CupertinoIcons.archivebox, size: 22, color: colors.onSurfaceVariant),
          ),
          CupertinoButton(
            padding: EdgeInsets.zero,
            minSize: 44,
            onPressed: () {},
            child: Icon(CupertinoIcons.trash, size: 22, color: colors.onSurfaceVariant),
          ),
          CupertinoButton(
            padding: EdgeInsets.zero,
            minSize: 44,
            onPressed: () {},
            child: Icon(CupertinoIcons.envelope_open, size: 22, color: colors.onSurfaceVariant),
          ),
          CupertinoButton(
            padding: EdgeInsets.zero,
            minSize: 44,
            onPressed: () {},
            child: Icon(CupertinoIcons.ellipsis_circle, size: 22, color: colors.onSurfaceVariant),
          ),
        ],
      ),
    );
  }

  Widget _body(ThreadDetailState state, ThemeColors colors) {
    if (state.loading && state.detail == null) {
      return const LoadingShimmer(itemCount: 4);
    }
    if (state.detail == null) {
      return const EmptyState(icon: CupertinoIcons.envelope_open, title: 'Message not available');
    }
    return SingleChildScrollView(
      padding: const EdgeInsets.symmetric(vertical: 12),
      child: MessageCard(detail: state.detail!),
    );
  }
}
