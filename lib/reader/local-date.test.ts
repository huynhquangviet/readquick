import { describe, expect, it } from "vitest";

import { browserTimeZone, localDate } from "./local-date";

describe("localDate", () => {
  // 2026-09-26 18:30 UTC is already the 27th in Ho Chi Minh City (UTC+7).
  const instant = Date.UTC(2026, 8, 26, 18, 30);

  it("is the calendar date in the user's own time zone", () => {
    expect(localDate(instant, "Asia/Ho_Chi_Minh")).toBe("2026-09-27");
    expect(localDate(instant, "UTC")).toBe("2026-09-26");
    expect(localDate(instant, "America/Los_Angeles")).toBe("2026-09-26");
  });

  it("changes at local midnight, not UTC midnight", () => {
    const justBefore = Date.UTC(2026, 8, 26, 16, 59, 59);
    expect(localDate(justBefore, "Asia/Ho_Chi_Minh")).toBe("2026-09-26");
    expect(localDate(justBefore + 1000, "Asia/Ho_Chi_Minh")).toBe("2026-09-27");
  });
});

describe("browserTimeZone", () => {
  it("names a zone localDate can be given", () => {
    // Whatever the browser is in, it has to be a zone, not an empty string.
    expect(localDate(Date.UTC(2026, 8, 26, 12), browserTimeZone())).toMatch(
      /^\d{4}-\d{2}-\d{2}$/,
    );
  });
});
