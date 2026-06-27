import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

export function formatRelativeDate(date: Date | string): string {
  const then = typeof date === "string" ? new Date(date) : date;
  const diffMs = then.getTime() - Date.now();
  const rtf = new Intl.RelativeTimeFormat("en", { numeric: "auto" });

  const units: [number, Intl.RelativeTimeFormatUnit][] = [
    [60, "second"],
    [60, "minute"],
    [24, "hour"],
    [30, "day"],
    [12, "month"],
  ];

  let value = diffMs / 1000;
  for (const [amount, unit] of units) {
    if (Math.abs(value) < amount) {
      return rtf.format(Math.round(value), unit);
    }
    value /= amount;
  }

  return rtf.format(Math.round(value), "year");
}
