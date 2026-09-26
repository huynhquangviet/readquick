import { describe, expect, it } from "vitest";

import { positionAt, progressOf } from "@/lib/reader/progress";

describe("progress through a Document", () => {
  it("is 0 at the first Word and 1 at the last", () => {
    expect(progressOf(0, 101)).toBe(0);
    expect(progressOf(100, 101)).toBe(1);
  });

  it("is how far the current Word is between the first and the last", () => {
    expect(progressOf(50, 101)).toBe(0.5);
    expect(progressOf(25, 101)).toBe(0.25);
  });

  it("is 0 for a one-Word Document, with nowhere to go", () => {
    expect(progressOf(0, 1)).toBe(0);
    expect(positionAt(0.7, 1)).toBe(0);
  });

  it("puts the start of the bar on the first Word and the end on the last", () => {
    expect(positionAt(0, 101)).toBe(0);
    expect(positionAt(1, 101)).toBe(100);
  });

  it("maps a point on the bar to the nearest Word", () => {
    expect(positionAt(0.5, 101)).toBe(50);
    expect(positionAt(0.504, 101)).toBe(50);
    expect(positionAt(0.506, 101)).toBe(51);
  });

  it("stays inside the Document when dragged past either end", () => {
    expect(positionAt(-0.2, 101)).toBe(0);
    expect(positionAt(1.4, 101)).toBe(100);
  });

  it("lands back on the same Word after a round trip, in a long Document", () => {
    for (const index of [0, 1, 4999, 31337, 99999]) {
      expect(positionAt(progressOf(index, 100000), 100000)).toBe(index);
    }
  });
});
