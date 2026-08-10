"use client";

import { PageLoadError } from "@/components/PageLoadError";

export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return <PageLoadError error={error} reset={reset} />;
}
