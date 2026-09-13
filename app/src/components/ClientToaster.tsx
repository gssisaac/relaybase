"use client";

import { useEffect, useState } from "react";

import { Toaster } from "@/components/ui/sonner";

/** Sonner must not SSR — avoids hydration mismatches and React script-tag warnings. */
export function ClientToaster() {
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);
  if (!mounted) return null;
  return <Toaster />;
}
