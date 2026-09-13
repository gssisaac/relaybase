# mail-platform

Platform-agnostic facade for the Relaybase mail client.

## Purpose

`email/` UI code talks only to the ports defined here. Concrete
implementations are selected by the build flavor:

- **`email` mode** — web-only mail client (no console, no Touch ID).
  Assembled by `EmailAppProviders` in `runtime/`.
- **`console` mode** — full desktop app with owner dashboard.
  `ConsoleAppProviders` + existing `AppProviders` (`lib/desktop/shell`).

Naming: `email` vs `console` (not `team` vs `owner`) because an owner
using the web build also lands in `email` mode.

**Architecture (auth adapters, provider trees, team account seeding):**
[`docs/architecture/mail-platform-auth.md`](../../../docs/architecture/mail-platform-auth.md)

## Structure

```
mail-platform/
├── types.ts              # Port interfaces (AuthSession, MailTransport, …)
├── transport/           # API path mapping + fetch
│   ├── map-email-mobile.ts   # /api/email/* → /mobile/*
│   ├── email-transport.ts    # Web: Bearer + X-Account-Email
│   └── console-transport.ts  # Desktop: delegates to desktopAwareFetch
├── session/             # Auth adapters
│   ├── email-session.ts      # Web: WebSessionStore (AuthSession)
│   └── console-session.ts    # Desktop: useConsoleSession()
├── storage/             # durable cache
│   ├── web-storage.ts        # localStorage + IndexedDB
│   └── desktop-storage.ts   # Tauri invoke (~/.relaybase)
├── shell/               # OS + chrome
│   ├── web-platform.ts
│   ├── desktop-platform.ts
│   ├── web-chrome.ts
│   └── desktop-chrome.ts
├── runtime/             # Assembly
│   ├── MailRuntimeContext.tsx  # useMailRuntime()
│   ├── EmailAppProviders.tsx   # Web mail
│   └── ConsoleAppProviders.tsx # Desktop mail subtree
└── index.ts             # Barrel
```

## Entry point for mail UI

```ts
import { useMailRuntime } from "@/mail-platform/runtime";

const { session, transport, accountScopeId } = useMailRuntime();
```

Prefer `session.isTeamMode`, `session.accountEmail`, and `session.workerUrl`
over `useDesktop().teamLogin` in `email/*`.

## Migration status

**Done:**

- `AuthSession` port + `WebSessionStore` / `useConsoleSession()`
- `EmailAppProviders` + `ConsoleAppProviders` with `MailRuntimeProvider`
- `MailAccountsProvider` passes `session`; team/web auto-seeds single account
- Sidebar, settings, mailbox context use `useMailRuntime()` for team/scope

**Remaining:**

1. Replace remaining `desktopAwareFetch` in `email/stores/*` with
   `transport.fetch` (mailbox store is the largest consumer).
2. Replace `desktopGetMailJson` / `desktopSaveMailJson` in
   `email/lib/disk/*` with `useMailRuntime().storage` where appropriate.
3. Replace `notifyNewMail` / `setTrayUnread` with `runtime.platform`.
4. Reduce `@/console` imports from `email/` via `features` flags.
