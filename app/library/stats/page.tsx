import Link from "next/link";
import { Suspense } from "react";

import { ReadingStreak } from "@/components/reading-streak";
import { readingTotals, type ActivityRow } from "@/lib/stats/stats";
import { createClient } from "@/lib/supabase/server";

/** One figure on the Stats page: what it is, and what it comes to. */
function Stat({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-1 rounded-lg border p-4">
      <dt className="text-sm text-muted-foreground">{label}</dt>
      <dd className="font-semibold text-2xl tabular-nums">{children}</dd>
    </div>
  );
}

async function Stats() {
  // Row-level security means only the signed-in user's days come back.
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("reading_activity")
    .select("day, seconds_played, words_read")
    .order("day");

  // A failed load must not look like a user who has read nothing.
  if (error || !data) {
    return (
      <p role="alert" className="text-sm text-destructive">
        Your Stats could not be loaded. Please try again.
      </p>
    );
  }

  const rows: ActivityRow[] = data.map((row) => ({
    day: row.day,
    secondsPlayed: row.seconds_played,
    wordsRead: row.words_read,
  }));
  const totals = readingTotals(rows);

  return (
    <dl className="grid grid-cols-2 gap-4 sm:grid-cols-3">
      <Stat label="Words read">{totals.wordsRead.toLocaleString("en-US")}</Stat>
      <Stat label="Reading speed">{`${totals.speed} wpm`}</Stat>
      <Stat label="Streak">
        <ReadingStreak rows={rows} />
      </Stat>
    </dl>
  );
}

export default function StatsPage() {
  return (
    <div className="flex flex-col gap-4">
      <Link href="/library" className="text-sm text-muted-foreground hover:underline">
        ← Library
      </Link>
      <h1 className="font-bold text-2xl">Stats</h1>
      <Suspense fallback={<p className="text-sm text-muted-foreground">Loading…</p>}>
        <Stats />
      </Suspense>
    </div>
  );
}
