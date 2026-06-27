"use client";

import Link from "next/link";

import { useDomain } from "@/lib/dashboard/DomainContext";
import { useEmailPaths } from "@/relaybase-email/components/useEmailPaths";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

export function CurrentDomainSelect({ className }: { className?: string }) {
  const { domains, activeDomain, loading, setActiveDomain } = useDomain();
  const { base } = useEmailPaths();

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
      <Alert className={className}>
        <AlertTitle>No domains yet</AlertTitle>
        <AlertDescription>
          <Link href={`${base}/domains`} className="font-medium underline">
            Add a domain
          </Link>{" "}
          to start using accounts, email, broadcasts, and audience.
        </AlertDescription>
      </Alert>
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
