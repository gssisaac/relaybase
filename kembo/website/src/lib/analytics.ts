export const GA_MEASUREMENT_ID =
  process.env.NEXT_PUBLIC_GA_MEASUREMENT_ID?.trim() || undefined;

type Gtag = (
  command: "config" | "event" | "js",
  targetId: string | Date,
  config?: Record<string, string | number | boolean | undefined>,
) => void;

declare global {
  interface Window {
    gtag?: Gtag;
  }
}

export function trackCtaClick(params: {
  label: string;
  location: string;
}) {
  if (!GA_MEASUREMENT_ID || typeof window === "undefined" || !window.gtag) {
    return;
  }

  window.gtag("event", "cta_click", {
    cta_label: params.label,
    button_location: params.location,
  });
}
