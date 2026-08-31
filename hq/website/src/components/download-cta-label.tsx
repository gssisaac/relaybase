import { Badge } from "@/components/ui/badge";
import { siteConfig } from "@/lib/site-config";
import { cn } from "@/lib/utils";

/** CTA copy + Beta badge. Swap `siteConfig.beta.cta` when Windows ships. */
export function DownloadCtaLabel({
  badgeClassName,
}: {
  badgeClassName?: string;
}) {
  return (
    <>
      {siteConfig.beta.cta}
      <Badge
        variant="teal"
        className={cn("h-4 px-1.5 text-[10px] font-semibold", badgeClassName)}
      >
        {siteConfig.beta.ctaBadge}
      </Badge>
    </>
  );
}
