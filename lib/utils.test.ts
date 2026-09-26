import { describe, expect, it } from "vitest";

import { cn } from "@/lib/utils";

describe("cn", () => {
  it("merges class names, letting later Tailwind classes win", () => {
    expect(cn("px-2", "px-4", false, "font-bold")).toBe("px-4 font-bold");
  });
});
