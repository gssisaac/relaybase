import 'package:flutter/cupertino.dart';

import '../theme/colors.dart';
import '../theme/radii.dart';

/// Floating compose button (pencil), bottom-right — brand radius, not a pill.
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
            borderRadius: AppRadii.fab,
            boxShadow: const [
              BoxShadow(
                color: Color(0x22000000),
                blurRadius: 4,
                offset: Offset(0, 1),
              ),
            ],
          ),
          child: Icon(
            CupertinoIcons.pencil,
            color: colors.onPrimary,
            size: 26,
          ),
        ),
      ),
    );
  }
}
