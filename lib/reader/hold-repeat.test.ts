import { describe, expect, it } from "vitest";

import { createFakeClock } from "@/lib/reader/fake-clock";
import { createHoldRepeat } from "@/lib/reader/hold-repeat";

function setup() {
  const clock = createFakeClock();
  let calls = 0;
  const hold = createHoldRepeat({ action: () => calls++, clock });
  return { clock, hold, calls: () => calls };
}

describe("hold to repeat", () => {
  it("acts once on press, so a tap moves exactly once", () => {
    const { clock, hold, calls } = setup();
    hold.start();
    expect(calls()).toBe(1);
    clock.advance(100);
    hold.stop();
    clock.advance(1000);
    expect(calls()).toBe(1);
  });

  it("keeps acting after a delay while held, then at a steady interval", () => {
    const { clock, hold, calls } = setup();
    hold.start();
    clock.advance(399);
    expect(calls()).toBe(1);
    clock.advance(1);
    expect(calls()).toBe(2);
    clock.advance(150);
    expect(calls()).toBe(3);
    clock.advance(300);
    expect(calls()).toBe(5);
  });

  it("stops acting on release", () => {
    const { clock, hold, calls } = setup();
    hold.start();
    clock.advance(700);
    const before = calls();
    hold.stop();
    clock.advance(2000);
    expect(calls()).toBe(before);
  });

  it("does not double up when pressed again while already held", () => {
    const { clock, hold, calls } = setup();
    hold.start();
    hold.start();
    expect(calls()).toBe(1);
    clock.advance(400 + 150);
    expect(calls()).toBe(3);
  });

  it("can be held again after a release", () => {
    const { clock, hold, calls } = setup();
    hold.start();
    hold.stop();
    hold.start();
    expect(calls()).toBe(2);
    clock.advance(400);
    expect(calls()).toBe(3);
  });
});
