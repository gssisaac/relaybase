import 'package:flutter/cupertino.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import 'providers/auth_provider.dart';
import 'screens/connect/connect_screen.dart';
import 'screens/main/main_screen.dart';
import 'theme/app_theme.dart';

/// CupertinoApp entry. Gates on the auth state: show Connect until paired,
/// then the Gmail-like main shell.
class RelaybaseApp extends ConsumerWidget {
  const RelaybaseApp({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final auth = ref.watch(authProvider);
    final brightness = MediaQuery.platformBrightnessOf(context);

    return CupertinoApp(
      title: 'Relaybase',
      theme: AppTheme.cupertino(brightness),
      debugShowCheckedModeBanner: false,
      home: !auth.bootstrapped
          ? const _Loading()
          : auth.isConfigured
              ? const MainScreen()
              : const ConnectScreen(),
    );
  }
}

class _Loading extends StatelessWidget {
  const _Loading();

  @override
  Widget build(BuildContext context) {
    return const CupertinoPageScaffold(
      backgroundColor: CupertinoColors.systemBackground,
      child: Center(child: CupertinoActivityIndicator()),
    );
  }
}
