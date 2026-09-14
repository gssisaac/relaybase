"use client";

import { useEffect } from "react";

import { consumeWebCfOAuthCompleteParam } from "./web-oauth-complete";

export function useWebCfOAuthComplete(onComplete: () => void) {
  useEffect(() => {
    if (!consumeWebCfOAuthCompleteParam()) return;
    onComplete();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
}
