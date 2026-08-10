import 'package:flutter/cupertino.dart';

import '../../../theme/colors.dart';
import '../../../theme/radii.dart';

/// Compose top bar: discard (back), attach, send.
class ComposeAppBar extends StatelessWidget {
  const ComposeAppBar({
    super.key,
    required this.sending,
    required this.canSend,
    required this.onDiscard,
    required this.onSend,
  });
  final bool sending;
  final bool canSend;
  final VoidCallback onDiscard;
  final VoidCallback onSend;

  @override
  Widget build(BuildContext context) {
    final colors = ThemeColors.of(context);
    return Container(
      height: 52,
      padding: const EdgeInsets.symmetric(horizontal: 4),
      child: Row(
        children: [
          CupertinoButton(
            padding: EdgeInsets.zero,
            minSize: 44,
            onPressed: onDiscard,
            child: const Icon(CupertinoIcons.xmark, size: 24),
          ),
          const Spacer(),
          CupertinoButton(
            padding: EdgeInsets.zero,
            minSize: 44,
            onPressed: () {},
            child: Icon(CupertinoIcons.paperclip, size: 24, color: colors.onSurfaceVariant),
          ),
          const SizedBox(width: 4),
          CupertinoButton(
            padding: const EdgeInsets.symmetric(horizontal: 12),
            color: canSend ? colors.primary : colors.surfaceVariant,
            borderRadius: AppRadii.button,
            onPressed: sending || !canSend ? null : onSend,
            child: sending
                ? const CupertinoActivityIndicator(color: CupertinoColors.white)
                : Row(
                    children: [
                      Icon(CupertinoIcons.paperplane_fill, size: 18, color: canSend ? colors.onPrimary : colors.onSurfaceVariant),
                      const SizedBox(width: 6),
                      Text(
                        'Send',
                        style: TextStyle(
                          fontSize: 15,
                          fontWeight: FontWeight.w600,
                          color: canSend ? colors.onPrimary : colors.onSurfaceVariant,
                        ),
                      ),
                    ],
                  ),
          ),
        ],
      ),
    );
  }
}
