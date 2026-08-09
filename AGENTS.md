# Agent guide — Relaybase

Instructions for coding agents working in this repository. Read the linked docs **before** changing the areas they cover.

## Required reading by area

| When you are changing… | Read first |
|------------------------|------------|
| Email Cmd+K, row context menus, mail action shortcuts, or anything under `app/src/email/commands/` | [docs/email-command-system.md](docs/email-command-system.md) |
| App entry redirects, sidebar email↔dashboard persistence, last-route restore | [docs/last-route-restore.md](docs/last-route-restore.md) |
| Desktop credentials, mail cache, UI prefs, notifications, or any local persistence | [docs/relaybase-home-storage.md](docs/relaybase-home-storage.md) (`~/.relaybase` only) |
| Tab / focus navigation, `data-allow-tab-focus`, or `DisableAppTabFocus` | [docs/tab-focus-policy.md](docs/tab-focus-policy.md) |
| Audience groups, data-source sync/cron, Progress tab, or Broadcasts (draft → send) | [docs/audience-and-broadcasts.md](docs/audience-and-broadcasts.md) |
| BIMI / VMC / “logo in Gmail” / inbox brand marks | [docs/bimi-vmc-do-not-build.md](docs/bimi-vmc-do-not-build.md) (do **not** build) |

## Email commands (summary)

Mail actions must stay centralized in `app/src/email/commands/`:

- Static defs → resolve/run store → adapter → Cmd+K + context menu + command hotkeys
- Show **available-only** commands (selection-filtered); do not dump dashboard “Open …” nav into mail Cmd+K
- Keep app-layer ⌘K (capture) separate from mail-layer `j`/`k` shortcuts

Full rules, file map, and add-command checklist: **[docs/email-command-system.md](docs/email-command-system.md)**.

## Desktop storage (summary)

Mac app durable data lives **only** under `~/.relaybase` (via Tauri). Do not use `localhost` / WebKit `localStorage` or Application Support as the source of truth — see **[docs/relaybase-home-storage.md](docs/relaybase-home-storage.md)**.

## General

- Prefer existing module boundaries; do not re-scatter command logic into `MailListView`.
- Do not commit secrets. Do not force-push `main`.
- Match existing pnpm / OpenNext / shadcn patterns in the repo.
