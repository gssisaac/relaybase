"use client";

export function CrmPlaceholderView() {
  return (
    <div className="flex h-full flex-col items-center justify-center gap-2 p-8 text-center">
      <h1 className="text-lg font-semibold">CRM</h1>
      <p className="max-w-sm text-sm text-muted-foreground">
        Contacts, pipeline, and campaigns land here next.
      </p>
    </div>
  );
}
