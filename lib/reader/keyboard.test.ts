import { describe, expect, it } from "vitest";

import { readerKeyAction } from "@/lib/reader/keyboard";

describe("reader keyboard controls", () => {
  it("Space pauses and plays", () => {
    expect(readerKeyAction(" ")).toBe("toggle");
  });

  it("the left arrow is Rewind and the right arrow is Forward", () => {
    expect(readerKeyAction("ArrowLeft")).toBe("rewind");
    expect(readerKeyAction("ArrowRight")).toBe("forward");
  });

  it("ignores every other key", () => {
    for (const key of ["a", "Enter", "ArrowUp", "ArrowDown", "Tab", "Escape"]) {
      expect(readerKeyAction(key)).toBeNull();
    }
  });
});
