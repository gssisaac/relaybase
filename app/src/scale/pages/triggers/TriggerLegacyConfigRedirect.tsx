"use client";

import { usePathname, useRouter } from "next/navigation";
import { useEffect } from "react";

import { triggerDetailFromPathname, triggerDetailHref } from "@/scale/lib/paths";
import { useTriggerDetail } from "@/scale/pages/triggers/TriggerDetailContext";

const LEGACY_CONFIG_SEGMENTS = new Set(["preview", "trigger", "settings", "content"]);

/** Redirect old tab URLs to `/config`. */
export function TriggerLegacyConfigRedirect() {
  const pathname = usePathname();
  const router = useRouter();
  const { triggerId, trigger } = useTriggerDetail();

  useEffect(() => {
    const match = pathname.match(/^\/scale\/triggers\/[^/]+\/([^/]+)\/?$/);
    const seg = match?.[1]?.toLowerCase();
    if (!seg || !LEGACY_CONFIG_SEGMENTS.has(seg)) return;
    router.replace(triggerDetailHref(triggerId, "config", trigger?.status));
  }, [pathname, router, trigger?.status, triggerId]);

  return null;
}

export function pathnameUsesLegacyTriggerTab(pathname: string): boolean {
  const parsed = triggerDetailFromPathname(pathname);
  if (!parsed) return false;
  const match = pathname.match(/^\/scale\/triggers\/[^/]+\/([^/]+)\/?$/);
  const seg = match?.[1]?.toLowerCase();
  return Boolean(seg && LEGACY_CONFIG_SEGMENTS.has(seg));
}
