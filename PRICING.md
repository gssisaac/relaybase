# Relaybase — Pricing

**Status: pre-launch.** This is the source of truth for pricing numbers and tier scope. Full rationale and the model comparison behind these numbers live in `STRATEGY.md` §7 (superseding §§1–6, which were written under a "$39, no subscription ever" draft that predated this decision). This doc is the spec other docs and the website should match.

**Public scope right now: Free and Pro only.** Team and Studio exist in the model and are worth building toward, but they depend on engineering that hasn't shipped yet (mailbox-scoped seats, multi-Worker license tracking — see `STRATEGY.md` §2–3). Do not publish them on the marketing site until they're real. This doc tracks all four so engineering and marketing stay in sync as they ship.

---

## 1. Public tiers (live on relaybase.xyz today)

| | Free | Pro |
|---|---|---|
| Price | **$0** | **$69 one-time** |
| Cloudflare Worker installs | 1 | 1 |
| Domains | 1 | Unlimited (on that Worker's Cloudflare account) |
| Email addresses | 1 | Unlimited |
| Send + receive API | Yes | Yes |
| Inbox UI (Mac app) | Yes | Yes, + Windows and mobile companion when shipped |
| Audience / Broadcasts / Metrics | No | Yes |
| Team seats (email-only scoped access) | No | 3 included |
| Support | Community docs | Priority email |
| Updates | Security patches only | 1 year included, then optional renewal (§2) |

Free is not a trial — it does not expire and does not require a credit card. It runs the same Worker in the same way as Pro; the only difference is the domain/address cap and feature gating in the desktop app. Because the Worker executes entirely inside the customer's own Cloudflare account, Free costs Relaybase effectively nothing to serve — there is no hosting bill that scales with free users. Treat Free as a zero-cost top-of-funnel channel, not a loss leader.

## 2. Pro update renewal (optional, not required to keep using Relaybase)

- **$25/year**, opt-in, offered starting at the end of the included first year.
- What it buys: continued new features, security patches, and Cloudflare-API-compatibility fixes, plus priority support.
- What happens if a customer never renews: **nothing breaks.** The desktop app and the Worker keep working on the last version forever — this is a hard product requirement, not a support promise, because the Worker sends and receives mail independently of any Relaybase license check. Renewal only gates *new* app/Worker updates, never the core send/receive path.
- No punitive re-up pricing: a customer can skip renewal for any number of years and resume later at the same $25/year rate.
- This is deliberately framed as "renew your update plan," not "subscribe" — see `STRATEGY.md` §7.2 for the market evidence (a Screen Studio buyer, a member of the exact anti-subscription demographic Relaybase targets, said they'd happily pay a flat annual fee for a year of updates, just not an open-ended subscription).

**Do not build a renewal model that requires a live check-in with Relaybase's license server to keep sending/receiving mail.** That would turn this into the same trap Screen Studio's subscription became for its users (see `STRATEGY.md` §6) — except worse, because Relaybase's target buyer cannot "pause" a live business inbox the way a screen recorder can be paused between projects.

## 3. Not yet public — roadmap tiers (internal, do not publish until shipped)

| | Team | Studio |
|---|---|---|
| Price | $69 (Pro) + included in Pro; extra seats $15 one-time/seat | $149 one-time for 3 Worker installs, $50 one-time per additional install |
| Unlocks | Additional mailbox-scoped seats beyond the 3 included in Pro | Multiple separate Worker installs (separate businesses/clients) under one license umbrella |
| Target buyer | Small team sharing one shared inbox (e.g. `support@`) without giving out full admin access | Agencies / multi-product operators running several Cloudflare accounts |
| Blocking engineering work | Mailbox-scoped seat tokens + role-filtered dashboard UI (`STRATEGY.md` §3.5) — `server/src/lib/keys.ts` already has the domain-scoped pattern to extend | License scoped to "number of distinct Worker installs," tracked via `workerUrlHash` on license activations (`STRATEGY.md` §2.3) |

Publish these on the site only once the underlying feature exists in the app. Until then, the public pricing page should not imply team sharing or multi-business bundles are available.

## 4. Numbers that must stay consistent across docs and site copy

- Free: $0, 1 domain, 1 address.
- Pro: $69 one-time, includes 1 year of updates.
- Pro renewal: $25/year, optional, perpetual fallback (§2).
- Do not reintroduce "$39" or an absolute "no subscription, ever" claim anywhere — both are superseded. The accurate claim is **"no subscription required — and skipping the optional renewal never breaks your mail."**

## 5. Where this is implemented

- Marketing copy and the `siteConfig.pricing` object: `website/src/lib/site-config.ts` and the components that read from it (`hero.tsx`, `pricing-comparison.tsx`, `site-header.tsx`, `footer.tsx`, `get-started/page.tsx`, `use-cases.tsx`, `resources/[slug]/page.tsx`, JSON-LD in `app/page.tsx`).
- License records currently have no free/pro/renewal fields (`server/src/lib/licenses.ts` — `LicenseRecord` is just email + key + active/revoked). Adding a `tier: "free" | "pro"` and `renewalExpiresAt` field there is required before Pro/renewal billing can be enforced server-side; not done yet.
- Stripe checkout for Pro + renewal is not implemented yet — the current `/get-started` page only collects waitlist emails (`WaitlistForm`).
