# Relaybase Documentation Index

Technical documentation index for AI agents and engineers. Read the relevant docs for your area **before** making changes.

---

## 1. Quick Task → Documentation Map

| If you are changing… | Primary doc | Secondary docs |
|----------------------|-------------|----------------|
| **Data storage / DB fields / API routing** | [`architecture/storage-architecture.md`](./architecture/storage-architecture.md) | [`desktop/home-storage.md`](./desktop/home-storage.md) |
| **D1 migrations / init-db / migrate-db** | [`architecture/d1-migrations-and-init-db.md`](./architecture/d1-migrations-and-init-db.md) | [`architecture/storage-architecture.md`](./architecture/storage-architecture.md) |
| **R2 mailbox layout / raw email storage** | [`architecture/mailbox-r2.md`](./architecture/mailbox-r2.md) | [`architecture/mailbox-d1.md`](./architecture/mailbox-d1.md) |
| **Mail search / FTS5 / list counts / Sent** | [`architecture/mailbox-d1.md`](./architecture/mailbox-d1.md) | [`architecture/mailbox-r2.md`](./architecture/mailbox-r2.md) |
| **Send/bounce logging / Dashboard Log page** | [`architecture/ops-log-d1.md`](./architecture/ops-log-d1.md) | [`architecture/d1-migrations-and-init-db.md`](./architecture/d1-migrations-and-init-db.md) |
| **Central HQ store (`strum-relaybase-ops`)** | [`architecture/hq-ops-d1.md`](./architecture/hq-ops-d1.md) | [`decisions/pivot-byo-cloudflare.md`](./decisions/pivot-byo-cloudflare.md) |
| **Worker install / login / passtoken recovery lifecycle** | [`auth/install-auth-recovery-spec.md`](./auth/install-auth-recovery-spec.md) | [`auth/authentication.md`](./auth/authentication.md) |
| **Auth model (owner / teammate / mobile / API key)** | [`auth/authentication.md`](./auth/authentication.md) | [`auth/desktop-session-machine.md`](./auth/desktop-session-machine.md) |
| **Desktop session state machine (`AppSessionStore`)** | [`auth/desktop-session-machine.md`](./auth/desktop-session-machine.md) | [`desktop/home-storage.md`](./desktop/home-storage.md) |
| **Cloudflare OAuth install token** | [`auth/cf-oauth-install-token.md`](./auth/cf-oauth-install-token.md) | [`auth/install-auth-recovery-spec.md`](./auth/install-auth-recovery-spec.md) |
| **Desktop local storage (`~/.relaybase`)** | [`desktop/home-storage.md`](./desktop/home-storage.md) | [`auth/authentication.md`](./auth/authentication.md) |
| **Email commands (⌘K / context menu / shortcuts / compose)** | [`desktop/email-command-system.md`](./desktop/email-command-system.md) | [`desktop/tab-focus-policy.md`](./desktop/tab-focus-policy.md) |
| **App entry route restore / sidebar mode persistence** | [`desktop/last-route-restore.md`](./desktop/last-route-restore.md) | [`desktop/app-loading-screen.md`](./desktop/app-loading-screen.md) |
| **Full-screen loading (`AppLoadingScreen`)** | [`desktop/app-loading-screen.md`](./desktop/app-loading-screen.md) | [`desktop/last-route-restore.md`](./desktop/last-route-restore.md) |
| **Tab-key focus policy** | [`desktop/tab-focus-policy.md`](./desktop/tab-focus-policy.md) | [`desktop/email-command-system.md`](./desktop/email-command-system.md) |
| **Sender favicon / avatar cache** | [`desktop/sender-favicon-cache.md`](./desktop/sender-favicon-cache.md) | [`decisions/bimi-vmc-do-not-build.md`](./decisions/bimi-vmc-do-not-build.md) |
| **Audience groups / broadcasts / cron sync** | [`features/audience-and-broadcasts.md`](./features/audience-and-broadcasts.md) | [`architecture/storage-architecture.md`](./architecture/storage-architecture.md) |
| **Inbox threading / multi-account mail** | [`features/inbox-threading.md`](./features/inbox-threading.md) | [`architecture/mailbox-d1.md`](./architecture/mailbox-d1.md) |
| **Flutter mobile companion / teammate mail scoping** | [`features/mobile-companion.md`](./features/mobile-companion.md) | [`auth/authentication.md`](./auth/authentication.md) |
| **Desktop / Worker release and version sync** | [`release/version-sync.md`](./release/version-sync.md) | `desktop/docs/release.md` |
| **BYO Cloudflare architecture pivot** | [`decisions/pivot-byo-cloudflare.md`](./decisions/pivot-byo-cloudflare.md) | [`architecture/storage-architecture.md`](./architecture/storage-architecture.md) |
| **BIMI / VMC inbox logo — do not build** | [`decisions/bimi-vmc-do-not-build.md`](./decisions/bimi-vmc-do-not-build.md) | [`desktop/sender-favicon-cache.md`](./desktop/sender-favicon-cache.md) |

---

## 2. Directory Structure & Documentation Catalog

### Architecture (`docs/architecture/`)
Remote infrastructure, databases, storage bindings, and migration rules.
- **[`storage-architecture.md`](./architecture/storage-architecture.md)** — Two-layer durable storage: D1 + R2 + `~/.relaybase`.
- **[`d1-migrations-and-init-db.md`](./architecture/d1-migrations-and-init-db.md)** — Worker-owned D1 migrations and `POST /console/init-db` / `migrate-db` contracts.
- **[`mailbox-r2.md`](./architecture/mailbox-r2.md)** — `relaybase-mailbox` R2 layout: thin `meta.json` + `raw.eml` + `sent/_sendlog/`.
- **[`mailbox-d1.md`](./architecture/mailbox-d1.md)** — `relaybase-mail` D1: `mailbox_messages` + `mailbox_fts` (FTS5) unified mail index.
- **[`ops-log-d1.md`](./architecture/ops-log-d1.md)** — `relaybase-logs` D1 `ops_log` table and Dashboard Log stream.
- **[`hq-ops-d1.md`](./architecture/hq-ops-d1.md)** — Central `strum-relaybase-ops` D1 schema (licenses, console accounts, recovery tokens, etc.).

### Authentication & Lifecycle (`docs/auth/`)
Owner/teammate auth, session state machine, OS keychain integration, Worker install and recovery lifecycle.
- **[`install-auth-recovery-spec.md`](./auth/install-auth-recovery-spec.md)** — Install, reinstall, login, passtoken overwrite, and deadlock-prevention spec.
- **[`authentication.md`](./auth/authentication.md)** — Four auth surfaces (owner passtoken, team mobile password, mobile app, API key) and token scoping.
- **[`desktop-session-machine.md`](./auth/desktop-session-machine.md)** — `AppSessionStore`: silent boot, keychain read-gate, session phase transitions.
- **[`cf-oauth-install-token.md`](./auth/cf-oauth-install-token.md)** — Cloudflare OAuth PKCE install token issuance and management.

### Desktop Client & UI Policy (`docs/desktop/`)
Tauri desktop app conventions, local filesystem persistence, UI/UX policy.
- **[`home-storage.md`](./desktop/home-storage.md)** — `$HOME/.relaybase` as the single source of truth; keychain secret handling.
- **[`email-command-system.md`](./desktop/email-command-system.md)** — Superhuman-style ⌘K command palette, context menus, shortcut layers.
- **[`last-route-restore.md`](./desktop/last-route-restore.md)** — Per-sidebar-mode last-path persistence and app-entry restore.
- **[`app-loading-screen.md`](./desktop/app-loading-screen.md)** — Single full-screen wait UI with no flicker (`AppLoadingScreen`).
- **[`tab-focus-policy.md`](./desktop/tab-focus-policy.md)** — Tab navigation blocked by default; opt-in in compose via `data-allow-tab-focus`.
- **[`sender-favicon-cache.md`](./desktop/sender-favicon-cache.md)** — One favicon fetch per sender domain per session; in-memory avatar cache.

### Features (`docs/features/`)
Core product feature specs and business policy.
- **[`audience-and-broadcasts.md`](./features/audience-and-broadcasts.md)** — Audience groups, generic JSON data-source sync, broadcast sends.
- **[`inbox-threading.md`](./features/inbox-threading.md)** — Inbound threading, `(me)` sender labels, read/unread on the Worker.
- **[`mobile-companion.md`](./features/mobile-companion.md)** — Flutter teammate email companion (single-account scope; no dashboard UI).

### Decisions & Strategy (`docs/decisions/`)
Product direction changes and architecture decision records (ADRs).
- **[`pivot-byo-cloudflare.md`](./decisions/pivot-byo-cloudflare.md)** — Pivot from hosted SaaS to user-owned Cloudflare Worker desktop app.
- **[`bimi-vmc-do-not-build.md`](./decisions/bimi-vmc-do-not-build.md)** — Permanent rejection of BIMI inbox logos (paid VMC/CMC required by Gmail/Apple Mail).

### Release (`docs/release/`)
Release guides and version sync policy.
- **[`version-sync.md`](./release/version-sync.md)** — Desktop (`.app`) and Worker (`worker.js`) semver must match (pre-launch freeze at `0.1.1`).

### Marketing (`docs/marketing/`)
Marketing copy and feature descriptions.
- **[`FEATURES.md`](./marketing/FEATURES.md)** — End-user feature list and tier draft.
- **[`HOW-IT-WORKS.md`](./marketing/HOW-IT-WORKS.md)** — BYO Cloudflare install mechanism.

### Archive (`docs/archive/`)
Historical analysis, legacy code snapshots, and post-mortems (reference only — do not implement from these).
- **`business-plan-risk-and-market.md`** — Pre-pivot (2026-08-03) single-account shared-risk analysis.
- **`inbound-search-d1-fts5.md`** — Stub superseded by `mailbox-d1.md`.
- **`issue-reports/`** — Past bug post-mortems (5 reports).
- **`legacy/`** — Pre–console-gate biometry snapshots and analysis.
