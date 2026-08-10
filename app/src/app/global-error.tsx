"use client";

import { PageLoadError } from "@/components/PageLoadError";

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <PageLoadError error={error} reset={reset} includeDocumentShell />
  );
}
