import 'package:flutter_riverpod/flutter_riverpod.dart';

import 'app_providers.dart';

enum ThreadDensity { comfortable, compact }
enum ThemeMode { system, light, dark }

class SettingsState {
  const SettingsState({
    this.pollingIntervalSeconds = 45,
    this.cacheSizeBytes = 0,
    this.threadDensity = ThreadDensity.comfortable,
    this.themeMode = ThemeMode.system,
    this.signingOut = false,
    this.lastSyncAt,
    this.message,
  });

  final int pollingIntervalSeconds;
  final int cacheSizeBytes;
  final ThreadDensity threadDensity;
  final ThemeMode themeMode;
  final bool signingOut;
  final DateTime? lastSyncAt;
  final String? message;

  SettingsState copyWith({
    int? pollingIntervalSeconds,
    int? cacheSizeBytes,
    ThreadDensity? threadDensity,
    ThemeMode? themeMode,
    bool? signingOut,
    DateTime? lastSyncAt,
    String? message,
  }) =>
      SettingsState(
        pollingIntervalSeconds: pollingIntervalSeconds ?? this.pollingIntervalSeconds,
        cacheSizeBytes: cacheSizeBytes ?? this.cacheSizeBytes,
        threadDensity: threadDensity ?? this.threadDensity,
        themeMode: themeMode ?? this.themeMode,
        signingOut: signingOut ?? this.signingOut,
        lastSyncAt: lastSyncAt ?? this.lastSyncAt,
        message: message ?? this.message,
      );
}

class SettingsNotifier extends StateNotifier<SettingsState> {
  SettingsNotifier(this._ref) : super(const SettingsState());

  final Ref _ref;

  Future<void> clearCache() async {
    final storage = await _ref.read(storageServiceProvider.future);
    await storage.clearAll();
    state = state.copyWith(cacheSizeBytes: 0, message: 'Cache cleared');
  }

  void setPollingInterval(int seconds) {
    state = state.copyWith(pollingIntervalSeconds: seconds);
  }

  void setThreadDensity(ThreadDensity density) {
    state = state.copyWith(threadDensity: density);
  }

  void setThemeMode(ThemeMode mode) {
    state = state.copyWith(themeMode: mode);
  }

  void markSynced() {
    state = state.copyWith(lastSyncAt: DateTime.now());
  }
}

final settingsProvider =
    StateNotifierProvider<SettingsNotifier, SettingsState>((ref) {
  return SettingsNotifier(ref);
});
