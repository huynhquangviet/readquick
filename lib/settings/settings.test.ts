import { describe, expect, it } from "vitest";

import { DEFAULT_SETTINGS, parseSettings, stepSpeed } from "@/lib/settings/settings";

describe("settings", () => {
  it("a user with no saved settings gets the defaults", () => {
    expect(parseSettings(null)).toEqual({ speed: 250, fontSize: 3, theme: "system" });
    expect(parseSettings(undefined)).toEqual(DEFAULT_SETTINGS);
  });

  it("keeps what the user saved", () => {
    expect(parseSettings({ speed: 400, fontSize: 4, theme: "dark" })).toEqual({
      speed: 400,
      fontSize: 4,
      theme: "dark",
    });
  });

  it("brings a Speed and font size outside their range back inside it", () => {
    expect(parseSettings({ speed: 50 }).speed).toBe(100);
    expect(parseSettings({ speed: 5000 }).speed).toBe(800);
    expect(parseSettings({ fontSize: 0.5 }).fontSize).toBe(2);
    expect(parseSettings({ fontSize: 40 }).fontSize).toBe(5);
  });

  it("replaces a value that is not usable with its default, one field at a time", () => {
    expect(parseSettings({ speed: "fast", fontSize: NaN, theme: "purple" })).toEqual(DEFAULT_SETTINGS);
    expect(parseSettings({ speed: 300, theme: 7 })).toEqual({ ...DEFAULT_SETTINGS, speed: 300 });
  });

  it("an arrow key moves Speed by 25 words per minute", () => {
    expect(stepSpeed(250, "faster")).toBe(275);
    expect(stepSpeed(250, "slower")).toBe(225);
  });

  it("Speed stops at 100 and 800", () => {
    expect(stepSpeed(800, "faster")).toBe(800);
    expect(stepSpeed(790, "faster")).toBe(800);
    expect(stepSpeed(100, "slower")).toBe(100);
    expect(stepSpeed(110, "slower")).toBe(100);
  });
});
