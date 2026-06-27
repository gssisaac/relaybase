"use client";

import { useDomain } from "@/lib/dashboard/DomainContext";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

export function CurrentDomainSelect({ className }: { className?: string }) {
  const { domains, activeDomain, loading, setActiveDomain } = useDomain();

  if (loading) {
    return (
      <Select disabled>
        <SelectTrigger className={className ?? "h-9 w-[200px]"}>
          <SelectValue placeholder="Loading domains…" />
        </SelectTrigger>
      </Select>
    );
  }

  if (!domains.length) {
    return (
      <Select disabled>
        <SelectTrigger className={className ?? "h-9 w-[200px]"}>
          <SelectValue placeholder="No domains" />
        </SelectTrigger>
      </Select>
    );
  }

  return (
    <Select
      value={activeDomain ?? undefined}
      onValueChange={(value) => {
        if (value) void setActiveDomain(value);
      }}
    >
      <SelectTrigger className={className ?? "h-9 w-[220px]"}>
        <SelectValue placeholder="Select domain" />
      </SelectTrigger>
      <SelectContent>
        {domains.map((entry) => (
          <SelectItem key={entry.domain} value={entry.domain}>
            {entry.domain}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}
