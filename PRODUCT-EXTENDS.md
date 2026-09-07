# Relaybase — Product extensions (Newsletters & AI Support)

**Status:** Planning / pre-implementation  
**Audience:** product, engineering, and agents extending Relaybase beyond core BYOCF mail  
**Related:** `PRODUCT.md`, `PRICING.md`, `STRATEGY.md`, `docs/features/audience-and-broadcasts.md`

This document defines two major product extensions:

1. **Newsletters** — a publishing engine for recurring, designed email campaigns to Audience groups.
2. **AI Support** — inbound triage, suggested replies, rules, and webhooks for support-style mail (`support@`, `help@`, etc.).

Both extensions run on **Relaybase Cloud (managed SaaS)** while core mail storage and delivery remain in the **customer's Cloudflare account (BYOCF)**.

---

## 1. Strategic context

### 1.1 Why these features exist

Relaybase already ships:

- **Mailbox** — 1:1 team mail (inbox, compose, threading).
- **Console** — domains, accounts, API keys, Audience groups, and **Broadcasts** (experimental beta; plain-text compose, ≤50 recipients, single Worker request).

Broadcasts are sufficient for quick announcements but not for **product-grade newsletters**:

- No block/visual editor or template library.
- No email-client-safe HTML compilation pipeline.
- No open/click analytics, unsubscribe compliance, or scheduled batch sending at scale.
- No recurring publication workflow.

Similarly, support mail today is handled manually in Mailbox. Tools like Intercom, Plain, and Front add **classification, knowledge-base replies, rules, and webhooks** — capabilities Relaybase does not yet offer.

### 1.2 Why SaaS (not only BYOCF Worker)

These features should **not** be implemented entirely inside the customer's product Worker:

| Concern | BYOCF Worker only | Relaybase Cloud SaaS |
|--------|-------------------|----------------------|
| Worker bundle size | Block editor, MJML/HTML compiler, RAG libs blow past practical limits | Full stack on central backend |
| CPU / timeout | Batch HTML render + LLM chains exceed edge limits | Queues, workers, long-running jobs |
| Template delivery | Every user must redeploy Worker to get new templates | Instant template catalog updates |
| AI prompt/model routing | Frozen per deploy | Central tuning without customer action |
| Webhook reliability | Limited retry/backoff on edge | Dedicated delivery queue + HMAC + logs |
| Monetization | Hard to meter premium features | Clear Pro/Team subscription surface |

**Principle:** Core mail (receive, store, send, search) stays in the user's Cloudflare account. High-complexity, fast-moving capabilities run on Relaybase-operated infrastructure.

### 1.3 Account requirement

The **account owner must have a Relaybase account** (HQ console identity — `console.relaybase.xyz` today) before using Newsletters or AI Support.

- Desktop links the local Worker install to the cloud account (`account_workers` in HQ D1).
- Feature gates, quotas, and billing attach to the Relaybase account — not to the Worker alone.
- Core mail continues to work if Relaybase Cloud is unavailable; extension UIs and APIs degrade gracefully (see §8).

This aligns with a **hybrid model** used by PostHog, Supabase, and similar BYO-infra products: infrastructure in the customer's cloud, product intelligence in the vendor's cloud.

---

## 2. Product architecture — three modes

Relaybase Desktop today has two sidebar modes: **Mailbox** and **Console** (dashboard). Extensions add a third primary mode.

```
┌────────────────────────────────────────────────────────────────────────┐
│                         Relaybase Desktop                              │
├──────────────────┬──────────────────────┬──────────────────────────────┤
│ 1. Mailbox       │ 2. Newsletters       │ 3. Console                   │
│ (existing)       │ (new mode)           │ (existing)                   │
├──────────────────┼──────────────────────┼──────────────────────────────┤
│ • Inbox / Sent   │ • Campaign list      │ • Domains / DNS              │
│ • Compose / team │ • Block editor       │ • Accounts / API keys        │
│ • 1:1 mail       │ • Templates          │ • Audience groups & sync     │
│ • AI draft hints │ • Schedule / send    │ • Logs / Settings            │
│   (Support MVP)  │ • Open/click stats   │ • Support rules & KB (AI)  │
└──────────────────┴──────────────────────┴──────────────────────────────┘
```

**Mode separation rationale**

- **Console** is infrastructure and list management (domains, Audience, keys). Broadcasts may remain as a lightweight path or eventually fold into Newsletters.
- **Newsletters** is a **content and publishing workspace** — editor, templates, analytics — not an admin screen.
- **Mailbox** remains the place agents read and reply; AI Support surfaces as inbox overlays (badges, suggested drafts), not a fourth top-level mode.

---

## 3. Hybrid runtime architecture

```
┌────────────────────────────────────────┐       ┌────────────────────────────────────────┐
│   User's Cloudflare (BYOCF)            │       │   Relaybase Cloud (managed SaaS)       │
├────────────────────────────────────────┤       ├────────────────────────────────────────┤
│ • DNS (SPF, DKIM, DMARC)               │       │ • Relaybase account & auth (HQ)        │
│ • Product Worker (mail routes)         │ ◀───▶ │ • Newsletter editor & template store   │
│ • D1 RELAYBASE_DB (domains, audience)  │ mTLS/ │ • HTML email compiler                  │
│ • D1 RELAYBASE_MAIL (mailbox index)    │ token │ • Send job orchestration & scheduling  │
│ • R2 relaybase-mailbox (raw .eml)      │       │ • Open/click tracking & analytics    │
│ • Actual SMTP send (user domain)       │       │ • AI triage, RAG, draft generation     │
│ • Local desktop session & cache        │       │ • Webhook delivery & retry queue       │
└────────────────────────────────────────┘       └────────────────────────────────────────┘
```

### 3.1 Execution placement matrix

| Capability | Runs on | Notes |
|------------|---------|-------|
| Inbound receive & R2/D1 storage | User CF | Source of truth for mail atoms |
| Outbound send (DKIM on user domain) | User CF | Deliverability tied to customer domain |
| Audience groups & contacts | User CF D1 | Already in `RELAYBASE_DB`; SaaS reads via linked Worker |
| Newsletter block editor & templates | Relaybase SaaS | Central catalog; instant updates |
| Block JSON → email HTML compile | Relaybase SaaS | Heavy; not in edge bundle |
| Personalized per-recipient send fan-out | User CF | SaaS passes compiled payload + recipient batch jobs |
| Open/click tracking pixels & redirects | Relaybase SaaS | Analytics aggregation in HQ store |
| AI classification & RAG | Relaybase SaaS | LLM keys, prompts, vector search |
| Webhook outbound delivery | Relaybase SaaS | Retries, signing, delivery logs |
| Suggested draft in Mailbox UI | Desktop + SaaS | Desktop calls SaaS; send still via User CF |

### 3.2 Trust boundary

- SaaS receives **only what each feature needs** (campaign JSON, inbound metadata/body for triage, KB documents).
- **Zero-data-retention option for AI:** process inbound text in memory for classification/draft; do not persist full message bodies in SaaS unless the customer opts in to training/history.
- Worker ↔ SaaS calls use **signed tokens** tied to `account_workers` linkage; no passtoken leaves the desktop keyring for SaaS (separate OAuth/session for cloud features).

---

## 4. Newsletters

### 4.1 Product definition

**Newsletters** are designed, repeatable publications sent to one or more **Audience groups**. They extend (and eventually supersede) Console **Broadcasts** for anything that needs layout, templates, compliance footers, scheduling, and analytics.

**Not in scope for v1:** full marketing automation platform (drip sequences of arbitrary depth), CRM, or hosted ESP replacement on Relaybase infrastructure.

### 4.2 Relationship to Broadcasts

| | Broadcasts (today) | Newsletters (planned) |
|--|-------------------|----------------------|
| Editor | Plain compose (mail-shaped) | Block-based visual editor |
| Templates | Reuse prior broadcast body | Template library + save custom |
| Recipients | Audience group union | Same + segments (advanced) |
| Send | Single Worker request, beta cap 50 | Queued batch via SaaS orchestration |
| Analytics | Send progress only | Opens, clicks, bounces, unsubscribes |
| Compliance | Basic | List-Unsubscribe, footer blocks |
| Runtime | User CF only | SaaS compile + User CF send |

Broadcasts may remain for quick internal blasts; Newsletters is the customer-facing publishing product.

### 4.3 Editor foundation (Railmark reuse)

A production **BlockNote** editor already exists in the **Railmark** project (`pilots/railmark`):

- `@blocknote/core`, `@blocknote/react`, `@blocknote/shadcn` (v0.51.x).
- `MarkdownEditor.tsx` — round-trip markdown, paste/drop ingest, tables, links, frontmatter split.
- Documented in `pilots/railmark/app/docs/markdown-editor.md`.

**Newsletter adaptation work** (not a greenfield editor):

- Add email-specific blocks: CTA button, footer, unsubscribe placeholder, spacer, social row.
- Block JSON schema distinct from campaign storage (versioned).
- Server-side compile: Block JSON → inline-CSS HTML + plaintext fallback.
- Image blocks: upload to R2 via User CF (or SaaS staging → User R2); never blob URLs in sent mail.

Estimated editor port + email blocks: **~1–1.5 weeks** (vs **~2.5 weeks** for new BlockNote integration from scratch).

### 4.4 Feature list — Must-have (MVP)

| Area | Feature | Description |
|------|---------|-------------|
| **Editor** | Block-based visual editor | Slash commands; text, headings, quote, lists, divider, image, CTA, callout, link preview |
| **Editor** | Email-safe HTML compiler | Block JSON → inline CSS + table layout HTML; plaintext alternative |
| **Templates** | Built-in presets | e.g. Weekly Digest, Product Update, Minimal Letter, Announcement |
| **Templates** | Save as my template | One-click save layout from any campaign |
| **Personalization** | Merge tags | `{{subscriber.name}}`, `{{subscriber.email}}`, `{{unsubscribe_url}}`, `{{current_date}}`; fallback syntax `{{subscriber.name \| "there"}}` |
| **Compliance** | One-click unsubscribe | RFC 8058: `List-Unsubscribe`, `List-Unsubscribe-Post`; footer block auto-injected |
| **Compliance** | Legal footer block | Sender identity + unsubscribe link; non-removable in sent mail |
| **Preview** | Multi-device preview | Desktop / mobile / dark mode render |
| **Preview** | Preheader | Inbox preview text field |
| **Preview** | Test send | Send compiled HTML to owner's mailbox before publish |
| **Audience** | Group targeting | One or more Audience groups; deduplicated union (same as Broadcasts) |
| **Send** | Send now | Immediate publish |
| **Send** | Schedule | Date/time scheduling (SaaS cron → batch jobs → User CF send) |
| **Send** | Batch queue | Fan-out beyond single Worker request; pause/resume (stretch) |
| **Analytics** | Core metrics | Sent, delivered, bounced, unique opens, unique clicks, unsubscribes |
| **Desktop UI** | Newsletters mode | List, editor, preview, campaign detail with stats |
| **Account** | Relaybase login required | Link Worker to cloud account; Pro gate |

### 4.5 Feature list — Advanced

| Area | Feature | Description |
|------|---------|-------------|
| **Publishing** | Public web archive | `https://newsletter.{domain}/p/{slug}` — SEO page from same content (R2 + Worker or SaaS-hosted) |
| **Audience** | Smart segments | Filter within groups: joined in last N days, opened/clicked prior campaign, tag filters |
| **Optimization** | A/B test (subject) | Send A/B to sample %; auto-winner to remainder after delay |
| **Growth** | Subscribe widget + API | Embeddable form; `POST` subscribe endpoint; optional welcome email |
| **AI** | Subject & summary assist | Generate subject lines and short summary block from body |
| **Design** | Outlook VML buttons | VML fallbacks for bulletproof CTAs in Outlook |
| **Design** | In-email polls | Simple feedback blocks with tracked responses |
| **Templates** | Template marketplace | Curated catalog on Relaybase Cloud (internal first, external designers later) |

### 4.6 Newsletter send pipeline

```
[Block editor → campaign JSON (SaaS)]
        │
        ▼
[Compiler: HTML + inline CSS + plaintext (SaaS)]
        │
        ├── Test send → User CF → owner inbox
        └── Publish (draft → scheduled | sending)
                 │
                 ▼
        [SaaS job queue]
                 │
                 ├─ Resolve Audience (read contacts via linked Worker API)
                 ├─ Exclude unsubscribed / suppressed
                 ├─ Per-recipient merge tags + signed unsubscribe tokens
                 ├─ Inject tracking pixel & wrapped click URLs (SaaS)
                 └─ Batch send requests → User CF Worker mail API
                          │
                          ▼
        [Events: open, click, bounce, unsubscribe → SaaS analytics DB]
```

### 4.7 Data model (SaaS + User CF)

**SaaS (HQ / extension D1 or dedicated DB)**

| Table | Purpose |
|-------|---------|
| `newsletter_campaigns` | id, account_id, worker_url, domain, title, subject, preheader, status, scheduled_at, sent_at, content_json, content_html, content_text, target_group_ids, target_filter_json, stats_* |
| `newsletter_templates` | id, account_id, name, thumbnail_url, content_json, is_preset, created_at |
| `newsletter_analytics_events` | campaign_id, recipient_hash, event_type, link_url, user_agent, created_at |
| `newsletter_unsubscribes` | email, domain, group_id (nullable = all), reason, created_at |

**User CF (existing / minimal extension)**

- Audience groups & contacts — already in `RELAYBASE_DB`.
- Optional: `newsletter_send_log` reference ids in ops log (or reuse `RELAYBASE_LOGS`).

### 4.8 Desktop routes (planned)

| Path | View |
|------|------|
| `/newsletters` | Campaign list + **New newsletter** dialog |
| `/newsletters?id=<id>` | Draft editor or sent overview |
| `/newsletters?id=<id>&tab=content` | Sent — content + duplicate to new draft |
| `/newsletters?id=<id>&tab=audience` | Sent — recipient summary |
| `/newsletters?id=<id>&tab=analytics` | Opens, clicks, timeline |

Console **Audience** remains the source of truth for groups; Newsletters consumes groups, does not replace Audience management.

---

## 5. AI Support (auto-response & triage)

### 5.1 Product definition

**AI Support** automates first-line handling of inbound mail to support-style addresses: classify intent, suggest or send replies from a knowledge base, apply rules, and notify external systems via webhooks.

**Positioning:** Not a full Intercom replacement (no chat widget, no product tours). Email-native support automation for teams already on Relaybase Mailbox.

**Primary personas:** founders, small support teams, `support@` / `help@` / `contact@` operators.

### 5.2 Feature list — Must-have (MVP)

| Area | Feature | Description |
|------|---------|-------------|
| **Ingest** | Inbound → SaaS pipeline | User CF forwards new inbound metadata + body to SaaS (async); Mailbox unchanged if SaaS down |
| **Triage** | AI intent classification | Categories: Bug Report, Billing/Refund, Feature Request, General Inquiry, Spam, Other |
| **Triage** | Urgency | Critical, High, Medium, Low |
| **Triage** | Sentiment | Positive, Neutral, Frustrated, Angry |
| **Knowledge** | KB upload | Markdown/text/URL FAQ documents per domain |
| **Knowledge** | RAG retrieval | Answer generation grounded in KB only; cite sources in draft |
| **Reply** | Suggested draft | AI draft in Mailbox thread view; one-click insert into compose |
| **Rules** | Rule engine | Conditions: recipient address, sender, subject/body keywords, business hours, category |
| **Rules** | Actions | Auto-reply template, suggest draft only, webhook, tag/label, skip AI |
| **Rules** | Off-hours auto-reply | Template when outside configured schedule |
| **Webhooks** | Outbound events | `inbound.classified`, `inbound.urgent`, `support.draft_ready`; HMAC signature |
| **Webhooks** | Retry policy | Exponential backoff; delivery log in Console |
| **Safety** | Loop prevention | Block `Auto-Submitted`, `List-Id`, `mailer-daemon`, `noreply@` auto-replies |
| **Safety** | Rate limit | Max N auto-replies per sender per 24h |
| **Safety** | Sensitive escalation | Billing disputes, angry sentiment → no auto-send; human queue |
| **Console** | Support settings UI | KB docs, rules, webhook URLs, business hours, feature toggle |
| **Mailbox** | Triage badges | Category + urgency on thread list |
| **Mailbox** | Assistant panel | Summary, sentiment, suggested reply, insert button |
| **Account** | Relaybase login required | Pro gate; optional BYO LLM API key |

### 5.3 Feature list — Advanced

| Area | Feature | Description |
|------|---------|-------------|
| **Autopilot** | Confidence-gated auto-send | If confidence ≥ threshold (e.g. 90%) and category allowlisted, send without human review |
| **Tools** | Tool calling / MCP | Query Stripe subscription, create Linear/GitHub issue, return facts in reply |
| **Escalation** | Smart handoff | Assign tag, desktop notification, Slack/Discord via webhook |
| **i18n** | Language detect + reply | Detect inbound language; reply in same language from KB |
| **Learning** | Diff feedback | Store human edits to AI drafts; improve prompts / few-shot examples |
| **Analytics** | Support metrics | Volume by category, median time to first reply, AI acceptance rate |

### 5.4 AI Support flow

```
[Inbound mail → User CF stores R2 + D1 index]
        │
        ▼
[Async notify → Relaybase SaaS]
        │
        ▼
[Guardrails: loop/spam/noreply filters]
        │
        ▼
[AI Triage: category, urgency, sentiment]
        │
        ├─ Urgent / angry / VIP rule ──► Webhook (Slack) + Mailbox badge; no auto-send
        │
        └─ Normal path
                 │
                 ▼
        [RAG: retrieve KB chunks]
                 │
                 ▼
        [Generate suggested reply + confidence score]
                 │
        ┌────────┴────────┐
        ▼                 ▼
 [Review mode]      [Autopilot enabled + high confidence]
 Suggested draft     Auto-send via User CF
 in Mailbox          + log to thread
```

### 5.5 Data model (SaaS)

| Table | Purpose |
|-------|---------|
| `support_rules` | id, account_id, domain, name, priority, conditions_json, action_type, template_body, enabled |
| `support_knowledge_bases` | id, account_id, domain, title, source_type, content, embedding_ref, updated_at |
| `support_inbound_triage` | message_id, thread_id, category, urgency, sentiment, suggested_reply, confidence, handled_by, feedback_status |
| `support_webhooks` | id, account_id, domain, url, events[], secret_token, enabled |
| `support_webhook_deliveries` | webhook_id, event_type, payload_hash, status, attempts, last_error |

User CF stores authoritative mail; SaaS stores **derived** triage state keyed by `message_id` / `thread_id`.

### 5.6 Privacy modes

| Mode | Behavior |
|------|----------|
| **Default (recommended)** | Inbound body sent to SaaS for triage; body not retained after processing; triage metadata + draft kept |
| **Metadata-only** | Subject + headers only; draft disabled; classification only |
| **Retention (opt-in)** | Store bodies for analytics and diff learning; explicit Console toggle |

---

## 6. Shared SaaS foundation (prerequisite)

Both extensions depend on the same cloud layer. Build **once** before feature-specific work.

| Work item | Description |
|-----------|-------------|
| SaaS API service | Extend HQ console Worker or dedicated `api.relaybase.*` service |
| Desktop ↔ SaaS auth | Relaybase account session; link to existing Worker via `account_workers` |
| Feature gates | License tier / subscription flags (Newsletters, AI Support) |
| Worker ↔ SaaS channel | Signed requests: inbound events, audience read, send batch, health ping |
| Quotas | Per-tier limits: campaigns/month, recipients/campaign, AI triage/month |
| Degraded mode | Core mail works when SaaS unreachable; extension UI shows offline state |
| Observability | SaaS-side logs, webhook delivery dashboard, campaign job status |

**Existing assets to reuse**

- `console.relaybase.xyz` — accounts, `account_workers`, licenses, Stripe billing (`docs/architecture/hq-ops-d1.md`).
- Audience groups API on product Worker — recipient resolution.
- Broadcast send path — pattern for batch fan-out (to be hardened).

---

## 7. Business model integration

### 7.1 Suggested tier placement (draft)

Aligns with `PRICING.md` draft tiers; numbers are **not locked**.

| Capability | Free | Pro (one-time + optional renewal) |
|------------|------|-----------------------------------|
| Core mail (Mailbox, domains, API) | Yes (capped) | Yes |
| Audience groups | Limited / no | Yes |
| Broadcasts (legacy) | No | Yes (beta) |
| **Newsletters** | No | Yes (quota: e.g. N campaigns/mo, M recipients/campaign) |
| **AI Support** | No | Suggested draft + rules; autopilot optional higher tier |
| **AI Support autopilot** | No | Team / add-on |

### 7.2 SaaS cost controls

- **Included quotas** per Pro license; overage packs or upgrade path.
- **BYO LLM API key** — customer supplies OpenAI/Anthropic key; Relaybase does not bill tokens (reduces margin risk).
- **Relaybase-managed AI** — convenience tier with monthly token cap.

### 7.3 Why SaaS helps revenue

- Clear upsell from **$39 one-time mail tool** to **recurring or renewal-backed** publishing + support features.
- Templates, models, and compilers improve without customer Worker redeploys — continuous product value.

---

## 8. Risks and mitigations

| Risk | Impact | Mitigation |
|------|--------|------------|
| **Privacy paradox** | "Mail stays in my CF" message weakens if bodies go to SaaS | Opt-in extensions; transparent data policy; default zero-retention for AI body text |
| **SaaS outage** | Users fear total mail loss | Hard rule: inbound/outbound/mailbox read never depend on SaaS availability |
| **Dual-auth UX** | Worker passtoken + Relaybase account confusion | Single onboarding: sign in → connect CF → install Worker; SSO-style linking |
| **LLM cost** | Unbounded token spend | Quotas, BYO key, autopilot off by default |
| **Email rendering** | Newsletter looks broken in Outlook | Dedicated QA pass; VML in advanced tier; React Email or similar pipeline |
| **Spam / auto-reply loops** | Support bot emails bot | Header filters, rate limits, noreply blocklist |
| **Worker bundle growth** | Temptation to ship features in Worker | Enforce execution matrix (§3.1); code review gate |
| **Brand/domain change** | Pre-launch rename cost | Rename before Phase 0; see §10 |

---

## 9. Development estimates

**Baseline:** Core Relaybase ≈ **3 weeks** at **4–5 hours/day** (~85–105 hours) with Cursor + senior full-stack experience.

**Velocity assumptions:** Reuse Audience, Broadcast patterns, HQ accounts, Railmark editor.

### 9.1 Shared foundation

| Work | Estimate |
|------|----------|
| SaaS API skeleton + auth linking | 3–5 days |
| Feature gates + quotas | 3–5 days |
| Worker ↔ SaaS event pipeline | 5–7 days |
| Degraded-mode fallback | 2–3 days |
| **Subtotal** | **~2–3 weeks** |

### 9.2 Newsletters

| Phase | Estimate |
|-------|----------|
| MVP (editor port, compiler, templates, schedule, tracking, unsubscribe, Desktop mode) | **6–8 weeks** |
| Advanced (segments, A/B, web archive, widgets, AI assist) | **+4–6 weeks** |

Railmark editor reuse saves **~1–1.5 weeks** vs greenfield BlockNote.

### 9.3 AI Support

| Phase | Estimate |
|-------|----------|
| MVP (triage, KB/RAG, suggested draft, rules, webhooks, guardrails) | **5–7 weeks** |
| Advanced (autopilot, tool calling, i18n, diff learning) | **+5–8 weeks** |

### 9.4 Combined timeline (solo, sequential)

| Milestone | Calendar (4–5 h/day) |
|-----------|------------------------|
| Shared foundation | 2–3 weeks |
| Newsletters MVP | +6–8 weeks |
| AI Support MVP | +5–7 weeks |
| **Both MVPs** | **~13–18 weeks (~3.5–4.5 months)** |
| Both + Advanced | **~22–32 weeks (~5–8 months)** |

**Recommended order:** Foundation → **Newsletters MVP** → **AI Support MVP** (clearer monetization story; Broadcast/Audience reuse).

**Compressed MVP (slim scope):** tracking opens only (no clicks v1), AI suggest-only (no autopilot), 3 templates — **~10–12 weeks** total.

---

## 10. Branding and domain (pre-launch)

Extensions strengthen the case for a **`.com` primary domain** for SaaS login, marketing, and trust — especially for billing and AI data processing disclosures.

| Option | Notes |
|--------|-------|
| `relaybase.com` | Ideal brand match; aftermarket price uncertain (often **$1.5k–$15k+** for two-word `.com`; verify via appraisal + broker offer) |
| `wipimail.com` | Owned; **recommended** among owned options — clear email product signal; low trademark risk |
| `wipibox.com` | Owned; ambiguous ("box"); potential confusion with Box, Inc. |

**Rename cost if pre-launch:** ~**4–7 days** (346 files / ~2,200 `relaybase` string occurrences in repo; plus CF Worker names, bundle id `com.relaybase.desktop`, DNS). **Before Phase 0** is the cheapest window.

Product name in this document remains **Relaybase** until a rename is executed.

---

## 11. Release roadmap

```
Phase 0 — Shared SaaS foundation (2–3 weeks)
  • Relaybase account linking, Worker events, feature gates, degraded mode

Phase 1 — Newsletters MVP (6–8 weeks)
  • Railmark editor port, compiler, templates, schedule, tracking, unsubscribe
  • Desktop Newsletters mode
  • Pro gate + quotas

Phase 2 — AI Support MVP (5–7 weeks)
  • Triage, KB/RAG, suggested draft, rules, webhooks
  • Mailbox assistant panel + Console settings

Phase 3 — Advanced (as needed)
  • Newsletters: segments, A/B, web archive, subscribe widget
  • AI: autopilot, tool calling, i18n, diff learning
```

**Do not ship** until:

- [ ] SaaS down → core mail still sends/receives
- [ ] Unsubscribe compliance tested (Gmail, Apple Mail)
- [ ] AI loop prevention tested
- [ ] Privacy policy updated for SaaS data flows
- [ ] Quotas enforced per tier

---

## 12. Open decisions

| # | Question | Options |
|---|----------|---------|
| 1 | Keep Broadcasts separate or fold into Newsletters? | Keep for quick blasts v1; deprecate later |
| 2 | SaaS host: extend HQ Worker vs new `api.*` service? | Start as HQ routes; split when bundle grows |
| 3 | Vector store for RAG | Cloudflare Vectorize vs embedded SQLite vs external |
| 4 | Newsletter images | User R2 only vs SaaS staging bucket |
| 5 | Public web archive | User subdomain Worker vs Relaybase-hosted pages |
| 6 | Default AI privacy mode | Zero-retention vs metadata-only default |
| 7 | Primary domain | relaybase.xyz + wipimail.com redirect vs full rebrand |

---

## 13. Success metrics

### Newsletters

- Campaigns created / sent per account
- Median open rate / click rate (benchmarked internally)
- Unsubscribe rate < industry norm for cohort
- Time from draft to send
- Template reuse rate

### AI Support

- % inbound auto-classified correctly (human override rate)
- Suggested draft acceptance rate (insert without major edit)
- Median time to first response
- Webhook delivery success rate
- Autopilot send rate vs escalation rate (advanced)

---

## 14. References

| Doc | Relevance |
|-----|-----------|
| `PRODUCT.md` | Core BYOCF positioning |
| `PRICING.md` | Draft tiers; extension gating |
| `STRATEGY.md` | Market and licensing context |
| `docs/features/audience-and-broadcasts.md` | Audience groups, Broadcast lifecycle |
| `docs/architecture/hq-ops-d1.md` | Accounts, licenses, billing |
| `docs/architecture/storage-architecture.md` | D1/R2 boundaries |
| `pilots/railmark/app/docs/markdown-editor.md` | BlockNote editor to port |

---

*Last updated: 2026-09-04 — planning document; not a shipping commitment.*
