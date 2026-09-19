import type { SubscriberDataSource } from "@db/types";

export function mergeDataSource(
  existing: SubscriberDataSource | null,
  incoming: SubscriberDataSource | null | undefined,
  keepCredential: boolean,
): SubscriberDataSource | null {
  if (incoming === null) return null;
  if (!incoming) return existing;
  const credential =
    incoming.credential?.trim() ||
    (keepCredential ? existing?.credential : undefined) ||
    undefined;
  return {
    type: "generic_json",
    endpointUrl: incoming.endpointUrl.trim(),
    credential,
    credentialHeader: incoming.credentialHeader?.trim() || undefined,
  };
}
