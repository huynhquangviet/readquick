/** One day of reading activity, as stored in `reading_activity`. */
export interface ActivityRow {
  /** The user's local date, YYYY-MM-DD. */
  day: string;
  secondsPlayed: number;
  wordsRead: number;
}

/** What the Stats page shows for the whole of a user's reading. */
export interface ReadingTotals {
  wordsRead: number;
  /** Reading speed in Words per minute: Words read divided by time spent playing. */
  speed: number;
}

/** A day counts toward the Streak once this much time has been played on it. */
const MIN_STREAK_SECONDS = 60;

const SECONDS_PER_MINUTE = 60;
const DAY_MS = 24 * 60 * 60 * 1000;

/** Total Words read over every day, and the Reading speed that goes with it. */
export function readingTotals(rows: ActivityRow[]): ReadingTotals {
  const wordsRead = rows.reduce((total, row) => total + row.wordsRead, 0);
  const secondsPlayed = rows.reduce((total, row) => total + row.secondsPlayed, 0);
  // Nothing has been played yet: no seconds to divide by, and nothing read.
  const speed =
    secondsPlayed > 0
      ? Math.round(wordsRead / (secondsPlayed / SECONDS_PER_MINUTE))
      : 0;
  return { wordsRead, speed };
}

/**
 * A local date as a whole number of days, so the day before one is one less.
 * From the parts, in UTC: a calendar day, with no time zone's clock changes in it.
 */
function dayNumber(day: string): number {
  const [year, month, date] = day.split("-").map(Number);
  return Date.UTC(year, month - 1, date) / DAY_MS;
}

/**
 * The Streak in whole days: how many days in a row, ending at today, each of
 * which was played for at least a minute. `today` is the user's own local date,
 * so the days counted are the user's own days.
 */
export function streak(rows: ActivityRow[], today: string): number {
  const read = new Set(
    rows
      .filter((row) => row.secondsPlayed >= MIN_STREAK_SECONDS)
      .map((row) => dayNumber(row.day)),
  );
  const dayToday = dayNumber(today);
  // Today is not over, so a Streak that reaches yesterday is still alive: the
  // count starts from today when it has been read, and from yesterday when it
  // has not.
  let day = read.has(dayToday) ? dayToday : dayToday - 1;
  let days = 0;
  while (read.has(day)) {
    days += 1;
    day -= 1;
  }
  return days;
}
