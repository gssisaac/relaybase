import 'package:flutter/cupertino.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../providers/auth_provider.dart';
import '../../providers/settings_provider.dart';
import '../../theme/colors.dart';

/// Settings: account info, polling interval, clear cache, sign out.
class SettingsScreen extends ConsumerWidget {
  const SettingsScreen({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final settings = ref.watch(settingsProvider);
    final auth = ref.watch(authProvider);
    final colors = ThemeColors.of(context);
    return CupertinoPageScaffold(
      backgroundColor: colors.surface,
      child: SafeArea(
        child: Column(
          children: [
            _topBar(context, colors),
            Expanded(
              child: ListView(
                children: [
                  _section('Account', [
                    _row(
                      icon: CupertinoIcons.person_circle,
                      label: 'Worker URL',
                      value: auth.config?.normalizedWorkerUrl ?? 'Not connected',
                      colors: colors,
                    ),
                  ]),
                  _section('Sync', [
                    _row(
                      icon: CupertinoIcons.clock,
                      label: 'Polling interval',
                      value: '${settings.pollingIntervalSeconds}s',
                      colors: colors,
                      onTap: () => _showIntervalPicker(context, ref, settings.pollingIntervalSeconds),
                    ),
                    _row(
                      icon: CupertinoIcons.arrow_2_circlepath,
                      label: 'Last sync',
                      value: settings.lastSyncAt == null
                          ? 'Never'
                          : _formatTime(settings.lastSyncAt!),
                      colors: colors,
                    ),
                  ]),
                  _section('Storage', [
                    _row(
                      icon: CupertinoIcons.trash,
                      label: 'Clear cache',
                      value: _cacheLabel(settings.cacheSizeBytes),
                      colors: colors,
                      onTap: () => ref.read(settingsProvider.notifier).clearCache(),
                    ),
                  ]),
                  _section('Session', [
                    _row(
                      icon: CupertinoIcons.square_arrow_right,
                      label: 'Sign out',
                      value: '',
                      colors: colors,
                      destructive: true,
                      onTap: () async {
                        await ref.read(authProvider.notifier).signOut();
                      },
                    ),
                  ]),
                ],
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
            'Settings',
            style: TextStyle(fontSize: 18, fontWeight: FontWeight.w600, color: colors.onSurface),
          ),
        ],
      ),
    );
  }

  Widget _section(String title, List<Widget> children) {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Padding(
          padding: const EdgeInsets.fromLTRB(20, 16, 20, 6),
          child: Text(
            title.toUpperCase(),
            style: TextStyle(
              fontSize: 12,
              fontWeight: FontWeight.w600,
              color: ThemeColors.of(context).onSurfaceVariant,
              letterSpacing: 0.5,
            ),
          ),
        ),
        Container(
          margin: const EdgeInsets.symmetric(horizontal: 16),
          decoration: BoxDecoration(
            color: ThemeColors.of(context).surfaceVariant,
            borderRadius: BorderRadius.circular(12),
          ),
          child: Column(children: children),
        ),
      ],
    );
  }

  Widget _row({
    required IconData icon,
    required String label,
    required String value,
    required ThemeColors colors,
    bool destructive = false,
    VoidCallback? onTap,
  }) {
    final valueColor = destructive ? colors.delete : colors.onSurfaceVariant;
    return CupertinoButton(
      padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 12),
      onPressed: onTap,
      child: Row(
        children: [
          Icon(icon, size: 22, color: destructive ? colors.delete : colors.primary),
          const SizedBox(width: 12),
          Expanded(
            child: Text(
              label,
              style: TextStyle(fontSize: 15, color: destructive ? colors.delete : colors.onSurface),
            ),
          ),
          if (value.isNotEmpty)
            Text(
              value,
              maxLines: 1,
              overflow: TextOverflow.ellipsis,
              style: TextStyle(fontSize: 14, color: valueColor),
            ),
          if (onTap != null) ...[
            const SizedBox(width: 6),
            Icon(CupertinoIcons.chevron_right, size: 16, color: colors.onSurfaceVariant),
          ],
        ],
      ),
    );
  }

  void _showIntervalPicker(BuildContext context, WidgetRef ref, int current) {
    final options = [30, 45, 60, 120, 300];
    showCupertinoModalPopup<void>(
      context: context,
      builder: (c) => CupertinoActionSheet(
        actions: options
            .map(
              (s) => CupertinoActionSheetAction(
                onPressed: () {
                  ref.read(settingsProvider.notifier).setPollingInterval(s);
                  Navigator.of(c).pop();
                },
                child: Text(s == current ? '${s}s (current)' : '${s}s'),
              ),
            )
            .toList(growable: false),
        cancelButton: CupertinoActionSheetAction(
          isDefaultAction: true,
          onPressed: () => Navigator.of(c).pop(),
          child: const Text('Cancel'),
        ),
      ),
    );
  }

  String _cacheLabel(int bytes) {
    if (bytes == 0) return 'Empty';
    if (bytes < 1024 * 1024) return '${(bytes / 1024).round()} KB';
    return '${(bytes / 1024 / 1024).toStringAsFixed(1)} MB';
  }

  String _formatTime(DateTime time) {
    final local = time.toLocal();
    return '${local.hour.toString().padLeft(2, '0')}:${local.minute.toString().padLeft(2, '0')}';
  }
}
