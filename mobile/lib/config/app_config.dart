/// Runtime configuration for the Relaybase mobile app.
///
/// The mobile app signs in with an account email + a per-account mobile
/// password. The Worker URL is NOT entered by the user — it is baked into
/// the build via [defaultWorkerUrl] so team members only need email +
/// password. (QR pairing can still override it, but is optional.)
class AppConfig {
  const AppConfig({
    required this.workerUrl,
    required this.accountEmail,
    required this.mobilePassword,
  });

  /// The Worker URL this build connects to. Users never type this.
  /// Points at the Relaybase dogfood Worker; production customer builds bake in
  /// the customer's own Worker URL. Central account/billing lives at
  /// console.relaybase.xyz (separate Next.js app), not here.
  static const String defaultWorkerUrl = 'https://relaybase-api.gssisaac.worker.dev';

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
