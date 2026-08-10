import 'package:flutter/cupertino.dart';

import '../theme/colors.dart';

/// Gmail-like top app bar: menu button, folder title, search icon, avatar.
class GmailAppBar extends StatelessWidget {
  const GmailAppBar({
    super.key,
    required this.title,
    this.onMenu,
    this.onSearch,
    this.avatarInitials,
    this.avatarEmail,
    this.onAvatar,
    this.showBack = false,
    this.onBack,
    this.actions = const [],
  });

  final String title;
  final VoidCallback? onMenu;
  final VoidCallback? onSearch;
  final String? avatarInitials;
  final String? avatarEmail;
  final VoidCallback? onAvatar;
  final bool showBack;
  final VoidCallback? onBack;
  final List<Widget> actions;

  @override
  Widget build(BuildContext context) {
    final colors = ThemeColors.of(context);
    return Container(
      height: 52,
      color: colors.surface,
      padding: const EdgeInsets.symmetric(horizontal: 8),
      child: Row(
        children: [
          _iconButton(
            icon: showBack ? CupertinoIcons.back : CupertinoIcons.line_horizontal_3,
            onPressed: showBack ? onBack : onMenu,
          ),
          const SizedBox(width: 12),
          Expanded(
            child: Text(
              title,
              maxLines: 1,
              overflow: TextOverflow.ellipsis,
              style: const TextStyle(
                fontSize: 18,
                fontWeight: FontWeight.w500,
              ),
            ),
          ),
          ...actions,
          if (onSearch != null)
            _iconButton(icon: CupertinoIcons.search, onPressed: onSearch),
          if (avatarInitials != null && avatarEmail != null) ...[
            const SizedBox(width: 4),
            GestureDetector(
              onTap: onAvatar,
              child: _Avatar(initials: avatarInitials!, email: avatarEmail!),
            ),
          ],
        ],
      ),
    );
  }

  Widget _iconButton({required IconData icon, required VoidCallback? onPressed}) {
    return CupertinoButton(
      padding: EdgeInsets.zero,
      minSize: 40,
      onPressed: onPressed,
      child: Icon(icon, size: 24),
    );
  }
}

class _Avatar extends StatelessWidget {
  const _Avatar({required this.initials, required this.email});
  final String initials;
  final String email;

  @override
  Widget build(BuildContext context) {
    const palette = [
      Color(0xFF1A73E8),
      Color(0xFFEA4335),
      Color(0xFF34A853),
      Color(0xFFFBBC04),
    ];
    var hash = 0;
    for (final c in email.codeUnits) {
      hash = (hash * 31 + c) & 0x7fffffff;
    }
    final color = palette[hash % palette.length];
    return Container(
      width: 32,
      height: 32,
      alignment: Alignment.center,
      decoration: BoxDecoration(color: color, shape: BoxShape.circle),
      child: Text(
        initials,
        style: const TextStyle(
          color: CupertinoColors.white,
          fontSize: 13,
          fontWeight: FontWeight.w600,
        ),
      ),
    );
  }
}
