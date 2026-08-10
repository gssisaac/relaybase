/// Convert HTML email bodies to a plain-text preview and strip quoted
/// history for list rows. Keeps the app free of a full HTML parser for the
/// preview path; the thread screen renders HTML via flutter_widget_from_html.
class HtmlService {
  const HtmlService._();

  /// Collapse whitespace and tags into a single-line preview.
  static String toPreview(String html, {int max = 160}) {
    if (html.isEmpty) return '';
    final text = _stripTags(html).replaceAll(RegExp(r'\s+'), ' ').trim();
    if (text.length <= max) return text;
    return '${text.substring(0, max - 1)}…';
  }

  /// Best-effort tag stripper. flutter_widget_from_html handles real rendering
  /// in the thread view; this is only for list previews.
  static String _stripTags(String html) {
    final buffer = StringBuffer();
    var inTag = false;
    for (var i = 0; i < html.length; i++) {
      final char = html[i];
      if (char == '<') {
        inTag = true;
        continue;
      }
      if (char == '>') {
        inTag = false;
        buffer.write(' ');
        continue;
      }
      if (!inTag) buffer.write(char);
    }
    return _unescape(buffer.toString());
  }

  static String _unescape(String text) {
    return text
        .replaceAll('&nbsp;', ' ')
        .replaceAll('&amp;', '&')
        .replaceAll('&lt;', '<')
        .replaceAll('&gt;', '>')
        .replaceAll('&quot;', '"')
        .replaceAll('&#39;', "'");
  }

  /// Choose the best body to render: prefer HTML when present.
  static String renderBody({String? html, String? text}) {
    final htmlTrimmed = html?.trim() ?? '';
    if (htmlTrimmed.isNotEmpty) return htmlTrimmed;
    return text ?? '';
  }
}
