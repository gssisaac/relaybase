# Audience Groups, Data Sources & Broadcasts

**Audience:** humans and coding agents changing Audience, sync/cron, data-source endpoints, or Broadcasts.

**Primary code:**

| Area | Paths |
|------|--------|
| Store / model | `app/src/lib/dev-email-store.ts` |
| Audience APIs | `app/src/app/api/email/audience-groups/**` |
| Broadcast APIs | `app/src/app/api/email/broadcasts/**` |
| Cron | `app/custom-worker.ts`, `app/src/lib/audience-cron.ts`, `app/wrangler.jsonc` |
| Audience UI | `app/src/dashboard/components/AudienceGroup*.tsx`, `AudienceGroupsView.tsx`, `AudienceDataSourceGuide.tsx` |
| Broadcast UI | `app/src/dashboard/components/Broadcast*.tsx`, `BroadcastsView.tsx` |
| Routing | `app/src/dashboard/panel.tsx` |
| Client types | `app/src/email/components/types.ts` |

Read this before changing sync auth, draft broadcast flow, or data-source parsing.

---

## Product model

### Audience Groups

Audience is no longer a flat domain contact list. The unit of work is an **Audience Group**:

- Belongs to one **domain**
- Holds **contacts** (`manual` and/or `synced`)
- Optional **generic JSON data source** + credential
- Optional **scheduled cron** refresh
- Detail pages with tabs (like Accounts)

Legacy flat contacts without `groupId` are migrated into a per-domain **“Manual subscribers”** group on read.

### Broadcasts

Broadcasts target one or more audience groups (`groupIds`). Recipients are the de-duplicated union of contacts across those groups.

Lifecycle:

1. **draft** — created from audience picker; editable compose UI  
2. **sent** — after **Broadcast**; detail shell with tabs (read-only content)

---

## Routes (dashboard)

| Path | View |
|------|------|
| `/audience` | Group list + Add group dialog |
| `/audience/:groupId` | Overview |
| `/audience/:groupId/contacts` | Contacts |
| `/audience/:groupId/send` | Starts broadcast flow (preselects group) |
| `/audience/:groupId/progress` | Live sync/cron progress |
| `/audience/:groupId/history` | Broadcasts that include this group |
| `/audience/:groupId/settings` | Name, default sender, data source, cron, delete |
| `/broadcasts` | List + **New broadcast** dialog (audience only) |
| `/broadcasts/new` | Redirects to `/broadcasts?new=1` |
| `/broadcasts/:id` | Draft compose **or** sent Overview |
| `/broadcasts/:id/audience` | Sent — audience tab |
| `/broadcasts/:id/content` | Sent — content tab |

Deep-link from Audience Send: `/broadcasts?new=1&groupId=<id>` opens the create dialog with that group pre-checked.

---

## Data model (store)

Defined in `dev-email-store.ts` (persisted in user email JSON / KV).

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
  id, subject, status, // "draft" | "sent" | "failed"
  createdAt, domain, groupIds,
  from?, body?, recipientCount?, sentAt?
}
```

Store helpers: `createBroadcastDraft`, `updateBroadcastDraft`, `sendBroadcast`, `getBroadcastDetail`, `listContactsForGroups`.

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
- Shows bar, current/total, success/failed, elapsed, ETA

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
- **Create broadcast** → `POST /api/email/broadcasts` with `status: "draft"` → navigate to `/broadcasts/:id`

### 2. Draft page

While `status === "draft"`, `/broadcasts/:id` shows compose-shaped UI (`BroadcastComposeForm`):

- From / To (group names) / Subject / body / footer
- Same chrome as mail `ComposeForm`
- **From select** is scoped to addresses on the selected audience group **domain(s)** only (not all accounts)
- **Default From** = each group’s Settings → **Default sender** (`defaultFrom`), else first address on that domain; set at draft create and corrected in the UI if wrong
- **Save draft** → `PATCH /api/email/broadcasts/:id`
- **Broadcast** (⌘Enter) → save then `POST .../send` → detail tabs

### 3. Sent detail

After send, same URL uses `BroadcastDetailShell` tabs:

- Overview, Audience, Content

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
| PATCH | `/api/email/broadcasts/:id` | Draft only |
| POST | `/api/email/broadcasts/:id/send` | Draft → sent |

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
- [ ] Broadcast create = draft → compose page → send → tabbed detail
- [ ] Progress updates go through `syncProgress` + optional `onProgress` KV writes
- [ ] Update this doc if routes, statuses, or the API contract change
- [ ] In-product guide text lives in `AudienceDataSourceGuide.tsx` — keep it aligned with the contract section above
