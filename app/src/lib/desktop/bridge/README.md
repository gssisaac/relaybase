# Desktop bridge

TypeScript facade for the Tauri desktop shell. UI and stores call Rust commands through these modules instead of importing `@tauri-apps/api` directly.

**Import from the barrel only:**

```ts
import { desktopGetCredentials, isDesktopRuntime } from "@/lib/desktop/bridge";
```

Do not deep-import `./invoke` or sibling files from app code — keeps the public surface stable and avoids cycles.

## Layout

| File | Responsibility |
|------|----------------|
| `index.ts` | Re-exports everything below |
| `invoke.ts` | `window.__TAURI__` detection, `invoke()`, `formatDesktopError`, `desktopGetInfo` |
| `cloudflare.ts` | CF dashboard URLs, install ZIP/manifest constants, OAuth scope labels, `mailApiReady` |
| `errors.ts` | `explainDesktopError`, `explainCfOAuthError`, `explainWorkerUpdateTargetError` |
| `oauth.ts` | Cloudflare install OAuth (start, deep link, Rust `cf-oauth-complete` events) |
| `install.ts` | Worker auto-install, update, rollback, init/migrate-db, install log events |
| `credentials.ts` | `DesktopCredentials` read/write, Relaybase account fields on disk |
| `credentials-local.ts` | Browser dev fallback via `/api/local-credentials` (internal) |
| `worker.ts` | `/console/connect` verify, zones, server token push, console recovery helpers |
| `owner.ts` | Owner keyring session (login, unlock, Touch ID, setup/reset admin) |
| `team.ts` | Invited teammate keyring session |
| `storage.ts` | `~/.relaybase` mail/cache JSON, email prefs, API key vault, layout migrations |
| `files.ts` | Open external URLs, attachments, Downloads, reveal in Finder |

## Dependency rules

- Only `invoke.ts` touches `window.__TAURI__`.
- `worker.ts` lazy-imports `@/lib/desktop/auth` inside `desktopVerifyWorkerConnection` to avoid an auth ↔ bridge cycle.
- `credentials-local.ts` is not re-exported from `index.ts`; shared by `credentials.ts` and `worker.ts` for browser fallback only.

## Related docs

- Cloudflare OAuth install token: [`docs/auth/cf-oauth-install-token.md`](../../../../../docs/auth/cf-oauth-install-token.md)
- Desktop session phases: [`docs/auth/desktop-session-machine.md`](../../../../../docs/auth/desktop-session-machine.md)
- Local persistence: [`docs/desktop/home-storage.md`](../../../../../docs/desktop/home-storage.md)

Rust command implementations live in `desktop/src-tauri/src/`.
