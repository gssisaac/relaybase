export const FONT =
  "-apple-system, BlinkMacSystemFont, 'Segoe UI', Helvetica, Arial, sans-serif";

export const COLOR = {
  brand: "#e85d2a",
  fg: "#0f172a",
  muted: "#64748b",
  border: "#e2e8f0",
  page: "#f4f6f8",
  card: "#ffffff",
  well: "#f1f5f9",
  white: "#ffffff",
  badgeFg: "#0f766e",
  badgeBg: "#ccfbf1",
} as const;

export const BRAND = {
  name: "Relaybase",
  site: "https://relaybase.xyz",
  icon: "https://relaybase.xyz/icon.png",
  tagline: "The inbox for your Cloudflare domains.",
} as const;

export const FROM = {
  beta: { address: "beta@relaybase.xyz", name: BRAND.name },
} as const;
