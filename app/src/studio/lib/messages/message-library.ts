/** Shipped catalog templates with pre-generated PNG thumbnails under `public/studio/`. */
export function isPresetCatalogTemplate(id: string): boolean {
  return id.startsWith("msgtpl_preset_");
}
