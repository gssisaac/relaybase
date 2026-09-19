# Agent guide — Relaybase (`main` repo)

Private product monorepo: desktop app, Next.js UI, HQ, mobile. The product Worker lives in the sibling **`../worker/`** repo.

Instructions for coding agents: read the linked docs **before** changing the areas they cover. **This file is the single agent guide for `main/`** (routing, policies, and deep rules).

**Workspace layout** (all repos under `productions/relaybase/`): see [`../AGENT.md`](../AGENT.md) at the workspace root when using a multi-repo Cursor workspace.

---

## Current Product Status & Deployment Scope (중요 배포/운영 현황)

- **Desktop (macOS / Tauri)**: **라이브 프로덕션 운영 중 (실제 베타 고객 사용 중)**. 모든 기능 변경, Worker 업데이트 및 배포 검증은 데스크톱 고객의 무중단 메일 송수신 및 안정성을 최우선으로 해야 합니다.
- **Web (Browser)**: **내부 개발 및 검증 단계 (현재 배포 보류 / 라이브 배포 없음)**. 웹 관련 기능 개발은 진행 중이나 실서비스 배포는 데스크톱 안정화 이후로 미루어둔 상태입니다.

**Active implementation plan (Claude):** [`.claude/plans/web-owner-session.md`](.claude/plans/web-owner-session.md) — web owner session persist + `/login` landing. **Desktop behavior must not change.**

---

## Architecture Policy: Next.js First (탈 Rust 전략)

**99%+ of all new code, features, and business logic must be implemented in Next.js (`app/`)**, covering both Web (browser) and Desktop (Tauri).

- **Why**: Relaybase is a dual-runtime product (Web + Desktop). Implementing features in Rust creates duplication, breaks the Web experience, and slows iteration. AI agents must break the legacy habit of adding logic to Rust.
- **Rust's sole role**: `desktop/src-tauri/` is strictly a **Thin Shell** for OS-native capabilities the browser cannot access (OS Keyring, Touch ID, System Tray, OS Notifications, Window frame, native File open/reveal).
- **No Rust business logic**: Do not add Cloudflare API calls, install/update pipelines, data transformations, or HTTP request proxying (`worker_request`) in Rust.
- **Numbered migration registry** (M-01~M-10 vs N-01~N-10): **[docs/architecture/rust-migration-strategy.md](docs/architecture/rust-migration-strategy.md)**.

---

## Quick routing

| Task | Go to |
|------|-------|
| Inbox / dashboard / compose UI | `app/` |
| **탈 Rust 전략 / Web-First 정책** | **[docs/architecture/rust-migration-strategy.md](docs/architecture/rust-migration-strategy.md)** |
| macOS app, DMG, updater | `desktop/` |
| Marketing / download page | `hq/website/` |
| **Cutting a release** | **[docs/release/workflow.md](docs/release/workflow.md)** |
| Version pairing (desktop ↔ Worker) | [docs/release/version-sync.md](docs/release/version-sync.md) |
| macOS build / R2 / notarize | [desktop/docs/release.md](desktop/docs/release.md) |
| Worker pack + GitHub publish | [../worker/docs/RELEASE.md](../worker/docs/RELEASE.md) |
| New API route or mail logic | `../worker/src/` |
| Architecture, auth, features | `docs/` |

---

## Release (summary)

1. Branch: `release-X.Y.Z` (never bump versions on `main` directly).
2. Release notes + version bumps (desktop; Worker too when `worker/` changed).
3. `cd desktop && RELAYBASE_NOTARIZE=1 pnpm run build:macos` → R2 + `latest.json`.
4. `cd ../worker && pnpm run publish:github` when Worker shipped (**required** for in-app Worker updates).
5. `cd hq/website && pnpm run deploy:cf`.
6. Push branch → PR → merge.

Full checklist and common mistakes: **[docs/release/workflow.md](docs/release/workflow.md)**.

---

## Required reading by area

| When you are changing… | Read first |
|------------------------|------------|
| **Next.js First Policy, Rust removal, or Web/Desktop bridging** (M-01~M-10 vs N-01~N-10) | **[docs/architecture/rust-migration-strategy.md](docs/architecture/rust-migration-strategy.md)** |
| **Where data lives** (D1, R2, `~/.relaybase`, API routing, new durable fields) | [docs/architecture/storage-architecture.md](docs/architecture/storage-architecture.md) |
| **D1 migrations**, `POST /console/init-db` (empty only), `POST /console/migrate-db`, install probe, or `migrations_dir` paths | [docs/architecture/d1-migrations-and-init-db.md](docs/architecture/d1-migrations-and-init-db.md) |
| **Product Worker code** (sibling `../relaybase-worker/` — `src/`, `db/`, new `/console/*` or `/mail/*` routes) | Rebuild the Worker bundle — see **Worker bundle** below |
| Mailbox R2 layout (`relaybase-mailbox`, `inbound|sent {domain}/{id}/` thin `meta.json` + `raw.eml`, send-log, bucket copy scripts) | [docs/architecture/mailbox-r2.md](docs/architecture/mailbox-r2.md) |
| Desktop credentials, mail cache, UI prefs, API key vault, notifications, or any local persistence | [docs/desktop/home-storage.md](docs/desktop/home-storage.md) (`~/.relaybase` only) |
| Settings → Cloudflare OAuth (install token), `hq/console` OAuth routes, or desktop CF API install | [docs/auth/cf-oauth-install-token.md](docs/auth/cf-oauth-install-token.md) |
| **Install, Login, and Recovery Lifecycle** (Use cases, edge cases, passtoken overwrite, deadlock prevention) | [docs/auth/install-auth-recovery-spec.md](docs/auth/install-auth-recovery-spec.md) |
| Owner login (passtoken + sessions), `AUTH_PEPPER`, `/console/login` / `setup-admin` / `reset-admin`, or retiring `ADMIN_TOKEN` | [docs/architecture/storage-architecture.md](docs/architecture/storage-architecture.md) → *Owner auth* |
| Desktop owner/invited unlock, keyring passtoken + Touch ID read-gate, `AppSessionStore` phase machine, team keyring (`team-session`), or scoped 401 re-prompt | [docs/auth/desktop-session-machine.md](docs/auth/desktop-session-machine.md) + [docs/auth/authentication.md](docs/auth/authentication.md) |
| Email Cmd+K, row context menus, mail action shortcuts, or anything under `app/src/email/commands/` | [docs/desktop/email-command-system.md](docs/desktop/email-command-system.md) |
| App entry redirects, sidebar email↔dashboard persistence, last-route restore | [docs/desktop/last-route-restore.md](docs/desktop/last-route-restore.md) |
| Full-screen app loading (boot, last-route restore, trampoline wait) | [docs/desktop/app-loading-screen.md](docs/desktop/app-loading-screen.md) — use `AppLoadingScreen`, not a second "Loading…" layout |
| Tab / focus navigation, `data-allow-tab-focus`, or `DisableAppTabFocus` | [docs/desktop/tab-focus-policy.md](docs/desktop/tab-focus-policy.md) |
| Audience groups, data-source sync/cron, Progress tab, or Broadcasts (draft → send) | [docs/features/audience-and-broadcasts.md](docs/features/audience-and-broadcasts.md) |
| Inbound Worker storage, conversation threading, account filters, Sent-in-Inbox, `(me)` labels, or compose send → Sent | [docs/features/inbox-threading.md](docs/features/inbox-threading.md) |
| Flutter mobile app, `/mobile/*`, per-account mobile password, Other device tab, or teammate account scoping | [docs/features/mobile-companion.md](docs/features/mobile-companion.md) |
| Send/bounce logging, Dashboard Log page, D1 `RELAYBASE_LOGS`, or `ops_log` schema | [docs/architecture/ops-log-d1.md](docs/architecture/ops-log-d1.md) |
| HQ console/admin storage (`strum-relaybase-ops`, licenses, accounts, waitlist, beta invites, operator settings) | [docs/architecture/hq-ops-d1.md](docs/architecture/hq-ops-d1.md) |
| Mail search, D1 `RELAYBASE_MAIL` / `mailbox_fts`, list header counts, Sent pagination, or list virtualization | [docs/architecture/mailbox-d1.md](docs/architecture/mailbox-d1.md) |
| Inbox/sent sender avatars (favicon), `SenderAvatar`, `SenderIconStore`, or `/mail/favicon` proxy | [docs/desktop/sender-favicon-cache.md](docs/desktop/sender-favicon-cache.md) |
| Dashboard page chrome (title bar, toolbar, content max-width) | [app/src/console/page-header-layout.md](app/src/console/page-header-layout.md) |
| **Domain / account pickers** in Studio, email dialogs (searchable lists — not mail Cmd+K) | [docs/desktop/cmd-dropdown-ui.md](docs/desktop/cmd-dropdown-ui.md) |
| BIMI / VMC / “logo in Gmail” / inbox brand marks | [docs/decisions/bimi-vmc-do-not-build.md](docs/decisions/bimi-vmc-do-not-build.md) (do **not** build) |
| Marketing site feature clips (`hq/website` homepage videos) | [hq/website/docs/feature-video-encode.md](hq/website/docs/feature-video-encode.md) — also [hq/website/AGENT.md](hq/website/AGENT.md) |
| **Desktop or Worker release** (version bump, release notes, pack, website deploy) | [docs/release/workflow.md](docs/release/workflow.md) — start here — then [version-sync.md](docs/release/version-sync.md), [desktop/docs/release.md](desktop/docs/release.md), [`../worker/docs/RELEASE.md`](../worker/docs/RELEASE.md). |

## Storage (summary)

Two durable layers only — full map in **[docs/architecture/storage-architecture.md](docs/architecture/storage-architecture.md)**:

| Layer | Store | Use for |
|-------|--------|---------|
| Remote | D1 `RELAYBASE_DB` (`../relaybase-worker/db/app/`, binding `RELAYBASE_DB`) | All durable product state: domains, addresses, audience groups/contacts, broadcasts, branding, API keys, owner login (passtoken hash + sessions), mobile passwords, webhooks, owner config, `app_settings` (inbound retain-per-domain; default unlimited), pending inbound events. Sole source of truth — no KV. |
| Remote | Product Worker R2 `relaybase-mailbox` (binding `INBOUND`) | Mail atoms: `inbound|sent {domain}/{id}/` (thin `meta.json` + `raw.eml` + attachments) and send logs (`sent/_sendlog/{id}.json`, no `_index.json`). R2 is the source of truth. |
| Remote | D1 `RELAYBASE_LOGS` (hosted only) | Ops-event log: compose/API/broadcast sends + inbound bounces (Dashboard Log page). R2 `sent/_sendlog/*` stays authoritative for send history. Drizzle schema/helper: `../relaybase-worker/db/log/`. See **[docs/architecture/ops-log-d1.md](docs/architecture/ops-log-d1.md)**. |
| Remote | D1 `RELAYBASE_MAIL` (`../relaybase-worker/db/mail/`, binding `RELAYBASE_MAIL`) | Unified mail index: `mailbox_messages` (list/count/cursor, inbound **and** sent) + `mailbox_fts` (FTS5 search). Derived from R2 thin `meta.json` + `raw.eml`; fully rebuildable via `POST /console/rebuild-mail`. **Replaces** the old `RELAYBASE_INBOX_INDEX` / `inbound_search_fts`. See **[docs/architecture/mailbox-d1.md](docs/architecture/mailbox-d1.md)**. |
| Remote | D1 `strum-relaybase-ops` (binding `DB` on `strum-relaybase-admin` + `strum-relaybase-console` + `strum-relaybase-website`) | Shared HQ store: operator settings (`product_settings`), licenses, accounts, account_workers, account_recovery, waitlist, `beta_invites`. Drizzle in `hq/console/src/db/` (admin uses `product_settings` + `beta_invites` + `licenses`; website Worker uses `beta_invites` via raw SQL). See **[docs/architecture/hq-ops-d1.md](docs/architecture/hq-ops-d1.md)**. |
| Local | `~/.relaybase` | Workspace config (`workspace.json`), team-login, API key plaintext vault (`api-keys.json`), mail/UI/dashboard cache |
| Local | OS keyring | Owner refresh (`owner-session:{workerUrl}`, silent), owner passtoken (`owner-passtoken:{workerUrl}`, Touch ID to read), team mobile password (`team-session:{email}`), CF OAuth install refresh (`cf-oauth-install`, silent background update) |
| Local (phone) | Flutter secure storage + Hive | Mobile email + password; inbox/draft cache — **[docs/features/mobile-companion.md](docs/features/mobile-companion.md)** |

Do **not** reintroduce Next userdata / `DevUserEmailData`, cookie multi-tenant login, a product Worker KV binding, or license/account/billing routes on the product Worker (those live on `console.relaybase.xyz`). Do **not** store Cloudflare credentials, end-user dashboard auth tokens, or plaintext API keys in D1 `strum-relaybase-ops` `product_settings` — that table holds only an optional `workerUrl`; domain / DNS API uses the Worker `CF_API_TOKEN` wrangler secret (`CF_ACCOUNT_ID` is optional — see [docs/auth/cf-oauth-install-token.md](docs/auth/cf-oauth-install-token.md) → *Worker CF_ACCOUNT_ID*), owner auth uses the `AUTH_PEPPER` wrangler secret (passtoken hashing + access-token HMAC; tokens live in the product Worker's D1 `owner_sessions` hash-only), and plaintext API keys live only in `~/.relaybase/{scopeId}/api-keys.json`. Do **not** re-introduce the `ADMIN_TOKEN` wrangler secret, `owner_config.admin_token`, D1 `auth_tokens` (`rb-auth-…`), `/console/recover-admin`, or `/console/auth-tokens` — the desktop god token is retired in favor of the Worker-issued passtoken (see [docs/architecture/storage-architecture.md](docs/architecture/storage-architecture.md) → *Owner auth*). On desktop the owner passtoken / access / refresh are never written to `~/.relaybase`, cookies, localStorage, or sessionStorage. After first enrollment the passtoken plaintext lives in OS keyring `owner-passtoken` (Touch ID to **read**); refresh tokens live in `owner-session` (silent read); access stays in Tauri memory. On web (in development) the passtoken is never stored, access stays in JS memory, and only owner refresh tokens go to tab `sessionStorage` `relaybase:owner-session` (see [docs/auth/authentication.md](docs/auth/authentication.md) → *Web owner session*). Do **not** reintroduce Cloudflare KV — HQ ops is D1 `strum-relaybase-ops` only. New durable product fields go in `../relaybase-worker/db/app/` (Drizzle schema + helper), not as Cloudflare KV keys. All UI modes call the product Worker through `desktopAwareFetch` + `email-api-map.ts`; account/license/billing calls go to `console.relaybase.xyz`. Local Mac details: **[docs/desktop/home-storage.md](docs/desktop/home-storage.md)**. Mobile uses `/mobile/*` with per-account password auth (not admin token).

## Email commands (summary)

Mail actions must stay centralized in `app/src/email/commands/`:

- Static defs → resolve/run store → adapter → Cmd+K + context menu + command hotkeys
- Show **available-only** commands (selection-filtered); do not dump dashboard “Open …” nav into mail Cmd+K
- Keep app-layer ⌘K (capture) separate from mail-layer `j`/`k` shortcuts
- Compose open/resume/force-new: **`app/src/email/lib/compose/compose-open.ts`** adapters only (`useStandaloneComposeOpener` / `useThreadComposeOpener` / `composeNewHref`). Esc closes without discard; per-message UI Reply/Forward always starts a new draft

Full rules, file map, and add-command checklist: **[docs/desktop/email-command-system.md](docs/desktop/email-command-system.md)**.

## Mobile email companion (summary)

Flutter app under `mobile/` is a **teammate inbox**, not a second desktop:

- Login = **account email + per-account mobile password** only (Worker URL baked into the build)
- `/mobile/*` is always scoped to that one address — no “All inboxes”, no other accounts
- Desktop provisions credentials in Accounts → **Other device** (not a global Settings password)
- Do not put dashboard/management UI on the phone

Full policy: **[docs/features/mobile-companion.md](docs/features/mobile-companion.md)**.

## Desktop release (macOS)

Read **[desktop/docs/release.md](desktop/docs/release.md)** before any signed DMG / R2 / updater work.

- **Never metadata-only desktop releases** — always run a full `RELAYBASE_NOTARIZE=1 pnpm run build:macos` in the same session as the version bump. Do not rename or re-upload an older DMG/tar.gz under a new version filename. `verify-release-bundle.mjs` gates sync and R2 upload.
- **Never overwrite an existing `Relaybase.X.Y.Z.*` object on R2** — CDN uses `immutable` caching; the first upload for a version string can stick at the edge forever. Bump the patch and upload new keys (`0.1.3`, not re-upload `0.1.2`). `verify-cdn-release.mjs` checks the public URL after upload.

- **Ship / R2 / updater (Apple Silicon):** `cd desktop && RELAYBASE_NOTARIZE=1 pnpm run build:macos` (same as `pnpm run build` inside `desktop/`). Run from a normal terminal with network — sandboxed/agent runs can fail codesign timestamp.
- **Intel (ready, not default):** `pnpm run build:macos:x86_64` — same pipeline with `.x86_64.` artifact names. Download page keeps Intel disabled until `INTEL_MAC_DOWNLOAD_ENABLED` is flipped.
- **Local install smoke test (not a release):** `pnpm run desktop:install:local` from repo root, or `pnpm run install:local` in `desktop/`. Output under `src-tauri/target/release/bundle/`. See *Local install test* in `desktop/docs/release.md`.
- **Never** ship Universal / `universal-apple-darwin` — per-arch only. Release output: `target/aarch64-apple-darwin/release/bundle/` (or `x86_64-apple-darwin`). `verify-arch-app.sh` rejects fat binaries.
- **Never** add `keychain-access-groups` to `entitlements.plist` for Developer ID builds — macOS 26 AMFI blocks launch (error 163) even when notarization passes. See **Build cautions** in `desktop/docs/release.md`.
- R2 upload uses the **website** Cloudflare account from `hq/website/wrangler.jsonc`, not necessarily `desktop/.env` `CLOUDFLARE_ACCOUNT_ID`.

## Worker bundle

The product Worker lives in the sibling repo **`../relaybase-worker/`** (clone next to this monorepo, or set `RELAYBASE_WORKER_DIR`). Desktop install and Settings → Worker update upload a **pre-built** `worker.js`, not TypeScript from that repo. Editing Worker source does **not** change the running Worker until you rebuild.

After any change that ships in the product Worker (routes, `/health`, `init-db` / `migrate-db`, auth, mail, D1 helpers, `db/migrations.ts`):

```bash
cd ../relaybase-worker && pnpm run build:bundle
```

That writes `../relaybase-worker/dist/worker-build/index.js` for dogfood `wrangler deploy`. Desktop install/update downloads the **GitHub Release** ZIP (`worker.{version}.js` inside) — it does not overlay a local `worker.js`. Until you publish a Worker GitHub Release, Settings → Update Worker still uploads the previous script.

For the public install ZIP:

```bash
cd ../relaybase-worker && pnpm run publish:github
```

See [`../relaybase-worker/docs/RELEASE.md`](../relaybase-worker/docs/RELEASE.md).

## General

- Prefer existing module boundaries; do not re-scatter command logic into `MailListView`.
- Do not commit secrets. Do not force-push `main`.
- Match existing pnpm / shadcn patterns in the repo. `app/` is Next for HMR + static Tauri export — not an OpenNext hosted product API.
