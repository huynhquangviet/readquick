import { describe, expect, it } from "vitest";

import { lastReadLabel, percentRead } from "@/lib/library/summary";

describe("how far a Document has been read", () => {
  it("is 0% at the start and 100% at the last Word", () => {
    expect(percentRead(0, 101)).toBe(0);
    expect(percentRead(100, 101)).toBe(100);
    expect(percentRead(50, 101)).toBe(50);
  });

  it("only reaches 100% at the last Word", () => {
    expect(percentRead(998, 1000)).toBe(99);
    expect(percentRead(999, 1000)).toBe(100);
  });

  it("does not lose a percent to rounding error", () => {
    // 29 / 100 * 100 is 28.999999999999996 in floating point.
    expect(percentRead(29, 101)).toBe(29);
    expect(percentRead(57, 101)).toBe(57);
  });
});

describe("when a Document was last read", () => {
  const now = new Date("2026-09-26T12:00:00Z");
  const ago = (ms: number) => new Date(now.getTime() - ms);
  const MINUTE = 60_000;
  const HOUR = 60 * MINUTE;
  const DAY = 24 * HOUR;

  it("says so when the Document has not been read", () => {
    expect(lastReadLabel(null, now)).toBe("Not read yet");
  });

  it("is relative for the first week", () => {
    expect(lastReadLabel(ago(20_000), now)).toBe("Just now");
    expect(lastReadLabel(ago(MINUTE), now)).toBe("1 minute ago");
    expect(lastReadLabel(ago(45 * MINUTE), now)).toBe("45 minutes ago");
    expect(lastReadLabel(ago(HOUR), now)).toBe("1 hour ago");
    expect(lastReadLabel(ago(5 * HOUR), now)).toBe("5 hours ago");
    expect(lastReadLabel(ago(DAY), now)).toBe("Yesterday");
    expect(lastReadLabel(ago(3 * DAY), now)).toBe("3 days ago");
  });

  it("is the date after a week", () => {
    expect(lastReadLabel(new Date("2026-09-10T08:00:00Z"), now)).toBe("10 Sep 2026");
  });

  it("treats a time a little ahead of this device's clock as just now", () => {
    expect(lastReadLabel(new Date(now.getTime() + 30_000), now)).toBe("Just now");
  });
});
