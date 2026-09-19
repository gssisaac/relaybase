/** Thumbnail capture size — cards scale between these track widths in gallery grids. */
export const STUDIO_GALLERY_CARD_MIN_PX = 220;
export const STUDIO_GALLERY_CARD_MAX_PX = 420;

/** Fluid gallery: min card width, grows with the row (no fixed 320px tracks). */
export const studioGalleryGridClassName =
  "grid w-full min-w-0 gap-4 grid-cols-[repeat(auto-fill,minmax(min(100%,220px),1fr))]";
