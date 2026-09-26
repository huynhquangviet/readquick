import { describe, expect, it } from "vitest";

import { createActivityRecorder, type ActivityRecord } from "@/lib/reader/activity-recorder";
import { createFakeClock } from "@/lib/reader/fake-clock";
import { createReader } from "@/lib/reader/reader";

// 600 wpm shows a Word for 100ms, so time and Words are easy to count.
// A Sentence starts every 5 Words.
function setup({
  timeZone = "UTC",
  startsAtUtc = Date.UTC(2026, 8, 26, 12, 0),
  intervalMs,
}: { timeZone?: string; startsAtUtc?: number; intervalMs?: number } = {}) {
  const clock = createFakeClock();
  const words = Array.from({ length: 1000 }, (_, i) => `w${i}`);
  const sentenceStarts = Array.from({ length: 200 }, (_, i) => i * 5);
  const reader = createReader({ words, sentenceStarts, clock, speed: 600 });
  const records: ActivityRecord[] = [];
  const recorder = createActivityRecorder({
    reader,
    clock,
    // The wall clock, which is what a date comes from, moves with the fake one.
    wallNow: () => startsAtUtc + clock.now(),
    timeZone,
    intervalMs,
    record: (record) => {
      records.push(record);
    },
  });
  const total = (key: "seconds" | "wordsRead") => records.reduce((sum, r) => sum + r[key], 0);
  return { clock, reader, records, recorder, total };
}

describe("recording daily reading activity", () => {
  it("records the seconds played and Words read when the user pauses", () => {
    const { clock, reader, records } = setup();
    reader.play();
    clock.advance(950);
    reader.pause();

    expect(records).toHaveLength(1);
    expect(records[0].date).toBe("2026-09-26");
    expect(records[0].seconds).toBeCloseTo(0.95);
    expect(records[0].wordsRead).toBe(10);
  });
});

describe("what counts", () => {
  it("does not count paused time", () => {
    const { clock, reader, total } = setup();
    reader.play();
    clock.advance(500);
    reader.pause();
    clock.advance(60_000);
    reader.play();
    clock.advance(250);
    reader.pause();

    expect(total("seconds")).toBeCloseTo(0.75);
  });

  it("counts Words shown again after a Rewind", () => {
    const { clock, reader, total } = setup();
    reader.play();
    clock.advance(650); // Words 0 to 6 shown
    reader.rewind(); // back to the start of the Sentence at 5, which is shown again
    reader.pause();

    expect(total("wordsRead")).toBe(7 + 1);
  });

  it("does not count Words skipped with Forward", () => {
    const { reader, total } = setup();
    reader.play(); // Word 0
    reader.forward(); // on to Word 5, skipping 1 to 4
    reader.pause();

    expect(total("wordsRead")).toBe(2);
  });
});

describe("days", () => {
  it("keys the day by the user's own time zone", () => {
    // 18:30 UTC is already the 27th in Ho Chi Minh City.
    const { clock, reader, records } = setup({
      timeZone: "Asia/Ho_Chi_Minh",
      startsAtUtc: Date.UTC(2026, 8, 26, 18, 30),
    });
    reader.play();
    clock.advance(500);
    reader.pause();

    expect(records.map((r) => r.date)).toEqual(["2026-09-27"]);
  });

  it("puts reading either side of local midnight on the two days it happened on", () => {
    // 23:59:58 in Ho Chi Minh City.
    const { clock, reader, records, total } = setup({
      timeZone: "Asia/Ho_Chi_Minh",
      startsAtUtc: Date.UTC(2026, 8, 26, 16, 59, 58),
    });
    reader.play();
    clock.advance(4000);
    reader.pause();

    expect(records.map((r) => r.date)).toEqual(["2026-09-26", "2026-09-27"]);
    expect(records[0].seconds).toBeCloseTo(2, 0);
    expect(total("seconds")).toBeCloseTo(4);
    expect(total("wordsRead")).toBe(41);
  });
});

describe("when activity is sent", () => {
  it("sends every few seconds while playing, so little is lost if the tab closes", () => {
    // Off a multiple of the 100ms a Word is shown, so a send never falls on the instant a Word changes.
    const { clock, reader, records } = setup({ intervalMs: 5040 });
    reader.play();
    clock.advance(4900);
    expect(records).toEqual([]);
    clock.advance(200);
    expect(records).toHaveLength(1);
    expect(records[0].wordsRead).toBe(51);
    clock.advance(5000);
    expect(records).toHaveLength(2);
  });

  it("does not keep sending after the user pauses", () => {
    const { clock, reader, records } = setup({ intervalMs: 5000 });
    reader.play();
    clock.advance(1000);
    reader.pause();
    clock.advance(60_000);

    expect(records).toHaveLength(1);
  });

  it("sends what is left when stopped", () => {
    const { clock, reader, records, recorder } = setup();
    reader.play();
    clock.advance(300);
    recorder.stop();

    expect(records).toHaveLength(1);
    expect(records[0].wordsRead).toBe(4);
  });
});

describe("a send that fails", () => {
  it("is not lost: it goes out again with the next send", async () => {
    const clock = createFakeClock();
    const words = Array.from({ length: 1000 }, (_, i) => `w${i}`);
    const reader = createReader({ words, sentenceStarts: [0], clock, speed: 600 });
    const sent: ActivityRecord[] = [];
    let failing = true;
    createActivityRecorder({
      reader,
      clock,
      wallNow: () => Date.UTC(2026, 8, 26, 12, 0) + clock.now(),
      timeZone: "UTC",
      record: async (record) => {
        sent.push(record);
        if (failing) throw new Error("offline");
      },
    });

    reader.play();
    clock.advance(500);
    reader.pause(); // Words 0 to 5, 0.5s: fails
    await Promise.resolve();
    failing = false;
    reader.play();
    clock.advance(300);
    reader.pause();

    const last = sent.at(-1)!;
    expect(last.wordsRead).toBe(6 + 3); // then Words 6 to 8
    expect(last.seconds).toBeCloseTo(0.8);
  });

  it("is tried again later even if the user does not play again", async () => {
    const clock = createFakeClock();
    const words = Array.from({ length: 1000 }, (_, i) => `w${i}`);
    const reader = createReader({ words, sentenceStarts: [0], clock, speed: 600 });
    const sent: ActivityRecord[] = [];
    let failing = true;
    createActivityRecorder({
      reader,
      clock,
      wallNow: () => Date.UTC(2026, 8, 26, 12, 0) + clock.now(),
      timeZone: "UTC",
      intervalMs: 5000,
      record: async (record) => {
        sent.push(record);
        if (failing) throw new Error("offline");
      },
    });

    reader.play();
    clock.advance(500);
    reader.pause(); // the last thing the user does; the send fails
    await Promise.resolve();
    failing = false;
    clock.advance(5000);
    await Promise.resolve();

    expect(sent).toHaveLength(2);
    expect(sent[1].wordsRead).toBe(sent[0].wordsRead);
  });
});
