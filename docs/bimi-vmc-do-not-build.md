# Do not build BIMI / VMC inbox-logo display

**Status:** Rejected. Removed from the app on 2026-08-04. Do not reintroduce
without re-reading this document and getting explicit product sign-off.

## Conclusion

Relaybase ($10/month/domain) will not offer a "your logo shows up in Gmail"
feature. Do not add a logo upload UI, a BIMI DNS toggle, a VMC/CMC upload
flow, or any DigiCert/CA integration back into the app or admin. If someone
(a person or an AI assistant) proposes this again, point them at this file
first.

## What actually happened (history)

An earlier build cycle added a full "Inbox logo" feature: upload an SVG,
auto-apply `_dmarc.<domain>` and `default._bimi.<domain>` TXT records via the
Cloudflare API, and show a "Logo ready" status once DNS looked correct. This
was built on the assumption — asserted confidently by an AI coding
assistant, without verifying it against how mailbox providers actually
render BIMI — that a valid BIMI DNS record plus a reachable SVG was
sufficient for the logo to appear in the recipient's inbox.

**That assumption was wrong.** The BIMI spec allows a "self-asserted" record
(just the `l=` logo tag), but Gmail and Apple Mail do not honor
self-asserted records. They require the `a=` tag to point at a **Verified
Mark Certificate (VMC)** or **Common Mark Certificate (CMC)** — a paid
credential issued by one of a small number of accredited Certificate
Authorities (currently DigiCert; Entrust exited the public-CA business in
2025). Without it, Gmail shows the sender's letter avatar regardless of how
correct the DNS and SVG are.

The person running this project spent **several weeks** debugging DNS,
SVG formatting, and Cloudflare TXT record quoting warnings, believing the
feature was "almost working," before discovering that no amount of DNS or
SVG fixing would ever make it work without a certificate the product had no
path to provide. That is the failure this document exists to prevent from
repeating.

## Why it doesn't work without a paid certificate

- BIMI `l=` (logo URL) alone → **not honored by Gmail or Apple Mail.**
- BIMI `a=` (VMC/CMC certificate URL) → **required** by Gmail and Apple Mail.
- Cloudflare does **not** issue VMC/CMC certificates. It only hosts DNS.
- The only realistic issuance path is the **DigiCert CertCentral API**
  (`vmc_basic` / `mark_certificate` products). Ordering, DCV, and PEM
  download can be automated — but organization validation, trademark or
  prior-use validation, and identity verification (a video call with a
  DigiCert validation specialist) **cannot** be automated or done on behalf
  of a customer by Relaybase.

## Cost (2026 DigiCert list pricing, subject to change)

| Certificate | Requirement | Approx. annual cost | Gmail result |
|---|---|---|---|
| CMC (Common Mark Certificate) | Prior use of the logo as a mark (~12+ months), no trademark needed | **~$1,416/year** | Logo shown, no verified checkmark |
| VMC (Verified Mark Certificate) | Registered trademark or government mark | **~$1,752/year** | Logo shown + Gmail's blue verified checkmark |

Reseller pricing can be lower (roughly $650–$900/year depending on term and
vendor), but still requires the same organization/trademark/identity
validation, and buyers must confirm the reseller's certificates are actually
honored by target mailbox providers.

**This is enterprise-brand pricing, not indie/SMB pricing.** Relaybase
charges **$10/month ($120/year) per domain**. A single BIMI certificate
costs roughly **10–15x more per year than the entire product subscription**.
Companies large enough to justify a $1,400–$1,750/year line item for an
inbox logo are, almost by definition, not the audience paying $10/month for
`billing@`/`support@` infrastructure — they already run Google Workspace,
dedicated deliverability tooling, and often an in-house or agency-managed
DMARC/BIMI program. Building this into a $10 product would mean either:

1. Asking indie/SMB customers to pay ~12x their subscription price for a
   feature that mostly benefits large, already-trademarked brands, or
2. Relaybase absorbing that cost per customer, which breaks the unit
   economics of a flat $10/domain plan.

Neither is compatible with this product's positioning. See
[PRODUCT.md](../PRODUCT.md) — the value proposition is `billing@`/`support@`
addresses, transactional send, inbound receive, and API/webhooks, not an
inbox-logo/branding product.

## What is NOT affected by this decision

Do not confuse "no BIMI logo" with "no sender branding." These remain fully
supported and are unrelated to BIMI/VMC:

- **From display name** (`displayName` on addresses, `fromName` on sends) —
  e.g. `Your App <billing@yourdomain.com>`. This is what recipients actually
  see as the sender name in every mail client, with no certificate required.
  See `AccountsView.tsx`, `api/email/addresses/route.ts`,
  `api/email/send/route.ts`.
- **From domain** — recipients see `yourdomain.com`, not a shared relay
  domain.
- **SPF / DKIM / DMARC** — these are legitimate, zero-cost sender
  authentication signals that improve deliverability and prevent spoofing.
  DMARC apply/status remains available in the admin (Relaybase → DMARC), and
  should stay.

## What was removed (2026-08-04)

- App: "Logo" settings page (`EmailSettingsBrandingView`), its nav entry,
  and all `api/email/branding/*` routes (status, logo upload, VMC/PEM
  upload, public unauthenticated asset serving).
- App: `lib/relaybase/branding.ts` (BIMI/DMARC DNS builders, KV/filesystem
  logo+PEM storage, auto-sync-on-upload logic) and the `DomainBrandingConfig`
  /`domainBranding` fields in `dev-email-store.ts`.
- Admin: BIMI logo URL field, "Apply BIMI"/"Apply both" actions, and BIMI
  status badges/table rows in the Branding view and the per-user Branding
  section. The admin tab was renamed **Branding → DMARC** to match what it
  actually does now.
- Admin: `applyDomainBrandingDns` no longer accepts an `applyBimi` flag. On
  every DMARC apply, it now also deletes any leftover
  `default._bimi.<domain>` TXT record from the retired feature (self-healing
  cleanup, safe to call repeatedly).
- Local sample data under `data/branding/`.

DMARC configuration and apply (`_dmarc.<domain>` TXT) is intentionally kept
in the **admin** only — it is a real, working, zero-marginal-cost sender
authentication feature. It was never removed and should not be removed.

## If this comes up again

Before building any part of BIMI/VMC display again, get explicit answers to:

1. Who is paying the ~$1,400–$1,750/year certificate fee — the customer or
   Relaybase — and does that fit a $10/month product?
2. Is the target customer segment large enough to have a registered
   trademark or 12+ months of prior mark use, and willing to do a live
   identity-verification call with a CA?
3. Has someone actually confirmed, live, that Gmail/Apple render the logo
   with the certificate in place — not just that the BIMI DNS record
   validates?

If the answer to (1) breaks the $10/domain pricing model, or (2)/(3) haven't
been verified, do not build it.
