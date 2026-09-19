"use client";

import { useEffect, useState } from "react";

import { getStudioApiBase } from "@/studio/lib/studio-origin";

export function useIdAvailability(username: string, enabled: boolean) {
  const [available, setAvailable] = useState<boolean | null>(null);
  const [checking, setChecking] = useState(false);

  useEffect(() => {
    if (!enabled || username.trim().length < 3) {
      setAvailable(null);
      return;
    }
    let active = true;
    const handle = window.setTimeout(() => {
      setChecking(true);
      void fetch(
        `${getStudioApiBase()}/auth/check-username?username=${encodeURIComponent(username.trim())}`,
        { credentials: "include" },
      )
        .then((res) => res.json())
        .then((body: { available?: boolean }) => {
          if (!active) return;
          setAvailable(Boolean(body.available));
        })
        .catch(() => {
          if (!active) return;
          setAvailable(null);
        })
        .finally(() => {
          if (active) setChecking(false);
        });
    }, 350);

    return () => {
      active = false;
      window.clearTimeout(handle);
    };
  }, [username, enabled]);

  return { available, checking };
}
