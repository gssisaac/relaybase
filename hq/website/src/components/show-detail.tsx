"use client";

import { useState, type ReactNode } from "react";

export function ShowDetail({ children }: { children: ReactNode }) {
  const [open, setOpen] = useState(false);

  return (
    <div>
      {open ? children : null}
      <button
        type="button"
        aria-expanded={open}
        onClick={() => setOpen((value) => !value)}
        className="mt-4 text-sm text-foreground underline underline-offset-4 hover:text-brand"
      >
        {open ? "Hide detail" : "Show detail"}
      </button>
    </div>
  );
}
