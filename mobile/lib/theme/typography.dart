import 'package:flutter/cupertino.dart';
import 'package:flutter/material.dart';

import 'colors.dart';

/// Text styles used across the app. SF Pro on iOS, Roboto on Android.
class AppTypography {
  const AppTypography._();

  static TextStyle subjectUnread(BuildContext context) =>
      CupertinoTheme.of(context).textTheme.textStyle.copyWith(
            fontWeight: FontWeight.w700,
            fontSize: 15,
          );

  static TextStyle subjectRead(BuildContext context) =>
      CupertinoTheme.of(context).textTheme.textStyle.copyWith(
            fontWeight: FontWeight.w500,
            fontSize: 15,
          );

  static TextStyle senderUnread(BuildContext context) =>
      CupertinoTheme.of(context).textTheme.textStyle.copyWith(
            fontWeight: FontWeight.w700,
            fontSize: 15,
          );

  static TextStyle senderRead(BuildContext context) =>
      CupertinoTheme.of(context).textTheme.textStyle.copyWith(
            fontWeight: FontWeight.w500,
            fontSize: 15,
          );

  static TextStyle preview(BuildContext context) =>
      CupertinoTheme.of(context).textTheme.textStyle.copyWith(
            fontSize: 14,
            color: ThemeColors.of(context).onSurfaceVariant,
          );

  static TextStyle timestamp(BuildContext context) =>
      CupertinoTheme.of(context).textTheme.textStyle.copyWith(
            fontSize: 12,
            color: ThemeColors.of(context).onSurfaceVariant,
          );
}
