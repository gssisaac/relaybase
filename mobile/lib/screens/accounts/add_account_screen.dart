import 'package:flutter/cupertino.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../providers/app_providers.dart';
import '../../providers/auth_provider.dart';
import '../../theme/colors.dart';
import '../../theme/radii.dart';
import '../../utils/validators.dart';

/// Add a second (or subsequent) account to the device. Verifies the email +
/// password against the Worker via [AuthNotifier.connect] (which now adds
/// rather than replaces), then pops back to the drawer.
class AddAccountScreen extends ConsumerStatefulWidget {
  const AddAccountScreen({super.key});

  @override
  ConsumerState<AddAccountScreen> createState() => _AddAccountScreenState();
}

class _AddAccountScreenState extends ConsumerState<AddAccountScreen> {
  final _emailController = TextEditingController();
  final _passwordController = TextEditingController();
  bool _obscurePassword = true;

  @override
  void dispose() {
    _emailController.dispose();
    _passwordController.dispose();
    super.dispose();
  }

  Future<void> _add() async {
    final email = _emailController.text.trim();
    final password = _passwordController.text.trim();
    if (email.isEmpty) {
      _toast('Enter your account email');
      return;
    }
    if (!Validators.isEmail(email)) {
      _toast('Enter a valid account email address');
      return;
    }
    if (password.isEmpty) {
      _toast('Enter your password');
      return;
    }
    final storage = await ref.read(storageServiceProvider.future);
    await storage.rememberLastUsed(email: email);

    final ok = await ref.read(authProvider.notifier).connect(
          accountEmail: email,
          password: password,
        );
    if (!ok && mounted) {
      final error = ref.read(authProvider).error ?? 'Could not add account';
      _toast(error);
      return;
    }
    if (ok && mounted) {
      Navigator.of(context).pop();
    }
  }

  void _toast(String message) {
    showCupertinoDialog<void>(
      context: context,
      builder: (c) => CupertinoAlertDialog(
        title: const Text('Could not add account'),
        content: Text(message),
        actions: [
          CupertinoDialogAction(
            isDefaultAction: true,
            onPressed: () => Navigator.of(c).pop(),
            child: const Text('OK'),
          ),
        ],
      ),
    );
  }

  @override
  Widget build(BuildContext context) {
    final auth = ref.watch(authProvider);
    final colors = ThemeColors.of(context);
    return CupertinoPageScaffold(
      backgroundColor: colors.surface,
      child: SafeArea(
        child: Column(
          children: [
            _topBar(context, colors),
            Expanded(
              child: SingleChildScrollView(
                padding: const EdgeInsets.symmetric(horizontal: 24, vertical: 16),
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.stretch,
                  children: [
                    Text(
                      'Add another account',
                      style: TextStyle(
                        fontSize: 22,
                        fontWeight: FontWeight.w700,
                        color: colors.onSurface,
                      ),
                    ),
                    const SizedBox(height: 6),
                    Text(
                      'Sign in with the account email and password provisioned on the desktop Other device tab.',
                      style: TextStyle(fontSize: 14, color: colors.onSurfaceVariant),
                    ),
                    const SizedBox(height: 24),
                    _field(
                      controller: _emailController,
                      placeholder: 'Account email',
                      keyboardType: TextInputType.emailAddress,
                      autocorrect: false,
                      prefixIcon: CupertinoIcons.person_crop_circle,
                    ),
                    const SizedBox(height: 12),
                    _field(
                      controller: _passwordController,
                      placeholder: 'Password',
                      obscureText: _obscurePassword,
                      autocorrect: false,
                      prefixIcon: CupertinoIcons.lock_fill,
                      suffix: CupertinoButton(
                        padding: EdgeInsets.zero,
                        minSize: 0,
                        onPressed: () =>
                            setState(() => _obscurePassword = !_obscurePassword),
                        child: Icon(
                          _obscurePassword ? CupertinoIcons.eye : CupertinoIcons.eye_slash,
                          size: 20,
                          color: colors.onSurfaceVariant,
                        ),
                      ),
                    ),
                    const SizedBox(height: 24),
                    CupertinoButton(
                      color: colors.primary,
                      borderRadius: AppRadii.button,
                      padding: const EdgeInsets.symmetric(vertical: 14),
                      onPressed: auth.loading ? null : _add,
                      child: auth.loading
                          ? const CupertinoActivityIndicator(color: CupertinoColors.white)
                          : Text(
                              'Add account',
                              style: TextStyle(
                                fontSize: 16,
                                fontWeight: FontWeight.w600,
                                color: colors.onPrimary,
                              ),
                            ),
                    ),
                  ],
                ),
              ),
            ),
          ],
        ),
      ),
    );
  }

  Widget _topBar(BuildContext context, ThemeColors colors) {
    return Container(
      height: 52,
      padding: const EdgeInsets.symmetric(horizontal: 4),
      child: Row(
        children: [
          CupertinoButton(
            padding: EdgeInsets.zero,
            minSize: 44,
            onPressed: () => Navigator.of(context).pop(),
            child: const Icon(CupertinoIcons.back, size: 24),
          ),
          const SizedBox(width: 8),
          Text(
            'Add account',
            style: TextStyle(fontSize: 18, fontWeight: FontWeight.w600, color: colors.onSurface),
          ),
        ],
      ),
    );
  }

  Widget _field({
    required TextEditingController controller,
    required String placeholder,
    required IconData prefixIcon,
    TextInputType? keyboardType,
    bool obscureText = false,
    bool autocorrect = true,
    Widget? suffix,
  }) {
    return CupertinoTextField(
      controller: controller,
      placeholder: placeholder,
      keyboardType: keyboardType,
      obscureText: obscureText,
      autocorrect: autocorrect,
      prefix: Padding(
        padding: const EdgeInsets.only(left: 12),
        child: Icon(prefixIcon, size: 20, color: ThemeColors.of(context).onSurfaceVariant),
      ),
      suffix: suffix == null ? null : Padding(padding: const EdgeInsets.only(right: 12), child: suffix),
      padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 14),
      decoration: BoxDecoration(
        color: ThemeColors.of(context).surfaceVariant,
        borderRadius: AppRadii.field,
        border: Border.all(color: ThemeColors.of(context).divider),
      ),
    );
  }
}
