"use client";

import { useEffect, useState } from "react";

import { browserTimeZone, localDate } from "@/lib/reader/local-date";
import { streak, type ActivityRow } from "@/lib/stats/stats";

/**
 * The Streak, counted in the user's own days. Only the browser knows the user's
 * time zone, so the day it is counted back from is read once the page is
 * running; the server's day would be someone else's. A dash stands in until
 * then, so the row does not change height.
 */
export function ReadingStreak({ rows }: { rows: ActivityRow[] }) {
  const [today, setToday] = useState<string>();

  useEffect(() => {
    setToday(localDate(Date.now(), browserTimeZone()));
  }, []);

  if (today === undefined) return <span aria-hidden>—</span>;

  const days = streak(rows, today);
  // Nothing read for a minute in a row yet: no Streak to count.
  if (days === 0) return <>None yet</>;
  return <>{`${days} ${days === 1 ? "day" : "days"}`}</>;
}
