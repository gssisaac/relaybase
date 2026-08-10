# Agent guide — Relaybase

Instructions for coding agents working in this repository. Read the linked docs **before** changing the areas they cover.

## Required reading by area

| When you are changing… | Read first |
|------------------------|------------|
| **Where data lives** (KV, R2, `~/.relaybase`, API routing, new durable fields) | [docs/storage-architecture.md](docs/storage-architecture.md) |
| Desktop credentials, mail cache, UI prefs, API key vault, notifications, or any local persistence | [docs/relaybase-home-storage.md](docs/relaybase-home-storage.md) (`~/.relaybase` only) |
| Email Cmd+K, row context menus, mail action shortcuts, or anything under `app/src/email/commands/` | [docs/email-command-system.md](docs/email-command-system.md) |
| App entry redirects, sidebar email↔dashboard persistence, last-route restore | [docs/last-route-restore.md](docs/last-route-restore.md) |
| Tab / focus navigation, `data-allow-tab-focus`, or `DisableAppTabFocus` | [docs/tab-focus-policy.md](docs/tab-focus-policy.md) |
| Audience groups, data-source sync/cron, Progress tab, or Broadcasts (draft → send) | [docs/audience-and-broadcasts.md](docs/audience-and-broadcasts.md) |
| Inbound Worker storage, conversation threading, account filters, Sent-in-Inbox, `(me)` labels, or compose send → Sent | [docs/inbox-threading-and-multi-account.md](docs/inbox-threading-and-multi-account.md) |
| BIMI / VMC / “logo in Gmail” / inbox brand marks | [docs/bimi-vmc-do-not-build.md](docs/bimi-vmc-do-not-build.md) (do **not** build) |

## Storage (summary)

Two durable layers only — full map in **[docs/storage-architecture.md](docs/storage-architecture.md)**:

| Layer | Store | Use for |
|-------|--------|---------|
| Remote | Worker KV `RELAYBASE_APP` (`srv:*` keys) + R2 inbound | Domains, addresses, audience, broadcasts, key hashes, send logs, inbox |
| Local | `~/.relaybase` | Credentials, API key plaintext, mail/UI/dashboard cache |

Do **not** reintroduce Next userdata / `DevUserEmailData`, cookie multi-tenant login, or a second mail-Worker KV binding. All UI modes call the Worker through `desktopAwareFetch` + `email-api-map.ts`. Local Mac details: **[docs/relaybase-home-storage.md](docs/relaybase-home-storage.md)**.

## Email commands (summary)

Mail actions must stay centralized in `app/src/email/commands/`:

- Static defs → resolve/run store → adapter → Cmd+K + context menu + command hotkeys
- Show **available-only** commands (selection-filtered); do not dump dashboard “Open …” nav into mail Cmd+K
- Keep app-layer ⌘K (capture) separate from mail-layer `j`/`k` shortcuts

Full rules, file map, and add-command checklist: **[docs/email-command-system.md](docs/email-command-system.md)**.

## General

- Prefer existing module boundaries; do not re-scatter command logic into `MailListView`.
- Do not commit secrets. Do not force-push `main`.
- Match existing pnpm / shadcn patterns in the repo. `app/` is Next for HMR + static Tauri export — not an OpenNext hosted product API.
