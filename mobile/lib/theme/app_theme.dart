import 'package:flutter/cupertino.dart';
import 'package:flutter/material.dart';

import 'colors.dart';
import 'radii.dart';

/// Cupertino-first theme with Material hybrid affordances, branded to match
/// the desktop Relaybase app (primary `#e85d2a`, sharp `rounded-lg` controls).
class AppTheme {
  const AppTheme._();

  static CupertinoThemeData cupertino(Brightness brightness) {
    final colors = brightness == Brightness.dark
        ? ThemeColors.dark
        : ThemeColors.light;
    return CupertinoThemeData(
      brightness: brightness,
      primaryColor: colors.primary,
      scaffoldBackgroundColor: colors.surface,
      textTheme: const CupertinoTextThemeData(),
    );
  }

  static ThemeData material(Brightness brightness) {
    final colors = brightness == Brightness.dark
        ? ThemeColors.dark
        : ThemeColors.light;
    return ThemeData(
      useMaterial3: true,
      brightness: brightness,
      colorScheme: ColorScheme(
        brightness: brightness,
        primary: colors.primary,
        onPrimary: colors.onPrimary,
        secondary: colors.primary,
        onSecondary: colors.onPrimary,
        error: colors.delete,
        onError: BrandColors.primaryForeground,
        surface: colors.surface,
        onSurface: colors.onSurface,
      ),
      scaffoldBackgroundColor: colors.surface,
      dividerColor: colors.divider,
      splashColor: Colors.transparent,
      highlightColor: Colors.transparent,
      filledButtonTheme: FilledButtonThemeData(
        style: FilledButton.styleFrom(
          backgroundColor: colors.primary,
          foregroundColor: colors.onPrimary,
          shape: RoundedRectangleBorder(borderRadius: AppRadii.button),
        ),
      ),
      floatingActionButtonTheme: FloatingActionButtonThemeData(
        backgroundColor: colors.primary,
        foregroundColor: colors.onPrimary,
        shape: RoundedRectangleBorder(borderRadius: AppRadii.fab),
      ),
    );
  }
}
