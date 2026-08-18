export type StoredSentEmail = {
  id: string;
  from: string;
  to: string;
  cc?: string;
  subject: string;
  bodyPreview: string;
  sentAt: string;
  messageId?: string;
  inReplyTo?: string;
  references?: string;
};

const SENT_INDEX_VERSION = 1 as const;

type SentIndexFile = {
  version: typeof SENT_INDEX_VERSION;
  messages: StoredSentEmail[];
};

function sentIndexKey(domain: string): string {
  return `inbound/${domain.trim().toLowerCase()}/_sent.json`;
}

export async function listStoredSent(
  bucket: R2Bucket,
  domain: string,
): Promise<StoredSentEmail[]> {
  const normalized = domain.trim().toLowerCase();
  if (!normalized) return [];
  const object = await bucket.get(sentIndexKey(normalized));
  if (!object) return [];
  try {
    const parsed = JSON.parse(await object.text()) as SentIndexFile;
    if (parsed.version !== SENT_INDEX_VERSION || !Array.isArray(parsed.messages)) {
      return [];
    }
    return [...parsed.messages].sort((a, b) => b.sentAt.localeCompare(a.sentAt));
  } catch {
    return [];
  }
}
