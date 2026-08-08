"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

import type { PanelViewProps } from "@/lib/dashboard/shared/DashboardPageContent";
import { useProductHref } from "@/lib/dashboard/shared/ProductContext";
import { DashboardPanelView } from "@/dashboard/panel";
import { EmailShell } from "@/email/components/EmailShell";
import {
  EmailMailboxRoutes,
  EmailsLegacyRedirect,
} from "@/email/panel";

function IndexRedirect() {
  const router = useRouter();
  const dashboard = useProductHref("dashboard");
  useEffect(() => {
    router.replace(dashboard);
  }, [router, dashboard]);
  return null;
}

export function RelaybaseEmailPanelView({ subPath }: PanelViewProps) {
  if (subPath.length === 0) {
    return (
      <EmailShell>
        <IndexRedirect />
      </EmailShell>
    );
  }

  const [root, second, ...rest] = subPath;
  const isAccountDetail = root === "accounts" && subPath.length > 1;
  const isMailbox = root === "email" || root === "emails" || isAccountDetail;

  let content = null;
  if (root === "email") {
    content = <EmailMailboxRoutes second={second} rest={rest} />;
  } else if (root === "emails") {
    content = <EmailsLegacyRedirect second={second} rest={rest} />;
  } else {
    content = <DashboardPanelView subPath={subPath} />;
  }

  return <EmailShell forceFullBleed={isMailbox}>{content}</EmailShell>;
}
