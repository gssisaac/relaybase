"use client";

import { useEffect, useRef, useState } from "react";

import { cn } from "@/lib/utils";

export function TemplateEditableTitle({
  value,
  onChange,
  subjectFallback,
  disabled,
}: {
  value: string;
  onChange: (value: string) => void;
  subjectFallback: string;
  disabled?: boolean;
}) {
  const [editing, setEditing] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const display =
    value.trim() || subjectFallback.trim() || "Untitled template";

  useEffect(() => {
    if (!editing) return;
    const el = inputRef.current;
    el?.focus();
    el?.select();
  }, [editing]);

  if (editing && !disabled) {
    return (
      <input
        ref={inputRef}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        onBlur={() => setEditing(false)}
        onKeyDown={(e) => {
          if (e.key === "Enter") {
            e.preventDefault();
            setEditing(false);
          }
          if (e.key === "Escape") {
            e.preventDefault();
            setEditing(false);
          }
        }}
        aria-label="Template name"
        className={cn(
          "min-w-0 max-w-full truncate rounded-sm bg-background px-1.5 py-0.5",
          "text-sm font-semibold outline-none ring-1 ring-ring",
        )}
      />
    );
  }

  return (
    <button
      type="button"
      disabled={disabled}
      onClick={() => setEditing(true)}
      className={cn(
        "min-w-0 max-w-full truncate text-left text-sm font-semibold",
        disabled
          ? "cursor-default"
          : "rounded-sm hover:bg-accent/60 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring",
      )}
      title={disabled ? undefined : "Click to rename"}
    >
      {display}
    </button>
  );
}
