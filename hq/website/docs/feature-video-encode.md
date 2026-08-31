# Feature clip encode

**Audience:** anyone replacing homepage feature walkthrough MP4s under `public/video/features/`.

**Rule:** Do not drop the raw screen recording into `public/`. Encode to the retina frame below so text stays sharp at 760 CSS and the file stays small enough for the marketing site.

Display and encode sizes live on `FeatureClip` in `src/components/feature-walkthrough.tsx` (`aspect-[3290/2160]`, `width={760}`, `height={499}`, `object-top`).

---

## Size

| | CSS | Retina (×2) |
|--|-----|-------------|
| Width | 760 | **1520** |
| Height | 499 | **998** |
| Aspect | 3290 / 2160 | same |

760 × 2160 / 3290 ≈ 498.5, rounded to 499 CSS so the HTML `width` / `height` match the box. Encode uses even pixels: **1520 × 998**.

The clip is `object-cover` + `object-top` — the top of the Mac window must stay visible. When scaling a source that is not exactly 3290×2160, crop from the bottom, not the top.

---

## Encode

Screen recording, not film. Keep 60 fps. Strip audio. H.264 High for Safari / Chrome.

| Setting | Value |
|---------|--------|
| Size | 1520 × 998 |
| Codec | libx264, High, level 4.2, yuv420p |
| Quality | CRF 18, `-tune animation`, `-preset slow` |
| Scale | lanczos, cover-crop, top-aligned |
| Mux | `+faststart`, no audio |

Sources live outside this repo: `../../workspace/relaybase/feature-screenshots/featureNN.mp4` (from the monorepo root). After encode, write over the matching file in `public/video/features/` and bump the `?v=` query on `src` in `feature-walkthrough.tsx` so browsers do not keep the old range.

```bash
SRC=../../workspace/relaybase/feature-screenshots/feature01.mp4
OUT=hq/website/public/video/features/01-mail-in-your-account.mp4
VF="scale=1520:998:force_original_aspect_ratio=increase:flags=lanczos,crop=1520:998:(iw-1520)/2:0"

ffmpeg -y -i "$SRC" \
  -vf "$VF" \
  -c:v libx264 -preset slow -crf 18 -tune animation \
  -profile:v high -level 4.2 -pix_fmt yuv420p \
  -movflags +faststart -an \
  "$OUT"
```

Do not re-encode an already-compressed public file. Always start from the workspace original.

---

## Current files (2026-08-25)

| Clip | Public file | Source | Encoded | Ratio |
|------|-------------|--------|---------|-------|
| 01 | `01-mail-in-your-account.mp4` | 3380×2160 · 17.3 MB | 1520×998 · 2.1 MB · 10.55 s | **12.7%** · 7.9× |
| 02 | `02-mail-stack.mp4` | 3290×2160 · 13.9 MB | 1520×998 · 1.4 MB · 6.67 s | **9.9%** · 10.1× |
| 03 | `03-keyboard-triage.mp4` | 3290×2160 · 5.3 MB | 1520×998 · 706 KB · 8.67 s | **13.1%** · 7.6× |
| 04 | `04-compose-drafts.mp4` | 3290×2160 · 11.7 MB | 1520×998 · 1.2 MB · 12.28 s | **10.6%** · 9.4× |
| 05 | `05-product-address.mp4` | 3290×2160 · 7.8 MB | 1520×998 · 1.1 MB · 13.63 s | **13.6%** · 7.4× |
| 06 | `06-threading.mp4` | 3290×2160 · 5.7 MB | 1520×998 · 672 KB · 6.97 s | **11.5%** · 8.7× |
| 07 | `07-search.mp4` | 3290×2160 · 11.8 MB | 1520×998 · 1.6 MB · 5.12 s | **13.9%** · 7.2× |
| 08 | `08-console-mode.mp4` | 3290×2160 · 4.3 MB | 1520×998 · 615 KB · 8.97 s | **14.1%** · 7.1× |
| 09 | `09-one-pass-install.mp4` | 3290×2160 · 12.9 MB | 1520×998 · 1.6 MB · 11.65 s | **12.2%** · 8.2× |
| 10 | `10-domain-keys.mp4` | 3290×2160 · 9.8 MB | 1520×998 · 1.0 MB · 5.62 s | **10.4%** · 9.6× |
| **01–10** | | **96.8 MB** | **11.8 MB** | **~12%** |

Feature 04 is compose/drafts (`04-compose-drafts.mp4`). Feature 08 is console mode (`08-console-mode.mp4`). Feature 09 is one-pass install (`09-one-pass-install.mp4`), not the send API.

The hero intro (`public/video/relaybase-intro.mp4`, 1280×898, 4.0 MB, 65 s) is a separate asset — do not run this feature recipe on it unless you are replacing that file on purpose.

---

## Paid stills

Sources: `../../workspace/relaybase/feature-screenshots/*.png`. Copy to `public/images/features/` by name — do not invent a still for a slot that has no matching file.

| Source | Public file | Paid card |
|--------|-------------|-----------|
| `multidomains.png` | `paid-multi-domain.png` | Unified multi-domain inbox |
| `adding-new-domains.png` | `paid-import-zones.png` | Import Cloudflare zones |
| `multi-accounts.png` | `paid-account-switcher.png` | All inboxes + per-account switcher |
| `teamates.png` | `paid-other-device.png` | Teammate mobile / Other device |
| `audience.png` | `paid-audience.png` | Audience |
| `inbound-off.png` | `paid-default-addresses.png` | Standard product addresses in one step |

Do not ship a Broadcasts card; it duplicates Audience.
