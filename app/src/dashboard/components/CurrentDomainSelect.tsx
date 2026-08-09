"use client";

import { useDashboardDomain } from "@/dashboard/hooks/useDashboardDomain";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

export function CurrentDomainSelect({ className }: { className?: string }) {
  const { domains, domain, loading, setDomain } = useDashboardDomain();

  // Always controlled — never pass `undefined` (Base UI warns on uncontrolled→controlled).
  const value = domain ?? null;
  const disabled = loading || domains.length === 0;
  const placeholder = loading
    ? "Loading domains…"
    : domains.length === 0
      ? "No domains"
      : "Select domain";

  return (
    <Select
      value={value}
      onValueChange={(next) => {
        if (next) setDomain(next);
      }}
      disabled={disabled}
    >
      <SelectTrigger className={className ?? "h-9 w-[280px]"}>
        <SelectValue placeholder={placeholder} />
      </SelectTrigger>
      {domains.length > 0 ? (
        <SelectContent>
          {domains.map((entry) => (
            <SelectItem key={entry.domain} value={entry.domain}>
              {entry.domain}
            </SelectItem>
          ))}
        </SelectContent>
      ) : null}
    </Select>
  );
}
