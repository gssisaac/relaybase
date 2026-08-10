import 'package:flutter/cupertino.dart';

import '../theme/colors.dart';

/// Circular avatar with the account's initials and a deterministic color.
class Avatar extends StatelessWidget {
  const Avatar({
    super.key,
    required this.initials,
    required this.email,
    this.size = 40,
  });

  final String initials;
  final String email;
  final double size;

  @override
  Widget build(BuildContext context) {
    final color = _colorFor(email);
    return Container(
      width: size,
      height: size,
      alignment: Alignment.center,
      decoration: BoxDecoration(
        color: color,
        shape: BoxShape.circle,
      ),
      child: Text(
        initials,
        style: TextStyle(
          color: CupertinoColors.white,
          fontSize: size * 0.4,
          fontWeight: FontWeight.w600,
        ),
      ),
    );
  }

  static const _palette = [
    Color(0xFF1A73E8),
    Color(0xFFEA4335),
    Color(0xFF34A853),
    Color(0xFFFBBC04),
    Color(0xFF9334E6),
    Color(0xFF00897B),
    Color(0xFFEF6C00),
  ];

  Color _colorFor(String key) {
    var hash = 0;
    for (final char in key.codeUnits) {
      hash = (hash * 31 + char) & 0x7fffffff;
    }
    return _palette[hash % _palette.length];
  }
}

// Re-export ThemeColors so consumers can import only avatar.dart if needed.
typedef AppThemeColors = ThemeColors;
