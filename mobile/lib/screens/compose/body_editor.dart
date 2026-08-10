import 'package:flutter/cupertino.dart';

import '../../../theme/colors.dart';
import '../../../theme/radii.dart';

/// Plain-text body editor. Rich text is out of scope for the first cut;
/// the Worker accepts a `text` body and renders it on the receiving side.
class BodyEditor extends StatefulWidget {
  const BodyEditor({super.key, required this.value, required this.onChanged});
  final String value;
  final ValueChanged<String> onChanged;

  @override
  State<BodyEditor> createState() => _BodyEditorState();
}

class _BodyEditorState extends State<BodyEditor> {
  late final TextEditingController _controller;

  @override
  void initState() {
    super.initState();
    _controller = TextEditingController(text: widget.value);
    _controller.addListener(() {
      if (_controller.text != widget.value) {
        widget.onChanged(_controller.text);
      }
    });
  }

  @override
  void didUpdateWidget(BodyEditor oldWidget) {
    super.didUpdateWidget(oldWidget);
    if (widget.value != _controller.text) {
      _controller.text = widget.value;
    }
  }

  @override
  void dispose() {
    _controller.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final colors = ThemeColors.of(context);
    return Container(
      constraints: const BoxConstraints(minHeight: 240),
      padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 12),
      decoration: BoxDecoration(
        color: colors.surfaceVariant,
        borderRadius: AppRadii.field,
      ),
      child: CupertinoTextField(
        controller: _controller,
        placeholder: 'Compose email',
        maxLines: null,
        minLines: 10,
        autocorrect: true,
        padding: EdgeInsets.zero,
        decoration: const BoxDecoration(border: Border()),
        style: TextStyle(fontSize: 15, color: colors.onSurface, height: 1.4),
      ),
    );
  }
}
