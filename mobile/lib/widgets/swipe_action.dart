import 'package:flutter/cupertino.dart';

import '../theme/colors.dart';

/// Direction a swipe action is revealed from.
enum SwipeDirection { left, right }

/// Gmail-like swipe-to-reveal action behind a list row. Wraps a child and
/// reveals a colored background with an icon + label when dragged.
class SwipeAction extends StatelessWidget {
  const SwipeAction({
    super.key,
    required this.child,
    required this.direction,
    required this.icon,
    required this.label,
    required this.color,
    this.onTriggered,
  });

  final Widget child;
  final SwipeDirection direction;
  final IconData icon;
  final String label;
  final Color color;
  final VoidCallback? onTriggered;

  @override
  Widget build(BuildContext context) {
    return Dismissible(
      key: ValueKey('swipe_${direction.name}_$label'),
      direction: direction == SwipeDirection.left
          ? DismissDirection.endToStart
          : DismissDirection.startToEnd,
      background: _background(context),
      dismissThresholds: const {DismissDirection.endToStart: 0.4, DismissDirection.startToEnd: 0.4},
      confirmDismiss: (_) async {
        onTriggered?.call();
        return false;
      },
      child: child,
    );
  }

  Widget _background(BuildContext context) {
    final colors = ThemeColors.of(context);
    final isLeft = direction == SwipeDirection.left;
    return Container(
      color: color,
      padding: EdgeInsets.only(
        left: isLeft ? 0 : 24,
        right: isLeft ? 24 : 0,
      ),
      alignment: isLeft ? Alignment.centerRight : Alignment.centerLeft,
      child: Column(
        mainAxisSize: MainAxisSize.min,
        children: [
          Icon(icon, color: colors.onPrimary, size: 24),
          const SizedBox(height: 4),
          Text(
            label,
            style: TextStyle(color: colors.onPrimary, fontSize: 12, fontWeight: FontWeight.w600),
          ),
        ],
      ),
    );
  }
}
