import 'package:flutter/cupertino.dart';

import '../../../theme/colors.dart';

/// A recipient row (To/Cc/Bcc) in Gmail style: label on the left, full-width
/// comma-separated input on the right, separated from the next row by a thin
/// bottom border. The "To" row may also surface Cc/Bcc toggle chips on the
/// right when those rows are not yet visible.
class RecipientField extends StatelessWidget {
  const RecipientField({
    super.key,
    required this.label,
    required this.recipients,
    required this.onChanged,
    this.onToggleCc,
    this.onToggleBcc,
  });
  final String label;
  final List<String> recipients;
  final ValueChanged<List<String>> onChanged;
  final VoidCallback? onToggleCc;
  final VoidCallback? onToggleBcc;

  @override
  Widget build(BuildContext context) {
    final colors = ThemeColors.of(context);
    return Container(
      decoration: BoxDecoration(
        border: Border(bottom: BorderSide(color: colors.divider, width: 0.5)),
      ),
      padding: const EdgeInsets.symmetric(horizontal: 12),
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
          const SizedBox(width: 8),
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
          if (onToggleCc != null || onToggleBcc != null) ...[
            const SizedBox(width: 8),
            Padding(
              padding: const EdgeInsets.only(top: 6),
              child: Row(
                mainAxisSize: MainAxisSize.min,
                children: [
                  if (onToggleCc != null)
                    _toggle('Cc', onToggleCc!, colors),
                  if (onToggleBcc != null) ...[
                    const SizedBox(width: 4),
                    _toggle('Bcc', onToggleBcc!, colors),
                  ],
                ],
              ),
            ),
          ],
        ],
      ),
    );
  }

  Widget _chip(String email, ThemeColors colors) {
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 6),
      decoration: BoxDecoration(
        color: colors.surfaceVariant,
        borderRadius: BorderRadius.circular(6),
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
      width: 180,
      child: CupertinoTextField(
        placeholder: 'Add recipient',
        autocorrect: false,
        keyboardType: TextInputType.emailAddress,
        padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 8),
        decoration: const BoxDecoration(border: Border()),
        onSubmitted: (value) {
          final trimmed = value.trim();
          if (trimmed.isEmpty) return;
          onChanged([...recipients, trimmed]);
        },
      ),
    );
  }

  Widget _toggle(String label, VoidCallback onTap, ThemeColors colors) {
    return CupertinoButton(
      padding: const EdgeInsets.symmetric(horizontal: 6, vertical: 4),
      onPressed: onTap,
      child: Text(label, style: TextStyle(fontSize: 13, color: colors.primary)),
    );
  }
}
