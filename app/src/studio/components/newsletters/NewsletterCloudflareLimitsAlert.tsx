"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import { TriangleAlert } from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  CF_LIMITS_ALERT_HIDDEN_STORAGE_KEY,
  NewsletterCloudflareSendingLimitsCard,
} from "@/studio/components/newsletters/NewsletterCloudflareSendingLimitsCard";

type NewsletterCfLimitsAlertContextValue = {
  hidden: boolean;
  dismiss: () => void;
  show: () => void;
};

const NewsletterCfLimitsAlertContext =
  createContext<NewsletterCfLimitsAlertContextValue | null>(null);

function readHiddenFromStorage(): boolean {
  try {
    return localStorage.getItem(CF_LIMITS_ALERT_HIDDEN_STORAGE_KEY) === "1";
  } catch {
    return false;
  }
}

export function NewsletterCloudflareLimitsAlertProvider({ children }: { children: ReactNode }) {
  const [hidden, setHidden] = useState(false);

  useEffect(() => {
    setHidden(readHiddenFromStorage());
  }, []);

  const dismiss = useCallback(() => {
    setHidden(true);
    try {
      localStorage.setItem(CF_LIMITS_ALERT_HIDDEN_STORAGE_KEY, "1");
    } catch {
      /* ignore */
    }
  }, []);

  const show = useCallback(() => {
    setHidden(false);
    try {
      localStorage.removeItem(CF_LIMITS_ALERT_HIDDEN_STORAGE_KEY);
    } catch {
      /* ignore */
    }
  }, []);

  const value = useMemo(
    () => ({ hidden, dismiss, show }),
    [hidden, dismiss, show],
  );

  return (
    <NewsletterCfLimitsAlertContext.Provider value={value}>
      {children}
    </NewsletterCfLimitsAlertContext.Provider>
  );
}

export function useNewsletterCloudflareLimitsAlert(): NewsletterCfLimitsAlertContextValue {
  const ctx = useContext(NewsletterCfLimitsAlertContext);
  if (!ctx) {
    throw new Error(
      "useNewsletterCloudflareLimitsAlert must be used within NewsletterCloudflareLimitsAlertProvider",
    );
  }
  return ctx;
}

export function NewsletterCloudflareLimitsAlertBanner({ className }: { className?: string }) {
  const { hidden, dismiss } = useNewsletterCloudflareLimitsAlert();
  if (hidden) return null;
  return <NewsletterCloudflareSendingLimitsCard className={className} onDismiss={dismiss} />;
}

export function NewsletterCloudflareLimitsAlertShowButton() {
  const { hidden, show } = useNewsletterCloudflareLimitsAlert();
  if (!hidden) return null;
  return (
    <Button
      type="button"
      variant="outline"
      size="icon-sm"
      aria-label="Show Cloudflare send quota notice"
      title="Cloudflare send quota"
      onClick={show}
    >
      <TriangleAlert className="size-4 text-amber-600 dark:text-amber-400" />
    </Button>
  );
}
