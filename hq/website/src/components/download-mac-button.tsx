import { ArrowRight } from "lucide-react";

import { DownloadCtaLabel } from "@/components/download-cta-label";
import { Button } from "@/components/ui/button";
import { resolveRelease } from "@/lib/resolve-release";

type DownloadMacButtonProps = {
  size?: "default" | "sm" | "lg";
  showArrow?: boolean;
};

export function DownloadMacButton({
  size = "lg",
  showArrow = false,
}: DownloadMacButtonProps) {
  const { dmgUrlAarch64 } = resolveRelease();

  if (!dmgUrlAarch64) {
    return (
      <Button size={size} disabled>
        <DownloadCtaLabel />
        {showArrow ? <ArrowRight data-icon="inline-end" /> : null}
      </Button>
    );
  }

  return (
    <Button size={size} render={<a href={dmgUrlAarch64} />}>
      <DownloadCtaLabel />
      {showArrow ? <ArrowRight data-icon="inline-end" /> : null}
    </Button>
  );
}
