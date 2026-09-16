"use client";

import { useCallback, useMemo, useState } from "react";

import {
  browserTimeZone,
  readPersistedScheduleTimeZone,
  writePersistedScheduleTimeZone,
} from "@/studio/lib/schedule-timezone";

export function usePersistedScheduleTimeZone() {
  const deviceTimeZone = useMemo(() => browserTimeZone(), []);
  const [timeZone, setTimeZoneState] = useState(() =>
    readPersistedScheduleTimeZone(deviceTimeZone),
  );

  const setTimeZone = useCallback((next: string) => {
    setTimeZoneState(next);
    writePersistedScheduleTimeZone(next);
  }, []);

  return { timeZone, setTimeZone, deviceTimeZone };
}
