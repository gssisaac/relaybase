import 'package:flutter/cupertino.dart';

/// Gmail-like palette (Material You-ish approximation).
class GmailColors {
  const GmailColors._();

  static const Color blue = Color(0xFF1A73E8);
  static const Color blueLight = Color(0xFF8AB4F8);
  static const Color red = Color(0xFFEA4335);
  static const Color green = Color(0xFF34A853);
  static const Color yellow = Color(0xFFFBBC04);
  static const Color star = Color(0xFFF4B400);

  static const Color grey900 = Color(0xFF202124);
  static const Color grey700 = Color(0xFF3C4043);
  static const Color grey500 = Color(0xFF80868B);
  static const Color grey300 = Color(0xFFDADCE0);
}

/// Gmail-like color palette shared by light + dark themes.
class ThemeColors {
  const ThemeColors({
    required this.primary,
    required this.onPrimary,
    required this.surface,
    required this.onSurface,
    required this.surfaceVariant,
    required this.onSurfaceVariant,
    required this.unread,
    required this.star,
    required this.archive,
    required this.delete,
    required this.divider,
  });

  final Color primary;
  final Color onPrimary;
  final Color surface;
  final Color onSurface;
  final Color surfaceVariant;
  final Color onSurfaceVariant;
  final Color unread;
  final Color star;
  final Color archive;
  final Color delete;
  final Color divider;

  static const light = ThemeColors(
    primary: GmailColors.blue,
    onPrimary: CupertinoColors.white,
    surface: CupertinoColors.systemBackground,
    onSurface: CupertinoColors.label,
    surfaceVariant: Color(0xFFF1F3F4),
    onSurfaceVariant: Color(0xFF5F6368),
    unread: GmailColors.blue,
    star: GmailColors.star,
    archive: GmailColors.green,
    delete: GmailColors.red,
    divider: Color(0xFFE8EAED),
  );

  static const dark = ThemeColors(
    primary: GmailColors.blueLight,
    onPrimary: CupertinoColors.black,
    surface: CupertinoColors.black,
    onSurface: CupertinoColors.white,
    surfaceVariant: Color(0xFF202124),
    onSurfaceVariant: Color(0xFFBDC1C6),
    unread: GmailColors.blueLight,
    star: GmailColors.star,
    archive: GmailColors.green,
    delete: GmailColors.red,
    divider: Color(0xFF3C4043),
  );

  static ThemeColors of(BuildContext context) {
    return CupertinoTheme.brightnessOf(context) == Brightness.dark
        ? dark
        : light;
  }
}
