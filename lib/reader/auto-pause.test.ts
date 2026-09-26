import { describe, expect, it } from "vitest";

import { pauseWhenHidden, type VisibilitySource } from "@/lib/reader/auto-pause";
import { createFakeClock } from "@/lib/reader/fake-clock";
import { createReader } from "@/lib/reader/reader";

// A stand-in for `document`: hidden or shown, and a way to say so.
function fakeTab() {
  const listeners = new Set<() => void>();
  const tab = {
    hidden: false as boolean,
    addEventListener: (_: "visibilitychange", listener: () => void) => listeners.add(listener),
    removeEventListener: (_: "visibilitychange", listener: () => void) => listeners.delete(listener),
    setHidden(hidden: boolean) {
      tab.hidden = hidden;
      for (const listener of [...listeners]) listener();
    },
  } satisfies VisibilitySource & { setHidden(hidden: boolean): void };
  return tab;
}

function setup() {
  const clock = createFakeClock();
  const words = Array.from({ length: 100 }, (_, i) => `w${i}`);
  const reader = createReader({ words, sentenceStarts: [0], clock, speed: 600 });
  const tab = fakeTab();
  const stop = pauseWhenHidden(reader, tab);
  return { clock, reader, tab, stop };
}

describe("pausing when the tab is hidden", () => {
  it("pauses a playing Reader when the tab is hidden", () => {
    const { clock, reader, tab } = setup();
    reader.play();
    clock.advance(300);
    tab.setHidden(true);

    expect(reader.playing).toBe(false);
    const stoppedAt = reader.position;
    clock.advance(10_000);
    expect(reader.position).toBe(stoppedAt);
  });

  it("does not start playing again when the tab is shown", () => {
    const { reader, tab } = setup();
    reader.play();
    tab.setHidden(true);
    tab.setHidden(false);

    expect(reader.playing).toBe(false);
  });

  it("leaves a paused Reader alone", () => {
    const { reader, tab } = setup();
    tab.setHidden(true);

    expect(reader.playing).toBe(false);
    expect(reader.position).toBe(0);
  });

  it("stops listening once stopped", () => {
    const { reader, tab, stop } = setup();
    stop();
    reader.play();
    tab.setHidden(true);

    expect(reader.playing).toBe(true);
  });
});
