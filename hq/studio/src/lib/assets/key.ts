export function newsletterAssetKey(broadcastId: string, filename: string): string {
  const safeName = filename.replace(/[^a-zA-Z0-9._-]+/g, "-").slice(0, 120);
  return `${broadcastId}/${safeName}`;
}
