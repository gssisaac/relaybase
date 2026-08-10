import 'package:flutter/cupertino.dart';

import '../theme/colors.dart';

/// Gmail-like bottom sheet option row.
class BottomSheetOption {
  const BottomSheetOption({
    required this.icon,
    required this.label,
    required this.onTap,
    this.destructive = false,
  });
  final IconData icon;
  final String label;
  final VoidCallback onTap;
  final bool destructive;
}

/// Shows a Gmail-style action sheet with icon + label rows.
Future<void> showGmailActionSheet(
  BuildContext context,
  List<BottomSheetOption> options, {
  String? title,
}) async {
  await showCupertinoModalPopup<void>(
    context: context,
    builder: (sheetContext) {
      final colors = ThemeColors.of(sheetContext);
      return CupertinoActionSheet(
        title: title == null ? null : Text(title),
        actions: options
            .map(
              (o) => CupertinoActionSheetAction(
                onPressed: () {
                  Navigator.of(sheetContext).pop();
                  o.onTap();
                },
                child: Row(
                  mainAxisAlignment: MainAxisAlignment.center,
                  children: [
                    Icon(
                      o.icon,
                      size: 20,
                      color: o.destructive ? colors.delete : colors.primary,
                    ),
                    const SizedBox(width: 8),
                    Text(
                      o.label,
                      style: TextStyle(
                        color: o.destructive ? colors.delete : colors.onSurface,
                        fontSize: 16,
                      ),
                    ),
                  ],
                ),
              ),
            )
            .toList(growable: false),
        cancelButton: CupertinoActionSheetAction(
          isDefaultAction: true,
          onPressed: () => Navigator.of(sheetContext).pop(),
          child: const Text('Cancel'),
        ),
      );
    },
  );
}
