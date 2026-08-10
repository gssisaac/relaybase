import 'package:flutter/cupertino.dart';

import '../../../theme/colors.dart';

/// A recipient chip row (To/Cc/Bcc). Recipients are simple comma-separated
/// chips; editing is a plain text field that splits on commas.
class RecipientField extends StatelessWidget {
  const RecipientField({
    super.key,
    required this.label,
    required this.recipients,
    required this.onChanged,
  });
  final String label;
  final List<String> recipients;
  final ValueChanged<List<String>> onChanged;

  @override
  Widget build(BuildContext context) {
    final colors = ThemeColors.of(context);
    return Padding(
      padding: const EdgeInsets.symmetric(vertical: 6),
      child: Row(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Padding(
            padding: const EdgeInsets.only(top: 12),
            child: SizedBox(
              width: 40,
              child: Text(label, style: TextStyle(fontSize: 14, color: colors.onSurfaceVariant)),
            ),
          ),
          Expanded(
            child: Wrap(
              spacing: 6,
              runSpacing: 6,
              children: [
                ...recipients.map((r) => _chip(r, colors)),
                _input(colors),
              ],
            ),
          ),
        ],
      ),
    );
  }

  Widget _chip(String email, ThemeColors colors) {
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 6),
      decoration: BoxDecoration(
        color: colors.surfaceVariant,
        borderRadius: BorderRadius.circular(16),
        border: Border.all(color: colors.divider),
      ),
      child: Row(
        mainAxisSize: MainAxisSize.min,
        children: [
          Text(email, style: TextStyle(fontSize: 13, color: colors.onSurface)),
          const SizedBox(width: 6),
          GestureDetector(
            onTap: () => onChanged(recipients.where((r) => r != email).toList(growable: false)),
            child: Icon(CupertinoIcons.xmark, size: 12, color: colors.onSurfaceVariant),
          ),
        ],
      ),
    );
  }

  Widget _input(ThemeColors colors) {
    return SizedBox(
      width: 160,
      child: CupertinoTextField(
        placeholder: 'Add recipient',
        autocorrect: false,
        keyboardType: TextInputType.emailAddress,
        padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 8),
        decoration: BoxDecoration(
          color: colors.surfaceVariant,
          borderRadius: BorderRadius.circular(8),
        ),
        onSubmitted: (value) {
          final trimmed = value.trim();
          if (trimmed.isEmpty) return;
          onChanged([...recipients, trimmed]);
        },
      ),
    );
  }
}
