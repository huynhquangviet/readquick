import { describe, expect, it } from "vitest";

import { toReaderInput } from "./stored-document";

describe("toReaderInput", () => {
  it("gives back the Words of a stored body, in order, with the stored Sentence starts", () => {
    const input = toReaderInput({
      body: "Xin chào bạn. Hôm nay đẹp",
      sentence_starts: [0, 3],
    });

    expect(input).toEqual({
      words: ["Xin", "chào", "bạn.", "Hôm", "nay", "đẹp"],
      sentenceStarts: [0, 3],
    });
  });
});
