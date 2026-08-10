/// Runtime configuration for the Relaybase mobile app.
///
/// The Worker URL is obtained via QR pairing and stored securely on device
/// (`SecureStorageService`). The mobile app signs in with an account email
/// + a per-account mobile password (also stored securely after pairing).
/// This class holds the in-memory resolved config.
class AppConfig {
  const AppConfig({
    required this.workerUrl,
    required this.accountEmail,
    required this.mobilePassword,
  });

  final String workerUrl;
  final String accountEmail;
  final String mobilePassword;

  bool get isConfigured =>
      workerUrl.trim().isNotEmpty &&
      accountEmail.trim().isNotEmpty &&
      mobilePassword.trim().isNotEmpty;

  String get normalizedWorkerUrl {
    final url = workerUrl.trim();
    return url.endsWith('/') ? url.substring(0, url.length - 1) : url;
  }

  String get normalizedAccountEmail => accountEmail.trim().toLowerCase();

  AppConfig copyWith({
    String? workerUrl,
    String? accountEmail,
    String? mobilePassword,
  }) =>
      AppConfig(
        workerUrl: workerUrl ?? this.workerUrl,
        accountEmail: accountEmail ?? this.accountEmail,
        mobilePassword: mobilePassword ?? this.mobilePassword,
      );
}
