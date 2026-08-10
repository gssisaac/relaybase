import 'package:flutter/cupertino.dart';

/// Corner radii aligned with `app/src/app/globals.css` (`--radius: 0.35rem`).
///
/// Desktop buttons use `rounded-lg` (= `--radius` ≈ 6 logical px).
class AppRadii {
  const AppRadii._();

  static const double sm = 3.5;
  static const double md = 4.5;
  static const double lg = 6;
  static const double xl = 8;
  static const double xxl = 10;

  /// Primary / filled controls (matches app `Button` default).
  static BorderRadius get button => BorderRadius.circular(lg);

  /// Text fields and cards.
  static BorderRadius get field => BorderRadius.circular(lg);

  /// Floating compose control — app-like, not a full pill/circle.
  static BorderRadius get fab => BorderRadius.circular(xl);
}
