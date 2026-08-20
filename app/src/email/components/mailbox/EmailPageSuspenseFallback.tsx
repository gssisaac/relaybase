import { PageLoadingOverlay } from "@/components/ui/page-loading-overlay";

export function EmailPageSuspenseFallback() {
  return (
    <PageLoadingOverlay loading className="min-h-0 flex-1">
      <div />
    </PageLoadingOverlay>
  );
}
