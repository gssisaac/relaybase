"use client";

import { useEffect, useState } from "react";

import { getStudioApiBase } from "@/studio/lib/studio-origin";

export function useIdAvailability(username: string, enabled: boolean) {
  const [available, setAvailable] = useState<boolean | null>(null);
  const [checking, setChecking] = useState(false);
  const [hint, setHint] = useState<string | null>(null);

  useEffect(() => {
    if (!enabled || username.trim().length < 3) {
      setAvailable(null);
      setHint(null);
      return;
    }
    let active = true;
    const handle = window.setTimeout(() => {
      setChecking(true);
      void fetch(
        `${getStudioApiBase()}/auth/check-username?username=${encodeURIComponent(username.trim())}`,
        { credentials: "include" },
      )
        .then(async (res) => {
          const body = (await res.json()) as {
            available?: boolean;
            reason?: "invalid" | "taken";
            error?: string;
          };
          if (!active) return;
          if (!res.ok) {
            setAvailable(null);
            setHint(body.error ?? "Could not check username.");
            return;
          }
          if (body.reason === "invalid") {
            setAvailable(false);
            setHint(body.error ?? "Invalid username.");
            return;
          }
          if (body.available === true) {
            setAvailable(true);
            setHint(null);
            return;
          }
          if (body.available === false) {
            setAvailable(false);
            setHint("Username is taken.");
            return;
          }
          setAvailable(null);
          setHint(null);
        })
        .catch(() => {
          if (!active) return;
          setAvailable(null);
          setHint(null);
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

  return { available, checking, hint };
}
