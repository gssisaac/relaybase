import 'package:flutter/cupertino.dart';
import 'package:flutter/material.dart' show Material, MaterialType;
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../providers/accounts_provider.dart';
import '../../providers/auth_provider.dart';
import '../../providers/threads_provider.dart';
import 'drawer/app_drawer.dart';
import 'inbox/inbox_screen.dart';
import 'search/search_screen.dart';

/// Root shell: Gmail-like drawer + inbox/search stack. No bottom tab bar.
class MainScreen extends ConsumerStatefulWidget {
  const MainScreen({super.key});

  @override
  ConsumerState<MainScreen> createState() => _MainScreenState();
}

class _MainScreenState extends ConsumerState<MainScreen> {
  final _drawerKey = GlobalKey<CupertinoDrawerState>();
  Folder _folder = Folder.inbox;

  @override
  void initState() {
    super.initState();
    WidgetsBinding.instance.addPostFrameCallback((_) {
      ref.read(accountsProvider.notifier).refresh();
      ref.read(threadsProvider.notifier).load();
    });
  }

  void _openDrawer() => _drawerKey.currentState?.open();

  void _selectFolder(Folder folder) {
    setState(() => _folder = folder);
    _drawerKey.currentState?.close();
  }

  void _openSearch() {
    Navigator.of(context).push(
      CupertinoPageRoute<void>(builder: (_) => const SearchScreen()),
    );
  }

  @override
  Widget build(BuildContext context) {
    return CupertinoDrawer(
      key: _drawerKey,
      drawer: AppDrawer(
        currentFolder: _folder,
        onSelectFolder: _selectFolder,
        onSignOut: () => ref.read(authProvider.notifier).signOut(),
      ),
      child: InboxScreen(
        folder: _folder,
        onOpenDrawer: _openDrawer,
        onOpenSearch: _openSearch,
      ),
    );
  }
}

/// Cupertino-styled left drawer wrapper. CupertinoApp does not ship a drawer
/// widget, so we use a custom one with a drag handle and overlay.
class CupertinoDrawer extends StatefulWidget {
  const CupertinoDrawer({
    super.key,
    required this.drawer,
    required this.child,
  });
  final Widget drawer;
  final Widget child;

  @override
  State<CupertinoDrawer> createState() => CupertinoDrawerState();
}

class CupertinoDrawerState extends State<CupertinoDrawer>
    with SingleTickerProviderStateMixin {
  late final AnimationController _controller;
  late final Animation<Offset> _offset;
  late final Animation<double> _fade;
  bool _open = false;

  @override
  void initState() {
    super.initState();
    _controller = AnimationController(
      vsync: this,
      duration: const Duration(milliseconds: 220),
    );
    _offset = Tween<Offset>(begin: const Offset(-1, 0), end: Offset.zero)
        .animate(CurvedAnimation(parent: _controller, curve: Curves.easeOutCubic));
    _fade = Tween<double>(begin: 0, end: 0.4)
        .animate(CurvedAnimation(parent: _controller, curve: Curves.easeOut));
  }

  @override
  void dispose() {
    _controller.dispose();
    super.dispose();
  }

  void open() {
    if (_open) return;
    setState(() => _open = true);
    _controller.forward();
  }

  void close() {
    if (!_open) return;
    _controller.reverse().then((_) {
      if (mounted) setState(() => _open = false);
    });
  }

  @override
  Widget build(BuildContext context) {
    final child = widget.child;
    if (!_open && _controller.isDismissed) return child;
    return Stack(
      children: [
        child,
        GestureDetector(
          onTap: close,
          child: FadeTransition(opacity: _fade, child: Container(color: CupertinoColors.black)),
        ),
        SlideTransition(
          position: _offset,
          child: Align(
            alignment: Alignment.centerLeft,
            child: Material(
              type: MaterialType.transparency,
              child: SizedBox(width: 320, child: widget.drawer),
            ),
          ),
        ),
      ],
    );
  }
}
