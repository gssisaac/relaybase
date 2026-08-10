import 'package:flutter/cupertino.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../models/message.dart';
import '../../../providers/accounts_provider.dart';
import '../../../providers/threads_provider.dart';
import '../../../theme/colors.dart';
import '../../../widgets/empty_state.dart';
import '../../../widgets/floating_compose_button.dart';
import '../../../widgets/gmail_app_bar.dart';
import '../../../widgets/loading_shimmer.dart';
import '../../compose/compose_screen.dart';
import '../../thread/thread_detail_screen.dart';
import 'thread_list.dart';

/// Gmail primary screen: top bar + thread list + FAB + pull-to-refresh.
class InboxScreen extends ConsumerStatefulWidget {
  const InboxScreen({
    super.key,
    required this.folder,
    required this.onOpenDrawer,
    required this.onOpenSearch,
  });
  final Folder folder;
  final VoidCallback onOpenDrawer;
  final VoidCallback onOpenSearch;

  @override
  ConsumerState<InboxScreen> createState() => _InboxScreenState();
}

class _InboxScreenState extends ConsumerState<InboxScreen> {
  @override
  void initState() {
    super.initState();
    WidgetsBinding.instance.addPostFrameCallback((_) {
      ref.read(threadsProvider.notifier).load();
    });
  }

  Future<void> _refresh() => ref.read(threadsProvider.notifier).refresh();

  void _openCompose() {
    final accounts = ref.read(accountsProvider).accounts;
    final from = accounts.isEmpty ? null : accounts.first.email;
    Navigator.of(context).push(
      CupertinoPageRoute<void>(
        builder: (_) => ComposeScreen(initialFrom: from),
      ),
    );
  }

  void _openThread(Message message) {
    Navigator.of(context).push(
      CupertinoPageRoute<void>(
        builder: (_) => ThreadDetailScreen(message: message),
      ),
    );
  }

  String get _title {
    switch (widget.folder) {
      case Folder.inbox:
        return 'Inbox';
      case Folder.starred:
        return 'Starred';
      case Folder.sent:
        return 'Sent';
      case Folder.drafts:
        return 'Drafts';
      case Folder.trash:
        return 'Trash';
      case Folder.allMail:
        return 'All Mail';
    }
  }

  @override
  Widget build(BuildContext context) {
    final threads = ref.watch(threadsProvider);
    final accounts = ref.watch(accountsProvider);
    final colors = ThemeColors.of(context);
    final avatarEmail = accounts.accounts.isEmpty ? '' : accounts.accounts.first.email;
    final avatarInitials = accounts.accounts.isEmpty ? '' : accounts.accounts.first.initials;

    final visible = threads.filtered(widget.folder);

    return CupertinoPageScaffold(
      backgroundColor: colors.surface,
      child: SafeArea(
        child: Stack(
          children: [
            Column(
              children: [
                GmailAppBar(
                  title: _title,
                  onMenu: widget.onOpenDrawer,
                  onSearch: widget.onOpenSearch,
                  avatarInitials: avatarInitials.isEmpty ? null : avatarInitials,
                  avatarEmail: avatarEmail.isEmpty ? null : avatarEmail,
                ),
                Container(height: 0.5, color: colors.divider),
                Expanded(
                  child: _body(threads, visible, colors),
                ),
              ],
            ),
            Positioned(
              right: 0,
              bottom: 0,
              child: FloatingComposeButton(onTap: _openCompose),
            ),
          ],
        ),
      ),
    );
  }

  Widget _body(ThreadsState threads, List<Message> visible, ThemeColors colors) {
    if (threads.loading && threads.messages.isEmpty) {
      return const LoadingShimmer();
    }
    if (visible.isEmpty && !threads.refreshing) {
      return RefreshIndicatorWrapper(
        onRefresh: _refresh,
        child: ListView(
          shrinkWrap: true,
          physics: const NeverScrollableScrollPhysics(),
          children: [
            const SizedBox(height: 80),
            EmptyState(
              icon: _emptyIcon,
              title: _emptyTitle,
              subtitle: 'Pull down to refresh',
            ),
          ],
        ),
      );
    }
    return RefreshIndicatorWrapper(
      onRefresh: _refresh,
      child: ThreadList(
        messages: visible,
        onOpen: _openThread,
        onToggleStar: (m) => ref.read(threadsProvider.notifier).toggleStar(m),
        onMarkRead: (m, read) => ref.read(threadsProvider.notifier).markRead(m, read),
        shrinkWrap: true,
      ),
    );
  }

  IconData get _emptyIcon {
    switch (widget.folder) {
      case Folder.inbox:
      case Folder.allMail:
        return CupertinoIcons.tray;
      case Folder.starred:
        return CupertinoIcons.star;
      case Folder.sent:
        return CupertinoIcons.paperplane;
      case Folder.drafts:
        return CupertinoIcons.doc_text;
      case Folder.trash:
        return CupertinoIcons.trash;
    }
  }

  String get _emptyTitle {
    switch (widget.folder) {
      case Folder.inbox:
      case Folder.allMail:
        return 'No messages';
      case Folder.starred:
        return 'No starred messages';
      case Folder.sent:
        return 'No sent messages';
      case Folder.drafts:
        return 'No drafts';
      case Folder.trash:
        return 'Trash is empty';
    }
  }
}

/// Cupertino-styled pull-to-refresh wrapper (CustomScrollView + sliver).
class RefreshIndicatorWrapper extends StatelessWidget {
  const RefreshIndicatorWrapper({super.key, required this.onRefresh, required this.child});
  final Future<void> Function() onRefresh;
  final Widget child;

  @override
  Widget build(BuildContext context) {
    return CustomScrollView(
      physics: const AlwaysScrollableScrollPhysics(),
      slivers: [
        CupertinoSliverRefreshControl(onRefresh: onRefresh),
        SliverToBoxAdapter(child: child),
      ],
    );
  }
}
