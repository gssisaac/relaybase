/// Email validation helpers.
class Validators {
  const Validators._();

  static final _email = RegExp(r'^[^\s@]+@[^\s@]+\.[^\s@]+$');

  static bool isEmail(String value) => _email.hasMatch(value.trim());

  static bool isUrl(String value) {
    final trimmed = value.trim();
    if (trimmed.isEmpty) return false;
    try {
      final uri = Uri.parse(trimmed);
      return uri.hasScheme && (uri.scheme == 'http' || uri.scheme == 'https');
    } catch (_) {
      return false;
    }
  }
}
