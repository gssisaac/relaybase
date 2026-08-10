import '../services/html_service.dart';

/// Helpers used by the thread screen to pick the best body and render it.
class HtmlRender {
  const HtmlRender._();

  static String bodyFor({String? html, String? text}) {
    return HtmlService.renderBody(html: html, text: text);
  }

  static bool isHtml(String body) =>
      body.contains('<') && body.contains('>');
}
