import 'package:flutter/cupertino.dart';

import '../../../theme/colors.dart';

/// Plain-text body editor. Rich text is out of scope for the first cut;
/// the Worker accepts a `text` body and renders it on the receiving side.
///
/// Gmail-style: borderless, fills all remaining vertical space, scrolls
/// internally when content overflows.
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
    return CupertinoTextField(
      controller: _controller,
      placeholder: 'Compose email',
      maxLines: null,
      minLines: null,
      expands: true,
      autocorrect: true,
      textAlign: TextAlign.start,
      padding: const EdgeInsets.symmetric(horizontal: 22, vertical: 12),
      decoration: const BoxDecoration(border: Border()),
      style: TextStyle(fontSize: 15, color: colors.onSurface, height: 1.4),
    );
  }
}
