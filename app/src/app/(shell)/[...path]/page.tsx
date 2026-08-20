"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

import { normalizeEntryPath } from "@/email/sidebar-mode";

type Props = { params: Promise<{ path: string[] }> };

/**
 * Dev-only legacy redirect: rewrites deep path segments (e.g.
 * `/accounts/user@x.com/logs`, `/settings/d1`, `/broadcasts/new`) into the
 * static-export-safe query form via `normalizeEntryPath`. Real section
 * routes are separate files; this only catches leftover deep links.
 *
 * Stashed (removed) during `output: "export"` by build-desktop.mjs so the
 * static build never emits a catch-all that shadows real routes.
 */
export default function Page({ params }: Props) {
  const router = useRouter();
  useEffect(() => {
    void params.then(({ path }) => {
      const tail = path.filter(Boolean);
      const raw = `/${tail.map(encodeURIComponent).join("/")}`;
      const search =
        typeof window !== "undefined" ? window.location.search : "";
      const target = normalizeEntryPath(`${raw}${search}`);
      router.replace(target);
    });
  }, [params, router]);
  return null;
}
