/** Inbox URL opened when a desktop new-mail notification is clicked. */
export function inboxHrefForNotification(payload: {
  messageId?: string | null;
  account?: string | null;
}): string | null {
  const messageId = payload.messageId?.trim();
  if (!messageId) return null;
  const params = new URLSearchParams();
  const account = payload.account?.trim();
  if (account && account !== "all") {
    params.set("account", account);
  }
  params.set("m", messageId);
  return `/email/inbox?${params.toString()}`;
}
