/// Runtime configuration for the Relaybase mobile app.
///
/// The Worker URL and mobile password are stored securely on device
/// (`SecureStorageService`) after pairing. This class holds the in-memory
/// resolved config and the deep-link scheme used for QR pairing.
class AppConfig {
  const AppConfig({
    required this.workerUrl,
    required this.mobilePassword,
  });

  final String workerUrl;
  final String mobilePassword;

  bool get isConfigured =>
      workerUrl.trim().isNotEmpty && mobilePassword.trim().isNotEmpty;

  String get normalizedWorkerUrl {
    final url = workerUrl.trim();
    return url.endsWith('/') ? url.substring(0, url.length - 1) : url;
  }

  AppConfig copyWith({String? workerUrl, String? mobilePassword}) =>
      AppConfig(
        workerUrl: workerUrl ?? this.workerUrl,
        mobilePassword: mobilePassword ?? this.mobilePassword,
      );
}
