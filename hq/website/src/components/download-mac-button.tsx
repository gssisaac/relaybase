import { resolveRelease } from "@/lib/resolve-release";

import { DownloadMacButtonClient } from "@/features/download-access/client";

type DownloadMacButtonProps = {
  location: "header" | "hero" | "footer";
  size?: "default" | "sm" | "lg";
  showArrow?: boolean;
};

export function DownloadMacButton({
  location,
  size = "lg",
  showArrow = false,
}: DownloadMacButtonProps) {
  const { dmgUrlAarch64 } = resolveRelease();

  if (!dmgUrlAarch64) {
    return (
      <DownloadMacButtonClient
        href=""
        location={location}
        size={size}
        showArrow={showArrow}
        disabled
      />
    );
  }

  return (
    <DownloadMacButtonClient
      href={dmgUrlAarch64}
      location={location}
      size={size}
      showArrow={showArrow}
    />
  );
}
