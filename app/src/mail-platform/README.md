# mail-platform

Platform-agnostic facade for the Relaybase mail client.

## Purpose

`email/` UI code talks only to the ports defined here. Concrete
implementations are selected by the build flavor:

- **`email` mode** — web-only mail client (no console, no Touch ID).
  Assembled by `EmailAppProviders` in `runtime/`.
- **`console` mode** — full desktop app with owner dashboard.
  Driven by the existing `AppProviders` (`lib/desktop/shell`).

Naming: `email` vs `console` (not `team` vs `owner`) because an owner
using the web build also lands in `email` mode.

## Structure

```
mail-platform/
├── types.ts              # Port interfaces (MailTransport, MailSession, …)
├── transport/           # (1, 11) API path mapping + fetch
│   ├── map-email-mobile.ts   # /api/email/* → /mobile/*
│   ├── email-transport.ts    # Web: Bearer + X-Account-Email
│   └── console-transport.ts  # Desktop: delegates to desktopAwareFetch
├── session/             # (2, 3, 5, 9) auth + session state
│   ├── email-session.ts      # Web: sessionStorage + /mobile/config
│   └── console-session.ts    # Desktop: delegates to useDesktop
├── storage/             # (4) durable cache
│   ├── web-storage.ts        # localStorage + IndexedDB
│   └── desktop-storage.ts   # Tauri invoke (~/.relaybase)
├── shell/               # (6, 7) OS + chrome
│   ├── web-platform.ts       # Web Notifications, no-op tray
│   ├── desktop-platform.ts   # Tauri notify/tray/open
│   ├── web-chrome.ts         # No drag region
│   └── desktop-chrome.ts    # useDesktopChrome adapter
├── runtime/             # Assembly
│   ├── MailRuntimeContext.tsx  # useMailRuntime()
│   └── EmailAppProviders.tsx   # Email-mode provider tree
└── index.ts             # Barrel
```

## 11 items → directory mapping

| # | Item | Location |
|---|------|----------|
| 1 | API / Worker | `transport/` |
| 2 | Owner session | `session/console-session.ts` |
| 3 | Team login | `session/email-session.ts` |
| 4 | Disk | `storage/` |
| 5 | Provider gate | `runtime/EmailAppProviders.tsx` |
| 6 | OS integration | `shell/*-platform.ts` |
| 7 | Desktop chrome | `shell/*-chrome.ts` |
| 8 | App shell | `app/(email-app)/layout.tsx` |
| 9 | Console coupling | `runtime/EmailAppProviders.tsx` (features flag) |
| 10 | `?m=` URL | `email/lib/paths.ts` (unchanged, platform-agnostic) |
| 11 | Attachment URL | `transport/email-transport.ts` |

## Migration status

**Step 1 (this commit):** Facade skeleton + `(email-app)` route group.
Email UI still uses `useDesktop` / `desktopAwareFetch` directly — the
facade is not yet wired into `email/stores/*`.

**Next steps:**
1. Replace `desktopAwareFetch` calls in `email/stores/*` with
   `useMailRuntime().transport.fetch`.
2. Replace `useDesktop()` in `email/components/*` with `useMailRuntime()`.
3. Replace `desktopGetMailJson` / `desktopSaveMailJson` in
   `email/lib/disk/*` with `useMailRuntime().storage`.
4. Replace `notifyNewMail` / `setTrayUnread` with
   `useMailRuntime().platform`.
5. Remove `@/console` imports from `email/` (feature-flag instead).
