import { describe, expect, it } from "vitest";

import { createFakeClock } from "@/lib/reader/fake-clock";
import { createPositionSaver } from "@/lib/reader/position-saver";
import { createReader } from "@/lib/reader/reader";

// 600 wpm shows a Word for 100ms, so time and Words are easy to count.
function setup({ position = 0, intervalMs = 5000 } = {}) {
  const clock = createFakeClock();
  const words = Array.from({ length: 1000 }, (_, i) => `w${i}`);
  const reader = createReader({ words, sentenceStarts: [0], clock, speed: 600, position });
  const saved: number[] = [];
  const saver = createPositionSaver({
    reader,
    clock,
    intervalMs,
    save: (position) => {
      saved.push(position);
    },
  });
  return { clock, reader, saved, saver };
}

describe("saving the Reading position", () => {
  it("saves the Reading position when the user pauses", () => {
    const { clock, reader, saved } = setup();
    reader.play();
    clock.advance(350);
    reader.pause();
    expect(saved).toEqual([reader.position]);
    expect(reader.position).toBeGreaterThan(0);
  });

  it("saves every few seconds while playing, so little is lost if the tab closes", () => {
    // Off a multiple of the 100ms a Word is shown, so a save never falls on the instant a Word changes.
    const { clock, reader, saved } = setup({ intervalMs: 5040 });
    reader.play();
    clock.advance(4900);
    expect(saved).toEqual([]);
    clock.advance(200);
    expect(saved).toEqual([50]);
    clock.advance(5000);
    expect(saved).toEqual([50, 100]);
  });

  it("does not keep saving after the user pauses", () => {
    const { clock, reader, saved } = setup({ intervalMs: 5000 });
    reader.play();
    clock.advance(1000);
    reader.pause();
    clock.advance(60_000);
    expect(saved).toEqual([10]);
  });

  it("does not save a position that is already saved", () => {
    const { clock, reader, saved } = setup({ position: 40 });
    // Playing and pausing on the same Word changes nothing.
    reader.play();
    clock.advance(50);
    reader.pause();
    expect(saved).toEqual([]);

    reader.play();
    clock.advance(250);
    reader.pause();
    expect(saved).toEqual([43]);
    reader.play();
    reader.pause();
    expect(saved).toEqual([43]);
  });

  it("tries again after a save fails", async () => {
    const clock = createFakeClock();
    const words = Array.from({ length: 1000 }, (_, i) => `w${i}`);
    const reader = createReader({ words, sentenceStarts: [0], clock, speed: 600 });
    const attempts: number[] = [];
    createPositionSaver({
      reader,
      clock,
      intervalMs: 5040,
      save: async (position) => {
        attempts.push(position);
        if (attempts.length === 1) throw new Error("offline");
      },
    });

    reader.play();
    clock.advance(1000);
    reader.pause();
    await Promise.resolve();
    reader.play();
    reader.pause();
    expect(attempts).toEqual([10, 10]);
  });

  it("stops saving once stopped", () => {
    const { clock, reader, saved, saver } = setup({ intervalMs: 5040 });
    reader.play();
    clock.advance(1000);
    saver.stop();
    // Stopping saved where the user had got to; nothing follows it.
    expect(saved).toEqual([10]);
    clock.advance(20_000);
    reader.pause();
    expect(saved).toEqual([10]);
  });

  it("saves a move made while paused, such as dragging the bar or Rewind", () => {
    const { clock, reader, saved } = setup();
    reader.seek(300);
    reader.seek(310);
    // A drag makes many moves; one save follows once it settles.
    clock.advance(400);
    expect(saved).toEqual([]);
    clock.advance(1000);
    expect(saved).toEqual([310]);
  });

  it("saves a move that has not been saved yet when stopped, so leaving the page loses nothing", () => {
    const { reader, saved, saver } = setup();
    reader.seek(120);
    saver.stop();
    expect(saved).toEqual([120]);
  });
});
