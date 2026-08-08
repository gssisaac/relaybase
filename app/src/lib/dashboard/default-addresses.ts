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
