import type { ReactNode } from "react";

import {
  NewsletterDetailSectionLayout,
} from "@/studio/pages/newsletters/NewsletterDetailShell";
import { NewsletterDetailTabRedirect } from "@/studio/pages/newsletters/NewsletterDetailRedirects";

export default function NewsletterDetailLayout({ children }: { children: ReactNode }) {
  return (
    <>
      <NewsletterDetailTabRedirect />
      <NewsletterDetailSectionLayout>{children}</NewsletterDetailSectionLayout>
    </>
  );
}
