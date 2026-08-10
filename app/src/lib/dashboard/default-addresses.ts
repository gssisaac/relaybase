export const DEFAULT_ADDRESS_LOCAL_PARTS = [
  "billing",
  "support",
  "privacy",
  "noreply",
  "hello",
  "admin",
] as const;

export const DEFAULT_ADDRESS_DISPLAY_NAMES: Record<
  (typeof DEFAULT_ADDRESS_LOCAL_PARTS)[number],
  string
> = {
  billing: "Billing",
  support: "Support Team",
  privacy: "Privacy",
  noreply: "No Reply",
  hello: "Hello",
  admin: "Admin",
};

export function suggestedDisplayNameForLocalPart(localPart: string): string {
  const key = localPart.trim().toLowerCase();
  if (key in DEFAULT_ADDRESS_DISPLAY_NAMES) {
    return DEFAULT_ADDRESS_DISPLAY_NAMES[
      key as (typeof DEFAULT_ADDRESS_LOCAL_PARTS)[number]
    ];
  }
  if (!key) return "";
  return key.charAt(0).toUpperCase() + key.slice(1);
}

/** Standard product defaults: noreply drops inbound; others receive. */
export function defaultInboundEnabledForLocalPart(localPart: string): boolean {
  return localPart.trim().toLowerCase() !== "noreply";
}

/** Map of local-part → inboundEnabled for a list of parts (noreply off). */
export function defaultInboundEnabledByLocalPart(
  localParts: readonly string[],
): Record<string, boolean> {
  return Object.fromEntries(
    localParts.map((part) => [
      part.trim().toLowerCase(),
      defaultInboundEnabledForLocalPart(part),
    ]),
  );
}
