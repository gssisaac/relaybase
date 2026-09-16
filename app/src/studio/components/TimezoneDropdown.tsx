"use client";

import { Globe } from "lucide-react";
import { useMemo } from "react";

import { CmdDropdown } from "@/components/ui/cmd-dropdown";
import { buildScheduleTimeZoneOptions } from "@/studio/lib/schedule-timezone";

type TimezoneDropdownProps = {
  value: string;
  deviceTimeZone: string;
  onValueChange: (timeZone: string) => void;
};

export function TimezoneDropdown({
  value,
  deviceTimeZone,
  onValueChange,
}: TimezoneDropdownProps) {
  const options = useMemo(
    () => buildScheduleTimeZoneOptions(deviceTimeZone),
    [deviceTimeZone],
  );

  return (
    <CmdDropdown
      triggerId="schedule-timezone"
      required
      value={value}
      placeholder="Time zone"
      searchPlaceholder="Search time zones…"
      options={options}
      triggerClassName="h-8 w-auto min-w-[11rem] max-w-[15rem]"
      contentAlign="end"
      contentClassName="min-w-[18rem] w-[min(22rem,calc(100vw-2rem))]"
      onValueChange={(next) => {
        if (next) onValueChange(next);
      }}
    >
      {({ selectedOptions }) => (
        <>
          <Globe className="size-4 shrink-0 text-muted-foreground" aria-hidden />
          <span className="min-w-0 truncate">
            {selectedOptions[0]?.label ?? "Time zone"}
          </span>
        </>
      )}
    </CmdDropdown>
  );
}
