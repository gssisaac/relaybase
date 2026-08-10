import 'package:flutter/cupertino.dart';

import '../theme/colors.dart';

/// Circular floating compose button (pencil icon), bottom-right, 56dp.
class FloatingComposeButton extends StatelessWidget {
  const FloatingComposeButton({super.key, required this.onTap});

  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    final colors = ThemeColors.of(context);
    return Container(
      margin: const EdgeInsets.all(16),
      child: CupertinoButton(
        padding: EdgeInsets.zero,
        minSize: 0,
        onPressed: onTap,
        child: Container(
          width: 56,
          height: 56,
          decoration: BoxDecoration(
            color: colors.primary,
            shape: BoxShape.circle,
            boxShadow: const [
              BoxShadow(
                color: Color(0x33000000),
                blurRadius: 6,
                offset: Offset(0, 2),
              ),
            ],
          ),
          child: const Icon(
            CupertinoIcons.pencil,
            color: CupertinoColors.white,
            size: 26,
          ),
        ),
      ),
    );
  }
}
