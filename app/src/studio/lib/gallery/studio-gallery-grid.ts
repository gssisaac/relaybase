/** Thumbnail capture size — cards scale between these track widths in gallery grids. */
export const STUDIO_GALLERY_CARD_MIN_PX = 220;
export const STUDIO_GALLERY_CARD_MAX_PX = 320;

/** Messages, Templates, and Layouts list grids — capped card width, fluid column count. */
export const studioGalleryGridClassName =
  "grid gap-4 grid-cols-[repeat(auto-fill,minmax(min(100%,220px),320px))]";
