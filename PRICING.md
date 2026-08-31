# Relaybase — Pricing

**Status: DRAFT — internal only until official paid launch.**  
Updated: 2026-08-23 (private-beta publication policy).

This file is a **working draft**, not a public price list and not a customer promise. Dollar amounts, renewal rules, Free caps, and which features sit in which tier **can change** after private-beta feedback. Do not treat any number below as locked.

Full rationale for this draft lives in `STRATEGY.md` §7 (model comparison) and `STRATEGY.md` §9 (what to say during private beta). `PRE-LAUNCH.md` §4 is the older Early Access SKU sketch — same draft status; do not ship it to the site until paid launch.

---

## 0. Private beta — do not publish this policy

Private beta is email-apply → personal download link. Until official paid launch:

| Do publish (invite email / site) | Do **not** publish |
|----------------------------------|-------------------|
| Beta is free. We will email a download link. | Free $0 / Pro $69 / Early Access $35 tables |
| Mail runs in **your** Cloudflare account. We do not host it. | “First 300 seats”, ~50% off, founding-price lock |
| Cloudflare may bill you separately (e.g. Workers Paid). | Optional $25/year update renewal |
| We will not turn off or delete mail, domains, or data you already set up if we later charge. | 1-domain / 1-address Free caps as a live offer |
| | Team seats, Studio, “3 seats included in Pro” |

**Beta testers get the full current product** (multi-domain, Audience, Broadcasts, and whatever else is shipped). Do not gate draft-Pro features during beta. Do not claw them back later — if a tester does not buy at launch, **stop adds**, do not delete what already works.

**Grandfathering and exact prices are named only on the first checkout**, after we have reaction data — not on the marketing site during beta.

When this draft is promoted to public (paid launch), flip this status line and then keep site copy in sync. Until then, `kembo/website` must not present these SKUs as live.

---

## 1. Draft tiers (internal working model — not live)

The table is the **current internal hypothesis**. It is not on relaybase.xyz as a customer offer until official paid launch. Team seats in the Pro column assume engineering that has not shipped — treat that row as aspirational, not as something to tell testers.

| | Free | Pro — Early Access | Pro (regular, post-launch) |
|---|---|---|---|
| Price | **$0** | **$35 one-time** (~50% off, first 300 seats) | **$69 one-time** |
| Cloudflare Worker installs | 1 | 1 | 1 |
| Domains | 1 | Unlimited (on that Worker's Cloudflare account) | Unlimited |
| Email addresses | Unlimited (changed 2026-08-31 — was 1; a single-domain user still wants billing@/support@/hello@, and Free costs ~$0 to serve, so an address cap on one domain doesn't buy anything) | Unlimited | Unlimited |
| Send + receive API | Yes | Yes | Yes |
| Inbox UI (Mac app) | Yes | Yes, + Windows and mobile companion when shipped | Yes |
| Audience / Broadcasts / Metrics | No | Yes | Yes |
| Team seats (email-only scoped access) | No | 3 included | 3 included |
| Support | Community docs | Priority email | Priority email |
| Updates | Security patches only | 1 year included, then optional renewal (§2) | 1 year included, then optional renewal (§2) |

Free is not a trial — it does not expire and does not require a credit card. It runs the same Worker in the same way as Pro; the only difference is the domain/address cap and feature gating in the desktop app. Because the Worker executes entirely inside the customer's own Cloudflare account, Free costs Relaybase effectively nothing to serve — there is no hosting bill that scales with free users. Treat Free as a zero-cost top-of-funnel channel, not a loss leader.

**Pro — Early Access** (draft) is identical to regular Pro in every feature — only the price and seat cap differ. If we still want this SKU at paid launch, it would close when the first 300 seats are claimed or Relaybase exits pre-launch (whichever comes first — `STRATEGY.md` §8.5). Draft rule: Early Access buyers keep that price for life. `siteConfig.pricing.earlyAccess.active` exists in `website/src/lib/site-config.ts` for when we *do* publish; **do not treat a live site card as a beta-era promise.** Until paid launch, keep Early Access copy off the public path (or behind “pricing at launch”).

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

## 4. Internal draft numbers (not site copy yet)

These are the figures other **internal** docs should use *while this draft lasts*. They are allowed to change before launch. Do not paste them onto the marketing site, invite emails, or TERMS as if they were final.

- Free (draft): $0, 1 domain, unlimited addresses (changed 2026-08-31, was 1 address).
- Pro (draft): $69 one-time, includes 1 year of updates.
- Pro renewal (draft): $25/year, optional, perpetual fallback (§2).
- Do not reintroduce "$39" or an absolute "no subscription, ever" claim. The draft public claim *at paid launch* would be **"no subscription required — and skipping the optional renewal never breaks your mail."** During private beta, say only: beta is free; mail stays on your Cloudflare account; we will not revoke what you already set up.

## 5. Where this is implemented

- Draft numbers still exist in `kembo/website` `siteConfig.pricing` and the components that read it. That is leftover scaffolding, **not** authorization to keep a public price table during private beta. Until paid launch, site/invite copy follows §0, not the $35/$69 cards.
- License records currently have no free/pro/renewal fields (`server/src/lib/licenses.ts` — `LicenseRecord` is just email + key + active/revoked). Adding a `tier: "free" | "pro"` and `renewalExpiresAt` field is required before Pro/renewal billing can be enforced; not done yet — and not needed to run private beta.
- Stripe checkout for Pro + renewal is not implemented yet — `/get-started` only collects waitlist / beta-apply emails.
