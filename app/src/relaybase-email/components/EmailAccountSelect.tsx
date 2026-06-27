"use client";

import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

import type { Address } from "@/relaybase-email/components/types";

export type EmailAccountFilter = "all" | (string & {});

type EmailAccountSelectProps = {
  addresses: Address[];
  value: EmailAccountFilter;
  onChange: (value: EmailAccountFilter) => void;
  disabled?: boolean;
  className?: string;
};

export function EmailAccountSelect({
  addresses,
  value,
  onChange,
  disabled,
  className,
}: EmailAccountSelectProps) {
  return (
    <Select
      value={value}
      onValueChange={(next) => onChange((next ?? "all") as EmailAccountFilter)}
      disabled={disabled}
    >
      <SelectTrigger className={className ?? "h-9 w-[240px]"}>
        <SelectValue placeholder="All accounts" />
      </SelectTrigger>
      <SelectContent>
        <SelectItem value="all">All</SelectItem>
        {addresses.map((address) => (
          <SelectItem key={address.email} value={address.email}>
            {address.email}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}
