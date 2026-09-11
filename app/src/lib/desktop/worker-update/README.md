# Worker update

Two independent contexts, both mounted once in [`AppProviders`](../shell/AppProviders.tsx)
so any component in the console can read them without prop drilling.

| Context | File | Job |
| --- | --- | --- |
| `WorkerUpdateCheckContext` | [`WorkerUpdateCheckContext.tsx`](./WorkerUpdateCheckContext.tsx) | Is a newer Worker build available? (read-only) |
| `WorkerUpdateRunnerContext` | [`WorkerUpdateRunnerContext.tsx`](./WorkerUpdateRunnerContext.tsx) | Actually download + deploy it |

They're split because checking is cheap, side-effect-free, and wanted
everywhere (sidebar banner, Settings card); running an update is a heavyweight,
backgroundable operation with its own progress/cancel lifecycle that only the
Settings → Worker screens drive.

## Checking: `WorkerUpdateCheckContext`

Holds the last `desktopCheckWorkerUpdate()` result (`{ currentVersion,
latestVersion }`, from the Tauri command `check_worker_update_cmd`) as shared
state: `{ check, checking, error, checkNow }`. Consumers —
[`WorkerUpdateBanner`](../../../console/components/WorkerUpdateBanner.tsx) and
`WorkerVersionSettingsCard` in the same file — derive "is an update actually
worth showing" themselves via `workerNeedsUpgrade(currentVersion,
latestVersion, desktopVersion)`, since that also depends on the installed
desktop app version (see [`AppUpdaterContext`](../updater/AppUpdaterContext.tsx)):
the Worker is never offered ahead of the desktop app.

A fresh check runs from three triggers, all funneled through the shared
[`useRouteStaleScheduler`](../scheduler/useRouteStaleScheduler.ts) hook:

1. **Manual** — `checkNow()`, wired to the "Check for updates" button. Always
   runs immediately and resets the staleness clock.
2. **Route change / console entry** — re-checks automatically when the user
   navigates, but only if the last check is more than 10 minutes old
   (`STALE_CHECK_MS`). Navigating around the console doesn't spam the check
   endpoint.
3. **Idle safety net** — a check shortly after mount, then every 24h, for a
   session that sits on one screen and never triggers the route effect.

There's a fourth, unconditional trigger outside the scheduler: whenever
`credentials.workerUrl` or `credentials.workerVersion` changes (a fresh
install, or an update just landed via the runner below), the check re-runs
immediately regardless of staleness — the connected Worker itself changed, so
the cached result is known-stale.

`desktopCheckWorkerUpdate()` requires `isDesktopRuntime()`, a connected
Worker (`credentials.workerUrl`), and an owner session (not `teamLogin`) —
`enabled()` gates all three before the scheduler will fire.

## Running: `WorkerUpdateRunnerContext`

Drives the actual update: `start()` previews the update target
(`desktopPreviewWorkerUpdateTarget`) to confirm the saved Worker still
matches the authorized Cloudflare account, then runs
`desktopUpdateInstalledWorker()` in the background — the promise resolves as
soon as the run is kicked off, so the caller can navigate to a progress
screen (or away entirely) without waiting on the download/deploy. Progress is
observed via `logs` (streamed `InstallLogEvent`s) and `phase`
(`idle → checking → running → done | error`). `cancel()` stops an in-flight
run; `reset()` clears a finished/errored run so the progress view can start
over.

The runner state lives in a MobX store —
[`WorkerUpdateRunnerStore`](./worker-update-runner-store.ts) — instantiated
once in `WorkerUpdateRunnerProvider` (in `AppProviders`), so the run survives
route changes and any component can subscribe. The sidebar's
`WorkerUpdateBanner` reads `isInstalling` from the store: while an update is
in flight it swaps the "Update now" button for a clickable "Installing
Worker…" status that links to `/settings/worker/progress`, instead of
offering an update that's already running.

On success it re-verifies the connection, saves the new `workerUrl` /
`workerVersion` to credentials, and best-effort registers the Worker with the
console — which is what feeds back into `WorkerUpdateCheckContext`'s
credential-change trigger above, closing the loop.

## Why a shared scheduler module

[`useRouteStaleScheduler`](../scheduler/useRouteStaleScheduler.ts) is generic
— it takes `{ enabled, isBusy, check, staleMs }` and knows nothing about
Workers or the desktop app. Both this context and
[`AppUpdaterContext`](../updater/AppUpdaterContext.tsx) (desktop app update
checks) use the same instance of the hook rather than duplicating the
route-watching + idle-timer logic, so "recheck on stale + navigation" behaves
identically for both and only needs to be fixed in one place.
