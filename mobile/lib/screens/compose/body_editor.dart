import 'package:flutter/cupertino.dart';

import '../../../theme/colors.dart';

/// Plain-text body editor. Rich text is out of scope for the first cut;
/// the Worker accepts a `text` body and renders it on the receiving side.
class BodyEditor extends StatelessWidget {
  const BodyEditor({super.key, required this.value, required this.onChanged});
  final String value;
  final ValueChanged<String> onChanged;

  @override
  Widget build(BuildContext context) {
    final colors = ThemeColors.of(context);
    return Container(
      constraints: const BoxConstraints(minHeight: 240),
      padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 12),
      decoration: BoxDecoration(
        color: colors.surfaceVariant,
        borderRadius: BorderRadius.circular(8),
      ),
      child: CupertinoTextField(
        placeholder: 'Compose email',
        value: value,
        maxLines: null,
        minLines: 10,
        autocorrect: true,
        padding: EdgeInsets.zero,
        decoration: const BoxDecoration(border: Border()),
        style: TextStyle(fontSize: 15, color: colors.onSurface, height: 1.4),
        onChanged: onChanged,
      ),
    );
  }
}
