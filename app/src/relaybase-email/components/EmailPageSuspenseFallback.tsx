import { PageLoadingOverlay } from "@/components/ui/page-loading-overlay";

export function EmailPageSuspenseFallback() {
  return (
    <PageLoadingOverlay loading className="min-h-[min(50vh,400px)]">
      <div />
    </PageLoadingOverlay>
  );
}
