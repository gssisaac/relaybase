"use client";

import { useEffect, useState } from "react";

/** Matches Tailwind `md` — below this width is treated as mobile layout. */
export const MOBILE_BREAKPOINT_PX = 768;

export function useIsMobile(): boolean {
  const [isMobile, setIsMobile] = useState(false);

  useEffect(() => {
    const query = `(max-width: ${MOBILE_BREAKPOINT_PX - 1}px)`;
    const mql = window.matchMedia(query);
    const update = () => setIsMobile(mql.matches);
    update();
    mql.addEventListener("change", update);
    return () => mql.removeEventListener("change", update);
  }, []);

  return isMobile;
}
