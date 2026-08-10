import 'package:flutter/cupertino.dart';

/// Relaybase brand tokens — mirrors `app/src/app/globals.css`.
class BrandColors {
  const BrandColors._();

  static const Color primary = Color(0xFFE85D2A);
  static const Color primaryForeground = Color(0xFFFFFFFF);

  static const Color lightBackground = Color(0xFFFAFBFC);
  static const Color lightForeground = Color(0xFF0F172A);
  static const Color lightCard = Color(0xFFFFFFFF);
  static const Color lightMuted = Color(0xFFF1F5F9);
  static const Color lightMutedForeground = Color(0xFF64748B);
  static const Color lightBorder = Color(0xFFE2E8F0);
  static const Color lightDestructive = Color(0xFFE5484D);

  static const Color darkBackground = Color(0xFF090A11);
  static const Color darkForeground = Color(0xFFF1F5F9);
  static const Color darkCard = Color(0xFF11131C);
  static const Color darkMuted = Color(0xFF161924);
  static const Color darkMutedForeground = Color(0xFF94A3B8);
  static const Color darkBorder = Color(0xFF1E2230);
  static const Color darkDestructive = Color(0xFFF07178);

  /// Functional accents (swipe / star) — not Gmail chrome.
  static const Color star = Color(0xFFF4B400);
  static const Color archive = Color(0xFF34A853);
}

/// Shared light + dark semantic colors.
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
    primary: BrandColors.primary,
    onPrimary: BrandColors.primaryForeground,
    surface: BrandColors.lightBackground,
    onSurface: BrandColors.lightForeground,
    surfaceVariant: BrandColors.lightMuted,
    onSurfaceVariant: BrandColors.lightMutedForeground,
    unread: BrandColors.primary,
    star: BrandColors.star,
    archive: BrandColors.archive,
    delete: BrandColors.lightDestructive,
    divider: BrandColors.lightBorder,
  );

  static const dark = ThemeColors(
    primary: BrandColors.primary,
    onPrimary: BrandColors.primaryForeground,
    surface: BrandColors.darkBackground,
    onSurface: BrandColors.darkForeground,
    surfaceVariant: BrandColors.darkMuted,
    onSurfaceVariant: BrandColors.darkMutedForeground,
    unread: BrandColors.primary,
    star: BrandColors.star,
    archive: BrandColors.archive,
    delete: BrandColors.darkDestructive,
    divider: BrandColors.darkBorder,
  );

  static ThemeColors of(BuildContext context) {
    return CupertinoTheme.brightnessOf(context) == Brightness.dark
        ? dark
        : light;
  }
}
