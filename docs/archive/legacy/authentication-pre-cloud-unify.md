# Authentication (cloud entry)

**Audience:** humans and agents changing sign-in, session gates, Worker access, or HQ Studio auth.

**Canonical spec:** **[cloud-entry-auth.md](./cloud-entry-auth.md)** — read that first.

**Desktop legacy (keyring / Touch ID / passtoken UI):** archived under **[../archive/legacy/authentication.md](../archive/legacy/authentication.md)** until the desktop shell migrates to the same cloud root.

---

## Policy (web)

One identity for the whole product:

| Step | What the user does | What the system does |
|------|--------------------|----------------------|
| Sign up | CF OAuth → username + password | Provisions Worker, stores **encrypted** passtoken on HQ Studio, issues 30-day refresh cookie |
| Sign in | Username + password | HQ session + **`POST /auth/worker-session`** mints Worker owner tokens (passtoken never sent to browser) |
| Forgot password | CF OAuth ownership check | Updates password hash; revokes refresh tokens |
| Mail / Console / Studio | Same session | Studio uses HQ JWT; mail/console use server-minted Worker scoped tokens |

**Removed on web (do not reintroduce):**

- Separate `/worker/login`, passtoken forms, team mobile-password login, HQ email 2-step signup with Worker proof, email reset links, `/cloud/login` split routes.

---

## Web gates

| Surface | Gate |
|---------|------|
| `(auth)/*` | Public |
| `(shell)/*`, `(email-app)/*` | `ensureWebCloudAuth()` in `DesktopDashboardGate` / email layout |
| `(shell)/studio/*` | `HqStudioGate` + cloud session |
| `/` | Cloud session → `/dashboard` or `/studio/dashboard` |

Implementation:

- `app/src/lib/auth/cloud-session.ts` — login/logout/register wrappers
- `app/src/lib/auth/cloud-worker-session.ts` — Worker token exchange
- `app/src/app/_shell/DesktopDashboardGate.tsx` — shell entry

---

## HQ Studio API (auth)

See **cloud-entry-auth.md** for route list. Notable:

- `POST /auth/worker-session` — Bearer HQ access JWT → Worker mail/console refresh pair (owner scope)

---

## Worker (customer account)

Owner routes (`/console/*`, `/mail/*`) still use scoped Bearer tokens on the **customer Worker**. Cloud HQ holds the passtoken and performs login on behalf of the signed-in user.

Integrators and `/v1/*` API keys are unchanged.

---

## Desktop (interim)

Desktop still uses `AppSessionStore`, OS keyring, and `/setup` until migrated. Web routes under `/setup` redirect to `/signup`.
