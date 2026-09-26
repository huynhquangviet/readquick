/**
 * How far through a Document the Reading position is, as a whole percent, from
 * 0 (first Word) to 100 (last Word). Whole numbers all the way, so 29 of 100
 * steps is 29%, not 28.999….
 */
export function percentRead(position: number, wordCount: number): number {
  const lastIndex = wordCount - 1;
  if (lastIndex <= 0) return 0;
  return Math.floor((Math.min(Math.max(position, 0), lastIndex) * 100) / lastIndex);
}

const MINUTE_MS = 60_000;
const HOUR_MS = 60 * MINUTE_MS;
const DAY_MS = 24 * HOUR_MS;
const RELATIVE_FOR_DAYS = 7;
const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

function plural(count: number, unit: string) {
  return `${count} ${unit}${count === 1 ? "" : "s"} ago`;
}

/** When a Document was last read, for the Library: relative for a week, then a date. */
export function lastReadLabel(lastReadAt: Date | null, now: Date): string {
  if (!lastReadAt) return "Not read yet";
  // A time ahead of this clock is a device whose clock is a little off.
  const elapsed = Math.max(0, now.getTime() - lastReadAt.getTime());
  if (elapsed < MINUTE_MS) return "Just now";
  if (elapsed < HOUR_MS) return plural(Math.floor(elapsed / MINUTE_MS), "minute");
  if (elapsed < DAY_MS) return plural(Math.floor(elapsed / HOUR_MS), "hour");
  const days = Math.floor(elapsed / DAY_MS);
  if (days === 1) return "Yesterday";
  if (days < RELATIVE_FOR_DAYS) return plural(days, "day");
  return `${lastReadAt.getUTCDate()} ${MONTHS[lastReadAt.getUTCMonth()]} ${lastReadAt.getUTCFullYear()}`;
}
