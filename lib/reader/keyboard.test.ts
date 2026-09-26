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

  it("the up arrow makes Speed faster and the down arrow makes it slower", () => {
    expect(readerKeyAction("ArrowUp")).toBe("faster");
    expect(readerKeyAction("ArrowDown")).toBe("slower");
  });

  it("ignores every other key", () => {
    for (const key of ["a", "Enter", "Tab", "Escape"]) {
      expect(readerKeyAction(key)).toBeNull();
    }
  });
});
