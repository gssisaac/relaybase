# Audience Groups, Data Sources & Broadcasts

**Audience:** humans and coding agents changing Audience, sync/cron, data-source endpoints, or Broadcasts.

**Primary code:**

| Area | Paths |
|------|--------|
| D1 schema + helpers | `server/db/app/schema.ts`, `server/db/app/audience.ts`, `server/db/app/broadcasts.ts` (D1 `RELAYBASE_DB` tables `audience_groups`, `audience_contacts`, `broadcasts`) |
| Store / model | `server/src/lib/catalog-audience.ts`, `catalog-broadcasts.ts`, `catalog-types.ts` (now backed by D1, not KV) |
| Audience APIs | `server/src/routes/console/audience-groups.ts` → `/console/audience-groups` |
| Broadcast APIs | `server/src/routes/console/broadcasts.ts` → `/console/broadcasts` |
| Cron | `server/src/index.ts` `scheduled()` + `server/wrangler.toml` triggers |
| Client mapping | `app/src/lib/desktop/email-api-map.ts` (`/api/email/*` → Worker admin) |
| Audience UI | `app/src/console/pages/audience/AudienceGroup*.tsx`, `AudienceGroupsView.tsx`, `AudienceDataSourceGuide.tsx` |
| Broadcast UI | `app/src/console/pages/broadcasts/Broadcast*.tsx`, `BroadcastsView.tsx` |
| Routing | `app/src/app/(shell)/` |
| Client types | `app/src/email/components/mailbox/types.ts` |

Read this before changing sync auth, draft broadcast flow, or data-source parsing.

---

## Product model

### Audience Groups

Audience is no longer a flat domain contact list. The unit of work is an **Audience Group**:

- Belongs to one **domain**
- Holds **contacts** (`manual` and/or `synced`)
- Optional **generic JSON data source** + credential
- Optional **scheduled cron** refresh
- Detail opens as a right-side **Sheet** on `/audience` (list stays mounted), with three tabs: Audience list, Send history, Settings (mirrors `AccountDetailSheet` pattern)

Legacy flat contacts without `groupId` are migrated into a per-domain **“Manual subscribers”** group on read.

### Broadcasts

Broadcasts target one or more audience groups (`groupIds`). Recipients are the de-duplicated union of contacts across those groups.

Lifecycle:

1. **draft** — created from audience picker; editable compose UI  
2. **sending** — **Broadcast** shows a 5s Unsend toast (same as mail Send), then `BroadcastStore.queueBroadcast` fans out mail with live `sendProgress`  
3. **sent** / **failed** — detail shell with tabs (Overview, Audience, Content, Progress)

**Content tab:** **Use this to broadcast** creates a new draft with the same `groupIds`, `from`, `subject`, and body, then opens compose.

**Progress tab:** Shows a live **Current run** panel only while a send is in flight (`sendProgress.status === "running"`, broadcast `sending`, or a client pending/upload/send job). When idle, only the **Past runs** list is shown (no empty current-run or summary cards).

---

## Routes (dashboard)

| Path | View |
|------|------|
| `/audience` | Group list + Add group dialog; row click opens detail **Sheet** via `?id=&tab=` |
| `/audience?id=<groupId>` | Sheet — Audience list (default tab) |
| `/audience?id=<groupId>&tab=history` | Sheet — Send history (broadcasts that include this group) |
| `/audience?id=<groupId>&tab=settings` | Sheet — Name, default sender, data source, cron, delete |
| `/broadcasts` | List + **New broadcast** dialog (audience only) |
| `/broadcasts?new=1` | Opens the New broadcast dialog (`/broadcasts/new` redirects here) |
| `/broadcasts?id=<id>` | Draft compose **or** sent Overview (by status) |
| `/broadcasts?id=<id>&tab=audience` | Sent — audience tab |
| `/broadcasts?id=<id>&tab=content` | Sent — content tab (+ reuse into new draft) |
| `/broadcasts?id=<id>&tab=progress` | Live send progress while sending; past runs when idle |

Legacy `/audience/:groupId[/contacts|history|settings]` and `/broadcasts/:id[/audience|content|progress]` segments are normalized to `?id=&tab=`. Starting a broadcast for a group happens from the Broadcasts page audience picker (the per-group Send tab was removed).

---

## Data model (store)

Defined in `server/src/lib/catalog-types.ts` and persisted in D1 `RELAYBASE_DB` tables `audience_groups` / `audience_contacts` / `broadcasts` (Drizzle schema in `server/db/app/schema.ts`; helpers in `server/db/app/audience.ts` and `server/db/app/broadcasts.ts`). D1 is the sole source of truth.

### `DevAudienceDataSource`

```ts
{
  type: "generic_json";
  endpointUrl: string;
  credential?: string;        // API token (secret)
  credentialHeader?: string;  // header *name*; default Authorization → Bearer <token>
}
```

Helpers:

- `normalizeAudienceDataSource` — trims; moves a token mistaken for a header name into `credential`
- `mergeAudienceDataSource` — **empty/omitted credential keeps the previous token** (prevents wipe on save)
- `parseCredentialHeaderValue` — builds outbound auth headers (see Auth below)
- `fetchDataSourceContacts` — GET + parse
- `syncAudienceGroupInData` — replace `source: "synced"` contacts; writes `syncProgress` / history

### `DevAudienceGroup`

Includes `defaultFrom`, `dataSource`, cron fields, `lastSync*`, `syncProgress`, `syncHistory`.

### `DevBroadcast`

```ts
{
  id, subject, status, // "draft" | "sending" | "sent" | "failed"
  createdAt, domain, groupIds,
  from?, body?, recipientCount?, sentAt?,
  sendProgress?, sendHistory?
}
```

Store helpers: `createBroadcastDraft`, `updateBroadcastDraft`, `sendBroadcast`, `getBroadcastDetail`, `getBroadcastProgress`, `listContactsForGroups`.

Client MobX: `BroadcastStore` / `BroadcastProvider` (`app/src/lib/dashboard/broadcast-store.ts`) — **Broadcast** arms a pending job + 5s Unsend toast, then `queueBroadcast` saves and POSTs `/send` in the background so Progress can open immediately.

---

## Data source API contract

Relaybase calls the customer endpoint on **Test connection**, **Refresh now**, and **cron**.

### Request

| Item | Value |
|------|--------|
| Method | `GET` |
| URL | Configured endpoint |
| Auth (default) | `Authorization: Bearer <token>` when token is set |
| Body | None |

**UI fields**

- **API key / token** — the secret (shown via `CredentialInput` eye toggle)
- **Header name (advanced)** — header *name* only (e.g. `Authorization` or `X-API-Key`). Do **not** paste the token here.

**Auth parsing rules** (`parseCredentialHeaderValue`):

1. Prefer `credential`; if empty and `credentialHeader` looks like a token (not a header name), treat it as the token + `Authorization`.
2. If header is `Authorization`, send `Bearer <token>` unless the value already starts with `Bearer `.
3. Custom header names send the raw token (no Bearer prefix).
4. Accept credential values like `Authorization: Bearer …` (inline header line).

### Response

- HTTP **200** + valid JSON
- Preferred body: root array

```json
[
  { "email": "alice@example.com", "name": "Alice" },
  { "email": "bob@example.com", "name": "Bob" }
]
```

- Also accepted: object with array under `contacts` | `data` | `items` | `results`
- Each contact: `email` required (must contain `@`, stored lowercased); `name` optional
- When `name` is omitted, sync stores the email **local-part** (before `@`) as the display name (e.g. `isaac` from `isaac@strum.us`)
- Invalid rows are **skipped**, not fatal
- Non-200 → test/sync error (contacts not replaced on failure)
- Audience list UI: **Name** = display name / local-part; **Email** = always the email (never a placeholder like “Subscriber”)

In-product copyable guide: `AudienceDataSourceGuide` (`AUDIENCE_DATA_SOURCE_GUIDE_MARKDOWN`).

---

## Sync & Progress

### Manual refresh

`POST /api/email/audience-groups/:groupId/sync` → `syncAudienceGroup` with `onProgress` persistence.

### Cron

- Trigger: `app/wrangler.jsonc` schedule (e.g. `*/15 * * * *`)
- Handler: `app/custom-worker.ts` → `audience-cron.ts` fans out due groups
- Respects `cronEnabled` + `cronIntervalMinutes` per group

### Progress tab

- Phases: `fetching` → `parsing` → `writing` → `done`
- Live state on `group.syncProgress`; recent runs in `group.syncHistory`
- API: `GET /api/email/audience-groups/:groupId/progress`
- UI polls ~2s while status is `running`
- Shows a live **Current run** panel only while `syncProgress.status === "running"`; when idle, only the **Past runs** table (no empty current-run or summary cards)

Synced contacts are replaced atomically at end of a successful sync. **Manual** contacts in the same group are kept.

---

## Audience Settings — credential persistence

**Bug fixed:** saving with an empty password field used to overwrite `dataSource` and wipe the stored token.

**Rules going forward:**

1. PATCH `dataSource` **merges** via `mergeAudienceDataSource`.
2. Client omits `credential` when the field is empty → server keeps previous token.
3. Settings loads the stored token into `CredentialInput` (eye show/hide).
4. Test connection accepts `groupId` so a blank token field still uses the stored secret.
5. On read/migrate, tokens stuck in `credentialHeader` are normalized into `credential`.

Do not reintroduce “replace whole `dataSource` object with empty credential”.

---

## Broadcast UX flow

### 1. List → dialog

`/broadcasts` → **New broadcast** opens a dialog:

- Select audience groups only
- **New audience** link → `/audience`
- **Create broadcast** → `POST /api/email/broadcasts` with `status: "draft"` → navigate to `/broadcasts?id=<id>`

### 2. Draft page

While `status === "draft"`, `/broadcasts?id=<id>` shows compose-shaped UI (`BroadcastComposeForm`):

- From / To (group badges) / Subject / body / footer
- Same chrome as mail `ComposeForm`
- **To** uses `BroadcastAudienceToField`: one-line group **Badge** buttons + contact count on the right; click opens a **Sheet** listing recipients (20 + Load more)
- **From select** is scoped to addresses on the selected audience group **domain(s)** only (not all accounts)
- **Default From** = each group’s Settings → **Default sender** (`defaultFrom`), else first address on that domain; set at draft create and corrected in the UI if wrong
- **Save draft** → `PATCH /api/email/broadcasts/:id`
- **Broadcast** (⌘Enter) → 5s Unsend toast (same as mail Send) → then MobX `queueBroadcast` (background save + send) → `/broadcasts?id=<id>&tab=progress`. Unsend / Esc during the window returns to the draft.

### 3. Progress + sent detail

Progress tab (audience-style):

- Phases: `preparing` → `sending` → `done`
- Live state on `broadcast.sendProgress`; recent runs in `broadcast.sendHistory`
- API: `GET /api/email/broadcasts/:id/progress`
- UI polls ~2s while status is `sending` / run is `running`

After send completes, same URL uses `BroadcastDetailShell` tabs:

- Overview, Audience, Content, Progress

List row click → draft or sent detail by status.

`BroadcastComposer` (immediate-send dialog) was removed; do not bring it back without updating this doc.

---

## API summary

### Audience groups

| Method | Path | Notes |
|--------|------|--------|
| GET | `/api/email/audience-groups` | List summaries |
| POST | `/api/email/audience-groups` | Create (+ optional first sync) |
| POST | `/api/email/audience-groups/test` | Test endpoint; optional `groupId` for stored token |
| GET | `/api/email/audience-groups/:id` | Detail + contacts |
| PATCH | `/api/email/audience-groups/:id` | Settings; dataSource merge |
| DELETE | `/api/email/audience-groups/:id` | Group + its contacts |
| GET | `/api/email/audience-groups/:id/contacts` | List / add / remove (see route) |
| POST | `/api/email/audience-groups/:id/sync` | Manual sync |
| GET | `/api/email/audience-groups/:id/progress` | Progress + history |

### Broadcasts

| Method | Path | Notes |
|--------|------|--------|
| GET | `/api/email/broadcasts` | List |
| POST | `/api/email/broadcasts` | Default **draft**; `status: "sent"` for legacy immediate send |
| GET | `/api/email/broadcasts/:id` | Detail (`broadcast`, `groups`, `recipientCount`) |
| PATCH | `/api/email/broadcasts/:id` | Draft / failed only |
| POST | `/api/email/broadcasts/:id/send` | Draft/failed → sending → sent/failed (optional `{ from }`) |
| GET | `/api/email/broadcasts/:id/progress` | `sendProgress` + history |

---

## UI conventions

- Dashboard add/create flows use a **Dialog** (see workspace rule `dashboard-add-dialog`), not an always-visible create Card.
- Form controls use shadcn / `FieldCheck` / `Select` — no raw `<select>`.
- Base UI `Select` needs `items={[{ value, label }, …]}` (or a value→label map) so the trigger shows **labels**, not raw ids (e.g. `generic_json`).
- Secrets use `CredentialInput` (`app/src/components/ui/credential-input.tsx`) with eye toggle.
- Audience/Broadcast detail shells mirror Account/Audience tab chrome (`DesktopTitleBar` + horizontal nav).

---

## Checklist for agents

When changing this area:

- [ ] Preserve credential merge (empty token must not wipe stored auth)
- [ ] Keep data-source parse: root array first; wrappers secondary
- [ ] Auth: token in credential field; header name is only the header name
- [ ] Broadcast create = draft → compose → 5s Unsend → queue send → Progress tab → sent detail
- [ ] Audience sync progress updates go through `syncProgress` + optional `onProgress` D1 writes
- [ ] Broadcast send progress updates go through `sendProgress` / `sendHistory`
- [ ] Update this doc if routes, statuses, or the API contract change
- [ ] In-product guide text lives in `AudienceDataSourceGuide.tsx` — keep it aligned with the contract section above
