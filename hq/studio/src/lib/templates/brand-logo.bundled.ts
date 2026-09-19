import brandLogoPng from "../../../public/brand/relaybase-icon.png";

/** Worker bundle only — Wrangler `rules` type Data on *.png. */
export function loadBundledBrandLogoPng(): Uint8Array {
  return new Uint8Array(brandLogoPng);
}
