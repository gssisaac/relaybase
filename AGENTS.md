# Agent guide — Relaybase

Instructions for coding agents working in this repository. Read the linked docs **before** changing the areas they cover.

## Required reading by area

| When you are changing… | Read first |
|------------------------|------------|
| **Where data lives** (KV, R2, `~/.relaybase`, API routing, new durable fields) | [docs/storage-architecture.md](docs/storage-architecture.md) |
| Mailbox R2 bucket (`relaybase-mailbox`), `inbound/` / `sent/` prefixes, send-log move off KV, or bucket copy scripts | [docs/mailbox-r2.md](docs/mailbox-r2.md) |
| Desktop credentials, mail cache, UI prefs, API key vault, notifications, or any local persistence | [docs/relaybase-home-storage.md](docs/relaybase-home-storage.md) (`~/.relaybase` only) |
| Settings → Cloudflare OAuth (install token), `kembo/console` OAuth routes, or desktop wrangler OAuth | [docs/cf-oauth-install-token.md](docs/cf-oauth-install-token.md) |
| Email Cmd+K, row context menus, mail action shortcuts, or anything under `app/src/email/commands/` | [docs/email-command-system.md](docs/email-command-system.md) |
| App entry redirects, sidebar email↔dashboard persistence, last-route restore | [docs/last-route-restore.md](docs/last-route-restore.md) |
| Tab / focus navigation, `data-allow-tab-focus`, or `DisableAppTabFocus` | [docs/tab-focus-policy.md](docs/tab-focus-policy.md) |
| Audience groups, data-source sync/cron, Progress tab, or Broadcasts (draft → send) | [docs/audience-and-broadcasts.md](docs/audience-and-broadcasts.md) |
| Inbound Worker storage, conversation threading, account filters, Sent-in-Inbox, `(me)` labels, or compose send → Sent | [docs/inbox-threading-and-multi-account.md](docs/inbox-threading-and-multi-account.md) |
| Flutter mobile app, `/mobile/*`, per-account mobile password, Other device tab, or teammate account scoping | [docs/mobile-email-companion.md](docs/mobile-email-companion.md) |
| Send/bounce logging, Dashboard Log page, D1 `RELAYBASE_LOGS`, or `ops_log` schema | [docs/ops-log-d1.md](docs/ops-log-d1.md) |
| Kembo console/admin storage (`kembo-ops`, licenses, accounts, waitlist, operator settings) | [docs/kembo-ops-d1.md](docs/kembo-ops-d1.md) |
| Mail search, D1 `RELAYBASE_INBOX_INDEX` / FTS5, list header counts, Sent pagination, or list virtualization | [docs/inbound-search-d1-fts5.md](docs/inbound-search-d1-fts5.md) |
| Inbox/sent sender avatars (favicon), `SenderAvatar`, `SenderIconStore`, or `/mail/favicon` proxy | [docs/sender-favicon-cache.md](docs/sender-favicon-cache.md) |
| Dashboard page chrome (title bar, toolbar, content max-width) | [app/src/console/page-header-layout.md](app/src/console/page-header-layout.md) |
| BIMI / VMC / “logo in Gmail” / inbox brand marks | [docs/bimi-vmc-do-not-build.md](docs/bimi-vmc-do-not-build.md) (do **not** build) |

## Storage (summary)

Two durable layers only — full map in **[docs/storage-architecture.md](docs/storage-architecture.md)**:

| Layer | Store | Use for |
|-------|--------|---------|
| Remote | D1 `RELAYBASE_DB` (`server/db/app/`, binding `RELAYBASE_DB`) | All durable product state migrated from KV: domains, addresses, audience groups/contacts, broadcasts, branding, API keys, dashboard auth tokens, mobile passwords, webhooks, owner config, pending inbound events. Sole source of truth post-cutover (no dual-write / KV fallback). |
| Remote | Product Worker R2 `relaybase-mailbox` (binding `INBOUND`) | Mail bodies (`inbound/{domain}/…`) and send logs (`sent/_sendlog/*`). Unchanged. |
| Remote | Product Worker KV `RELAYBASE_APP` (namespace `relaybase-app`) | **No longer the catalog source of truth.** Kept (emptied, binding not removed yet). No CF creds in KV; only `srv:config:admin` (admin token hash, legacy fallback read by `lib/auth.ts`; `ADMIN_TOKEN` wrangler secret takes precedence) still uses KV — not migrated to D1. `srv:config:cloudflare` is no longer written or read — the Worker reads `CF_ACCOUNT_ID` / `CF_API_TOKEN` wrangler secrets only. |
| Remote | D1 `RELAYBASE_LOGS` (hosted only) | Ops-event log: compose/API/broadcast sends + inbound bounces (Dashboard Log page). R2 `sent/_sendlog/*` stays authoritative for send history. Drizzle schema/helper: `server/db/log/`. See **[docs/ops-log-d1.md](docs/ops-log-d1.md)**. |
| Remote | D1 `RELAYBASE_INBOX_INDEX` (optional) | FTS5 inbound search index, derived from R2. Drizzle schema/helper: `server/db/inbox-index/`. See **[docs/inbound-search-d1-fts5.md](docs/inbound-search-d1-fts5.md)**. |
| Remote | D1 `kembo-ops` (binding `DB` on `kembo-admin` + `kembo-console`) | Shared Kembo store: operator settings (`product_settings`), licenses, accounts, account_workers, account_recovery, waitlist. Drizzle in `kembo/console/src/db/` (admin uses `product_settings` only). See **[docs/kembo-ops-d1.md](docs/kembo-ops-d1.md)**. |
| Local | `~/.relaybase` | Credentials, team-login, API key plaintext vault (`api-keys.json`), mail/UI/dashboard cache |
| Local (phone) | Flutter secure storage + Hive | Mobile email + password; inbox/draft cache — **[docs/mobile-email-companion.md](docs/mobile-email-companion.md)** |

Do **not** reintroduce Next userdata / `DevUserEmailData`, cookie multi-tenant login, a second mail-Worker KV binding, or license/account/billing routes on the product Worker (those live on `console.relaybase.xyz`). Do **not** store Cloudflare credentials, end-user dashboard auth tokens, or plaintext API keys in D1 `kembo-ops` `product_settings` — that table holds only `workerUrl` + `adminToken`; CF creds come from Worker wrangler secrets (`CF_ACCOUNT_ID` / `CF_API_TOKEN`), tokens live in the product Worker's D1 `auth_tokens` (hash-only), and plaintext API keys live only in `~/.relaybase/api-keys.json`. Do **not** re-bind `KEMBO_OPS` / `KEMBO_LICENSES` / `KEMBO_ACCOUNTS`. New durable product fields go in `server/db/app/` (Drizzle schema + helper), not as `srv:*` KV keys. All UI modes call the product Worker through `desktopAwareFetch` + `email-api-map.ts`; account/license/billing calls go to `console.relaybase.xyz`. Local Mac details: **[docs/relaybase-home-storage.md](docs/relaybase-home-storage.md)**. Mobile uses `/mobile/*` with per-account password auth (not admin token).

## Email commands (summary)

Mail actions must stay centralized in `app/src/email/commands/`:

- Static defs → resolve/run store → adapter → Cmd+K + context menu + command hotkeys
- Show **available-only** commands (selection-filtered); do not dump dashboard “Open …” nav into mail Cmd+K
- Keep app-layer ⌘K (capture) separate from mail-layer `j`/`k` shortcuts
- Compose open/resume/force-new: **`app/src/email/lib/compose/compose-open.ts`** adapters only (`useStandaloneComposeOpener` / `useThreadComposeOpener` / `composeNewHref`). Esc closes without discard; per-message UI Reply/Forward always starts a new draft

Full rules, file map, and add-command checklist: **[docs/email-command-system.md](docs/email-command-system.md)**.

## Mobile email companion (summary)

Flutter app under `mobile/` is a **teammate inbox**, not a second desktop:

- Login = **account email + per-account mobile password** only (Worker URL baked into the build)
- `/mobile/*` is always scoped to that one address — no “All inboxes”, no other accounts
- Desktop provisions credentials in Accounts → **Other device** (not a global Settings password)
- Do not put dashboard/management UI on the phone

Full policy: **[docs/mobile-email-companion.md](docs/mobile-email-companion.md)**.

## General

- Prefer existing module boundaries; do not re-scatter command logic into `MailListView`.
- Do not commit secrets. Do not force-push `main`.
- Match existing pnpm / shadcn patterns in the repo. `app/` is Next for HMR + static Tauri export — not an OpenNext hosted product API.
