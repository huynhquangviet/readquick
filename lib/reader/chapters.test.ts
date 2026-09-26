import { describe, expect, it } from "vitest";

import { currentChapter, parseChapters } from "./chapters";

describe("parseChapters", () => {
  it("gives back the stored Chapters, in reading order", () => {
    const stored = [
      { title: "Two", wordIndex: 40 },
      { title: "One", wordIndex: 0 },
    ];

    expect(parseChapters(stored, 100)).toEqual([
      { title: "One", wordIndex: 0 },
      { title: "Two", wordIndex: 40 },
    ]);
  });

  it("gives no Chapters for a Document without any, so there is no list to show", () => {
    expect(parseChapters([], 100)).toEqual([]);
    expect(parseChapters(null, 100)).toEqual([]);
  });

  it("leaves out entries that cannot be jumped to", () => {
    const stored = [
      { title: "Fine", wordIndex: 5 },
      { title: "Past the end", wordIndex: 100 },
      { title: "Negative", wordIndex: -1 },
      { title: "Fraction", wordIndex: 2.5 },
      { title: "  ", wordIndex: 7 },
      { wordIndex: 9 },
      { title: "No index" },
      "junk",
      null,
    ];

    expect(parseChapters(stored, 100)).toEqual([{ title: "Fine", wordIndex: 5 }]);
  });
});

describe("currentChapter", () => {
  const chapters = [
    { title: "One", wordIndex: 10 },
    { title: "Two", wordIndex: 50 },
  ];

  it("is the Chapter the Reading position is in", () => {
    expect(currentChapter(chapters, 10)?.title).toBe("One");
    expect(currentChapter(chapters, 49)?.title).toBe("One");
    expect(currentChapter(chapters, 50)?.title).toBe("Two");
    expect(currentChapter(chapters, 900)?.title).toBe("Two");
  });

  it("is none before the first Chapter starts", () => {
    expect(currentChapter(chapters, 3)).toBeUndefined();
    expect(currentChapter([], 3)).toBeUndefined();
  });
});
