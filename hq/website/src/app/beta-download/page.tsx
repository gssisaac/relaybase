import type { Metadata } from "next";

import { BetaDownloadCard } from "@/components/beta-download-card";
import { resolveRelease } from "@/lib/resolve-release";
import { pageSocialMeta, siteConfig } from "@/lib/site-config";

export const metadata: Metadata = {
  title: "Download Relaybase",
  description:
    "Download the Relaybase Mac app for Apple Silicon. Windows is coming soon.",
  alternates: {
    canonical: siteConfig.betaDownloadPath,
  },
  ...pageSocialMeta({
    title: "Download Relaybase",
    description:
      "Download the Relaybase Mac app for Apple Silicon. Windows is coming soon.",
    path: siteConfig.betaDownloadPath,
  }),
};

export default function BetaDownloadPage() {
  const release = resolveRelease();
  return <BetaDownloadCard release={release} />;
}
