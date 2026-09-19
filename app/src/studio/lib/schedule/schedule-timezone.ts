import type { CmdDropdownOption } from "@/components/ui/cmd-dropdown";

const STORAGE_KEY = "relaybase.studio.scheduleTimeZone";

const FALLBACK_TIME_ZONES = [
  "UTC",
  "America/Los_Angeles",
  "America/Denver",
  "America/Chicago",
  "America/New_York",
  "America/Sao_Paulo",
  "Europe/London",
  "Europe/Paris",
  "Asia/Dubai",
  "Asia/Bangkok",
  "Asia/Singapore",
  "Asia/Tokyo",
  "Australia/Sydney",
] as const;

const WEEKDAY_INDEX: Record<string, number> = {
  Sun: 0,
  Mon: 1,
  Tue: 2,
  Wed: 3,
  Thu: 4,
  Fri: 5,
  Sat: 6,
};

export function browserTimeZone(): string {
  try {
    return Intl.DateTimeFormat().resolvedOptions().timeZone || "UTC";
  } catch {
    return "UTC";
  }
}

export function isValidTimeZone(timeZone: string): boolean {
  try {
    Intl.DateTimeFormat(undefined, { timeZone });
    return true;
  } catch {
    return false;
  }
}

export function readPersistedScheduleTimeZone(fallback = browserTimeZone()): string {
  if (typeof window === "undefined") return fallback;
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored && isValidTimeZone(stored)) return stored;
  } catch {
    /* ignore */
  }
  return fallback;
}

export function writePersistedScheduleTimeZone(timeZone: string): void {
  try {
    localStorage.setItem(STORAGE_KEY, timeZone);
  } catch {
    /* ignore */
  }
}

export function zonedDateParts(
  date: Date,
  timeZone: string,
): { year: number; month: number; day: number; weekday: number } {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone,
    year: "numeric",
    month: "numeric",
    day: "numeric",
    weekday: "short",
  }).formatToParts(date);

  const read = (type: Intl.DateTimeFormatPartTypes) =>
    Number(parts.find((p) => p.type === type)?.value);

  const weekdayStr = parts.find((p) => p.type === "weekday")?.value ?? "Sun";

  return {
    year: read("year") ?? date.getUTCFullYear(),
    month: read("month") ?? 1,
    day: read("day") ?? 1,
    weekday: WEEKDAY_INDEX[weekdayStr] ?? 0,
  };
}

export function dateKeyInTimeZone(date: Date, timeZone: string): string {
  const { year, month, day } = zonedDateParts(date, timeZone);
  return `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
}

export function gregorianDateKey(year: number, monthIndex: number, day: number): string {
  return `${year}-${String(monthIndex + 1).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
}

/** Weekday (0 = Sun) for a calendar date in the given IANA zone. */
export function weekdayOfGregorianDateInTimeZone(
  year: number,
  monthIndex: number,
  day: number,
  timeZone: string,
): number {
  for (let hour = -12; hour <= 36; hour++) {
    const candidate = new Date(Date.UTC(year, monthIndex, day, hour, 0, 0));
    const parts = zonedDateParts(candidate, timeZone);
    if (parts.year === year && parts.month === monthIndex + 1 && parts.day === day) {
      return parts.weekday;
    }
  }
  return new Date(year, monthIndex, day).getDay();
}

export function addGregorianDays(
  year: number,
  monthIndex: number,
  day: number,
  deltaDays: number,
): { year: number; monthIndex: number; day: number } {
  const d = new Date(year, monthIndex, day);
  d.setDate(d.getDate() + deltaDays);
  return { year: d.getFullYear(), monthIndex: d.getMonth(), day: d.getDate() };
}

function supportedTimeZones(): string[] {
  try {
    if (typeof Intl.supportedValuesOf === "function") {
      return Intl.supportedValuesOf("timeZone");
    }
  } catch {
    /* ignore */
  }
  return [...FALLBACK_TIME_ZONES];
}

function formatTimeZoneOffsetLabel(date: Date, timeZone: string): string {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone,
    timeZoneName: "shortOffset",
  }).formatToParts(date);
  return parts.find((p) => p.type === "timeZoneName")?.value ?? timeZone;
}

function formatTimeZoneCityLabel(timeZone: string): string {
  if (timeZone === "UTC") return "UTC";
  const tail = timeZone.split("/").pop();
  return tail ? tail.replace(/_/g, " ") : timeZone;
}

export function formatTimeZoneOptionLabel(timeZone: string, date = new Date()): string {
  const offset = formatTimeZoneOffsetLabel(date, timeZone);
  const city = formatTimeZoneCityLabel(timeZone);
  return `${offset} · ${city}`;
}

function offsetSortKey(date: Date, timeZone: string): string {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone,
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
    timeZoneName: "longOffset",
  }).formatToParts(date);
  const hour = parts.find((p) => p.type === "hour")?.value ?? "00";
  const minute = parts.find((p) => p.type === "minute")?.value ?? "00";
  const offsetName = parts.find((p) => p.type === "timeZoneName")?.value ?? "";
  return `${offsetName}-${hour}:${minute}-${timeZone}`;
}

export function buildScheduleTimeZoneOptions(
  localTimeZone: string,
  now = new Date(),
): CmdDropdownOption[] {
  const zones = supportedTimeZones();
  const sorted = [...zones].sort((a, b) => {
    const byOffset = offsetSortKey(now, a).localeCompare(offsetSortKey(now, b));
    if (byOffset !== 0) return byOffset;
    return a.localeCompare(b);
  });

  const options = sorted.map((timeZone) => ({
    value: timeZone,
    label: formatTimeZoneOptionLabel(timeZone, now),
    keywords: [timeZone, formatTimeZoneCityLabel(timeZone)].join(" "),
  }));

  const localIdx = options.findIndex((o) => o.value === localTimeZone);
  if (localIdx > 0) {
    const [local] = options.splice(localIdx, 1);
    local.label = `${local.label} (this device)`;
    options.unshift(local);
  } else if (localIdx === 0) {
    options[0] = {
      ...options[0],
      label: `${options[0].label} (this device)`,
    };
  }

  return options;
}

export function formatScheduleWhen(at: Date, timeZone: string): string {
  return at.toLocaleString(undefined, {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
    timeZone,
  });
}

export function formatScheduleEventTime(at: Date, timeZone: string): string {
  return at.toLocaleTimeString(undefined, {
    hour: "numeric",
    minute: "2-digit",
    timeZone,
  });
}
