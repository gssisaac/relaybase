"use client";

import { AlertTriangle } from "lucide-react";

import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

import type { Address } from "@/email/components/mailbox/types";
import { useSendingHealth } from "@/lib/dashboard/SendingHealthContext";

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
  const sendingHealth = useSendingHealth();
  return (
    <Select
      value={value}
      onValueChange={(next) => onChange((next ?? "all") as EmailAccountFilter)}
      disabled={disabled}
    >
      <SelectTrigger className={className ?? "h-9 w-[280px]"}>
        <SelectValue placeholder="All accounts" />
      </SelectTrigger>
      <SelectContent>
        <SelectItem value="all">All</SelectItem>
        {addresses.map((address) => {
          const sending = sendingHealth.statusForEmail(address.email);
          return (
            <SelectItem key={address.email} value={address.email}>
              <span className="flex min-w-0 items-center gap-1.5">
                <span className="truncate">{address.email}</span>
                {sending &&
                (sending.status === "restricted" ||
                  sending.status === "no_zone") ? (
                  <AlertTriangle
                    className="size-3 shrink-0 text-amber-600 dark:text-amber-400"
                    aria-label="Sending restriction"
                  />
                ) : null}
              </span>
            </SelectItem>
          );
        })}
      </SelectContent>
    </Select>
  );
}
