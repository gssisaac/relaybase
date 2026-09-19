import type { ReactNode } from "react";

import { NewsletterDetailRouteLayout } from "@/studio/pages/newsletters/NewsletterDetailRouteLayout";

export function generateStaticParams() {
  return [{ id: "_" }];
}

export default async function NewsletterIdLayout({
  children,
  params,
}: {
  children: ReactNode;
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  let newsletterId = id;
  try {
    newsletterId = decodeURIComponent(id);
  } catch {
    /* keep raw */
  }

  return (
    <NewsletterDetailRouteLayout newsletterId={newsletterId.trim()}>
      {children}
    </NewsletterDetailRouteLayout>
  );
}
