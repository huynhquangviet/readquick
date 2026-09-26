/**
 * The user's IANA time zone, as the browser has it. Reading days are the user's
 * own days, so every date this app names is named in this zone.
 */
export function browserTimeZone(): string {
  return Intl.DateTimeFormat().resolvedOptions().timeZone;
}

/** The calendar date (YYYY-MM-DD) at an instant, in the given IANA time zone. */
export function localDate(instantMs: number, timeZone: string): string {
  // The "en-CA" locale writes dates as YYYY-MM-DD.
  return new Intl.DateTimeFormat("en-CA", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(instantMs);
}
