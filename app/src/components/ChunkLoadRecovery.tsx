"use client";

import { useEffect } from "react";

/** One automatic reload when a stale Next.js chunk fails to load after a deploy. */
export function ChunkLoadRecovery() {
  useEffect(() => {
    function maybeReload(reason: unknown) {
      const name =
        reason instanceof Error
          ? reason.name
          : typeof reason === "object" &&
              reason !== null &&
              "name" in reason
            ? String((reason as { name?: unknown }).name)
            : "";
      const message =
        reason instanceof Error
          ? reason.message
          : typeof reason === "object" &&
              reason !== null &&
              "message" in reason
            ? String((reason as { message?: unknown }).message)
            : String(reason ?? "");
      if (name !== "ChunkLoadError" && !message.includes("Loading chunk")) {
        return;
      }
      const key = "relaybase.chunk-reload";
      if (sessionStorage.getItem(key)) return;
      sessionStorage.setItem(key, "1");
      window.location.reload();
    }

    const onRejection = (event: PromiseRejectionEvent) => {
      maybeReload(event.reason);
    };
    const onError = (event: ErrorEvent) => {
      maybeReload(event.error ?? event.message);
    };
    window.addEventListener("unhandledrejection", onRejection);
    window.addEventListener("error", onError);
    return () => {
      window.removeEventListener("unhandledrejection", onRejection);
      window.removeEventListener("error", onError);
    };
  }, []);

  return null;
}
