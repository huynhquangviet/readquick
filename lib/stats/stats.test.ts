import { describe, expect, it } from "vitest";

import { readingTotals, streak, type ActivityRow } from "@/lib/stats/stats";

function row(day: string, secondsPlayed: number, wordsRead: number): ActivityRow {
  return { day, secondsPlayed, wordsRead };
}

describe("total Words read and Reading speed", () => {
  it("is zeros for a user who has not read anything", () => {
    expect(readingTotals([])).toEqual({ wordsRead: 0, speed: 0 });
  });

  it("adds up every day", () => {
    // 300 + 500 Words in 120 + 60 seconds: 800 Words in three minutes.
    const totals = readingTotals([
      row("2026-09-24", 120, 300),
      row("2026-09-25", 60, 500),
    ]);
    expect(totals.wordsRead).toBe(800);
    expect(totals.speed).toBe(267);
  });
});

describe("the Streak", () => {
  const today = "2026-09-26";

  it("is nothing for a user who has not read anything", () => {
    expect(streak([], today)).toBe(0);
  });

  it("counts today once a minute has been played", () => {
    expect(streak([row(today, 60, 250)], today)).toBe(1);
  });

  it("counts the days before it that were read", () => {
    expect(
      streak(
        [
          row("2026-09-24", 900, 3000),
          row("2026-09-25", 600, 2000),
          row("2026-09-26", 300, 1000),
        ],
        today,
      ),
    ).toBe(3);
  });

  it("holds while today has not been read yet", () => {
    // The day is not over, so yesterday's Streak is still the user's.
    expect(streak([row("2026-09-24", 300, 1000), row("2026-09-25", 300, 1000)], today)).toBe(2);
  });

  it("is gone once a whole day has been missed", () => {
    expect(streak([row("2026-09-23", 300, 1000), row("2026-09-24", 300, 1000)], today)).toBe(0);
  });

  it("stops counting back at a day that was not read", () => {
    expect(
      streak(
        [
          row("2026-09-22", 300, 1000),
          row("2026-09-23", 300, 1000),
          // Nothing on the 24th.
          row("2026-09-25", 300, 1000),
          row("2026-09-26", 300, 1000),
        ],
        today,
      ),
    ).toBe(2);
  });

  it("leaves out a day played for less than a minute", () => {
    expect(streak([row("2026-09-25", 59, 250), row("2026-09-26", 300, 1000)], today)).toBe(1);
  });

  it("counts across the end of a month", () => {
    expect(
      streak(
        [
          row("2026-09-29", 300, 1000),
          row("2026-09-30", 300, 1000),
          row("2026-10-01", 300, 1000),
        ],
        "2026-10-01",
      ),
    ).toBe(3);
  });
});
