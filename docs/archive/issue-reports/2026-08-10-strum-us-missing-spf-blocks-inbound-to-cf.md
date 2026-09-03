# Missing SPF on strum.us blocks Google Workspace mail into Cloudflare MX

**Date:** 2026-08-10  
**Status:** Fixed in Cloudflare DNS (SPF added)  
**Severity:** High (outbound from Workspace rejected by CF Email Routing receivers)  
**Components:** Cloudflare DNS for `strum.us` (not Relaybase Worker code)

## Summary

Replies from `isaac@strum.us` (Google Workspace) to `isaac@letssayso.com` (Cloudflare Email Routing / Relaybase) were blocked, while the same address received mail from `gssisaac@gmail.com` within ~2 minutes. Dashboard showed `isaac@letssayso.com` inbound enabled with prior received count &gt; 0.

## Symptoms

1. Forward `isaac@letssayso.com` → `isaac@strum.us` delivered successfully.
2. Reply `isaac@strum.us` → `isaac@letssayso.com` blocked (immediate).
3. Test from Gmail (`gssisaac@gmail.com` → `isaac@letssayso.com`) succeeded.
4. Second Workspace reply shortly after was blocked again.
5. Not a Relaybase “address missing” issue: Accounts UI listed `isaac@letssayso.com` with inbound on and 3 received.

## Root cause

After moving `strum.us` to Cloudflare DNS, Google Workspace mail auth records were incomplete:

| Record | Before fix |
|--------|------------|
| MX (Google) | Present (`aspmx.l.google.com` …) |
| Apex SPF | **Missing** |
| `google._domainkey` DKIM | **Missing** |
| DMARC | `v=DMARC1; p=reject;` |

`letssayso.com` receives via Cloudflare MX (`route*.mx.cloudflare.net`). On inbound, CF checks sender authentication. Gmail’s domain has valid SPF/DKIM; `strum.us` had **no SPF** while DMARC was `p=reject`, so CF rejected Workspace mail at the MX edge. Mail never reached the Relaybase Worker.

Separate from this: apex had only CF bounce-subdomain auth (`cf-bounce.strum.us` SPF/DKIM), not Google Workspace apex SPF.

## Fix

Added Cloudflare DNS TXT on zone `strum.us` (`9644706d793983f0086e3cc334f70338`):

| Type | Name | Content | Record ID |
|------|------|---------|-----------|
| TXT | `strum.us` | `v=spf1 include:_spf.google.com ~all` | `0105a517d340289ec2d2f01977c9c06e` |

Verified via `1.1.1.1`:

```
strum.us. 3600 IN TXT "v=spf1 include:_spf.google.com ~all"
```

## Remaining

- Enable Google Workspace DKIM and add the `google._domainkey` CNAME/TXT to Cloudflare for reliable DMARC alignment under `p=reject`.
- Rotate API tokens that were shared during this fix.

## Related

- `2026-08-10-send-log-false-positive-empty-disposition.md` — separate compose-log heuristic issue; not the cause of this inbound block.
