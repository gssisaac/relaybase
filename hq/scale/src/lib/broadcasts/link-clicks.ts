import { store } from "../../db/store";

export function aggregateBroadcastLinkClicks(broadcastId: string) {
  const events = store
    .read()
    .trackingEvents.filter((e) => e.broadcastId === broadcastId && e.type === "click" && e.url);
  const byUrl = new Map<string, { url: string; clicks: number; uniqueRecipients: Set<string> }>();
  for (const event of events) {
    const url = event.url!;
    let row = byUrl.get(url);
    if (!row) {
      row = { url, clicks: 0, uniqueRecipients: new Set() };
      byUrl.set(url, row);
    }
    row.clicks += 1;
    row.uniqueRecipients.add(event.recipientId);
  }
  return [...byUrl.values()]
    .map((row) => ({
      url: row.url,
      clicks: row.clicks,
      uniqueClicks: row.uniqueRecipients.size,
    }))
    .sort((a, b) => b.clicks - a.clicks || a.url.localeCompare(b.url));
}
