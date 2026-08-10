/// Parses `relaybase://connect?workerUrl=…&password=…` deep links produced by
/// the desktop Other device tab QR code.
class ConnectDeepLink {
  const ConnectDeepLink._();

  static const scheme = 'relaybase';
  static const host = 'connect';

  /// Parse a deep link URI string into an [AppConfig], or return null when the
  /// URI is not a Relaybase connect link.
  static ConnectParams? parse(String uri) {
    final trimmed = uri.trim();
    if (trimmed.isEmpty) return null;
    final lower = trimmed.toLowerCase();
    if (!lower.startsWith('$scheme://$host')) return null;
    final qIndex = trimmed.indexOf('?');
    if (qIndex < 0) return null;
    final query = trimmed.substring(qIndex + 1);
    final params = Uri.splitQueryString(query);
    final workerUrl = params['workerUrl']?.trim() ?? '';
    final password = params['password']?.trim() ?? '';
    if (workerUrl.isEmpty || password.isEmpty) return null;
    return ConnectParams(workerUrl: workerUrl, password: password);
  }
}

class ConnectParams {
  const ConnectParams({required this.workerUrl, required this.password});

  final String workerUrl;
  final String password;
}
