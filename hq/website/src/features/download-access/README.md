# Download access

Isolated module for how the marketing site grants Mac app downloads.

## Modes

Set `DOWNLOAD_ACCESS_MODE` in [`shared/constants.ts`](shared/constants.ts):

| Mode | Mac CTA behavior | Tracking |
|------|------------------|----------|
| `direct` (current) | CDN DMG link, immediate download | `POST /api/beta/download` via `sendBeacon` |
| `email` | `/get-started` signup page | Existing `POST /api/beta` + invite email |

## Component usage

Import only from `@/features/download-access/client`:

```tsx
import {
  getMacDownloadAction,
  TrackedDownloadAnchor,
} from "@/features/download-access/client";

const action = getMacDownloadAction({ href: dmgUrl, location: "hero" });
// <a href={action.href} onClick={action.onClick} />

// or
<TrackedDownloadAnchor href={dmgUrl} location="beta-page" />
```

Direct downloads are recorded in D1 `beta_invites` with `email = device:{clientId}`.

## Client ID persistence

The browser stores one ID per site using **localStorage + cookie + in-memory cache**:

- Cookie uses `domain=.relaybase.xyz` so `relaybase.xyz` and `www.relaybase.xyz` share the same ID.
- On `localhost` dev, tracking posts to `https://relaybase.xyz/api/beta/download` (Next dev has no Worker).
- VPN only affects Cloudflare geo (location column); timezone still comes from the browser.

If you still see a new `device:…` row on every click, check that localStorage/cookies are not blocked and that you are not mixing `localhost` with production.
