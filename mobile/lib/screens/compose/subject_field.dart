import 'package:flutter/cupertino.dart';

import '../../../theme/colors.dart';
import '../../../theme/radii.dart';

/// Subject line field.
class SubjectField extends StatefulWidget {
  const SubjectField({super.key, required this.value, required this.onChanged});
  final String value;
  final ValueChanged<String> onChanged;

  @override
  State<SubjectField> createState() => _SubjectFieldState();
}

class _SubjectFieldState extends State<SubjectField> {
  late final TextEditingController _controller;
  late final FocusNode _focus;

  @override
  void initState() {
    super.initState();
    _controller = TextEditingController(text: widget.value);
    _focus = FocusNode();
    _controller.addListener(() {
      if (_controller.text != widget.value) {
        widget.onChanged(_controller.text);
      }
    });
  }

  @override
  void didUpdateWidget(SubjectField oldWidget) {
    super.didUpdateWidget(oldWidget);
    if (widget.value != _controller.text && !_focus.hasFocus) {
      _controller.text = widget.value;
    }
  }

  @override
  void dispose() {
    _controller.dispose();
    _focus.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final colors = ThemeColors.of(context);
    return CupertinoTextField(
      controller: _controller,
      focusNode: _focus,
      placeholder: 'Subject',
      autocorrect: false,
      padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 12),
      decoration: BoxDecoration(
        color: colors.surfaceVariant,
        borderRadius: AppRadii.field,
      ),
      style: TextStyle(fontSize: 15, fontWeight: FontWeight.w600, color: colors.onSurface),
    );
  }
}
