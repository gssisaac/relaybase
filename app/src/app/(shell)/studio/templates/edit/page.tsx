"use client";

import { Suspense, useEffect } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { AppLoadingScreen } from "@/components/AppLoadingScreen";

function TemplateEditRedirect() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const id = searchParams.get("id")?.trim();

  useEffect(() => {
    if (!id) {
      router.replace("/studio/messages");
    } else {
      router.replace(`/studio/messages/edit?id=${encodeURIComponent(id)}`);
    }
  }, [id, router]);

  return <AppLoadingScreen />;
}

export default function Page() {
  return (
    <Suspense fallback={<AppLoadingScreen />}>
      <TemplateEditRedirect />
    </Suspense>
  );
}
