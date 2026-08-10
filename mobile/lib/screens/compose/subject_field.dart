import 'package:flutter/cupertino.dart';

import '../../../theme/colors.dart';

/// Subject line field.
class SubjectField extends StatelessWidget {
  const SubjectField({super.key, required this.value, required this.onChanged});
  final String value;
  final ValueChanged<String> onChanged;

  @override
  Widget build(BuildContext context) {
    final colors = ThemeColors.of(context);
    return CupertinoTextField(
      placeholder: 'Subject',
      value: value,
      autocorrect: false,
      padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 12),
      decoration: BoxDecoration(
        color: colors.surfaceVariant,
        borderRadius: BorderRadius.circular(8),
      ),
      style: TextStyle(fontSize: 15, fontWeight: FontWeight.w600, color: colors.onSurface),
      onChanged: onChanged,
    );
  }
}
