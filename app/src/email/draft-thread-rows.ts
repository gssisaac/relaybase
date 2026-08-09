function pad2(n: number) {
  return n < 10 ? `0${n}` : String(n);
}

const WEEKDAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"] as const;

/** Gmail-style draft row attribution: `On Sun, Aug 9, 2026 at 3:56 PM <a@b.com>`. */
export function formatDraftAttribution(iso: string, email: string) {
  const date = new Date(iso);
  const addr = email.trim();
  if (Number.isNaN(date.getTime())) {
    return addr ? `On ${iso} <${addr}>` : `On ${iso}`;
  }
  const months = [
    "Jan",
    "Feb",
    "Mar",
    "Apr",
    "May",
    "Jun",
    "Jul",
    "Aug",
    "Sep",
    "Oct",
    "Nov",
    "Dec",
  ];
  const hours = date.getHours();
  const minutes = pad2(date.getMinutes());
  const hour12 = hours % 12 || 12;
  const ampm = hours < 12 ? "AM" : "PM";
  const when = `${WEEKDAYS[date.getDay()]}, ${months[date.getMonth()]} ${date.getDate()}, ${date.getFullYear()} at ${hour12}:${minutes} ${ampm}`;
  return addr ? `On ${when} <${addr}>` : `On ${when}`;
}

/**
 * Subtitle under the coral "Draft" label — prefer the quote header in the body,
 * else build attribution from the parent message.
 */
export function draftThreadRowSubtitle(
  body: string,
  parent?: { at: string; email: string } | null,
): string {
  const match = /On [\s\S]+?(?:\nwrote:| wrote:)/.exec(body);
  if (match) {
    return match[0]
      .replace(/\s*\nwrote:\s*$/i, "")
      .replace(/\s+wrote:\s*$/i, "")
      .replace(/\s+/g, " ")
      .trim();
  }
  if (parent?.at) {
    return formatDraftAttribution(parent.at, parent.email);
  }
  return "";
}
