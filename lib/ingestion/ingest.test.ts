import { describe, expect, it } from "vitest";

import { ingest } from "./ingest";

function txt(text: string, filename = "notes.txt") {
  return ingest({ bytes: new TextEncoder().encode(text), filename });
}

function readable(text: string, filename?: string) {
  const result = txt(text, filename);
  if (!result.ok) throw new Error(`expected a readable Document, got ${result.reason}`);
  return result.document;
}

/** The Sentences of a Document, as the Words between consecutive Sentence starts. */
function sentences(text: string) {
  const { words, sentenceStarts } = readable(text);
  return sentenceStarts.map((start, i) =>
    words.slice(start, sentenceStarts[i + 1] ?? words.length).join(" "),
  );
}

describe("a TXT Document", () => {
  it("takes its title from the file name", () => {
    expect(readable("Hello there.", "The Old Man and the Sea.txt").title).toBe(
      "The Old Man and the Sea",
    );
    expect(readable("Hello there.", "notes.TXT").title).toBe("notes");
  });

  it("falls back to a placeholder title when the file name is blank", () => {
    expect(readable("Hello there.", "  .txt").title).toBe("Untitled");
  });

  it("reports its format in lower case", () => {
    expect(readable("Hello there.", "NOTES.TXT").format).toBe("txt");
  });

  it("has no Chapters", () => {
    expect(readable("Hello there.").chapters).toEqual([]);
  });

  it("cuts English text into Words on whitespace", () => {
    expect(readable("The quick brown fox.").words).toEqual(["The", "quick", "brown", "fox."]);
  });

  it("makes each Vietnamese syllable its own Word", () => {
    expect(readable("Sinh viên đang đọc sách.").words).toEqual([
      "Sinh",
      "viên",
      "đang",
      "đọc",
      "sách.",
    ]);
  });

  it("cuts on any run of whitespace, however the lines are broken", () => {
    const text = "one  two\tthree\r\nfour\n\n\nfive six 　seven\n";
    expect(readable(text).words).toEqual(["one", "two", "three", "four", "five", "six", "seven"]);
  });

  it("ignores a byte order mark", () => {
    const bytes = new Uint8Array([0xef, 0xbb, 0xbf, ...new TextEncoder().encode("Hello there.")]);
    const result = ingest({ bytes, filename: "notes.txt" });
    expect(result.ok && result.document.words).toEqual(["Hello", "there."]);
  });
});

describe("Sentence detection", () => {
  it("starts a Sentence at the first Word and after each Word ending in terminal punctuation", () => {
    const { sentenceStarts } = readable("One two. Three four! Five six? Seven");
    expect(sentenceStarts).toEqual([0, 2, 4, 6]);
  });

  it("ends a Sentence on an ellipsis", () => {
    expect(sentences("Well… maybe so... Yes")).toEqual(["Well…", "maybe so...", "Yes"]);
  });

  it("looks past closing quotes and brackets to the terminal punctuation", () => {
    expect(sentences("“Go home.” She left (quietly.) Then nothing")).toEqual([
      "“Go home.”",
      "She left (quietly.)",
      "Then nothing",
    ]);
  });

  it("does not end a Sentence in the middle of a number or a name with a dot", () => {
    expect(sentences("Pi is 3.14 or so. www.example.com is a site.")).toEqual([
      "Pi is 3.14 or so.",
      "www.example.com is a site.",
    ]);
  });

  it("does not end a Sentence on common English abbreviations or initials", () => {
    expect(sentences("Mr. Smith met Dr. J. R. Jones. They talked, e.g. about tea.")).toEqual([
      "Mr. Smith met Dr. J. R. Jones.",
      "They talked, e.g. about tea.",
    ]);
  });

  it("does not end a Sentence on common Vietnamese abbreviations", () => {
    expect(sentences("GS. Nguyễn ở TP. Hồ Chí Minh. Ông ấy đi làm.")).toEqual([
      "GS. Nguyễn ở TP. Hồ Chí Minh.",
      "Ông ấy đi làm.",
    ]);
  });

  it("makes a Document without terminal punctuation one Sentence", () => {
    expect(readable("no full stops in here at all").sentenceStarts).toEqual([0]);
  });

  it("does not start an empty Sentence after a final full stop", () => {
    expect(readable("Only one.").sentenceStarts).toEqual([0]);
  });
});

describe("refusals", () => {
  const FIVE_MB = 5 * 1024 * 1024;

  it("refuses a file over 5MB as too large", () => {
    const result = ingest({ bytes: new Uint8Array(FIVE_MB + 1).fill(97), filename: "big.txt" });
    expect(result).toMatchObject({ ok: false, reason: "too-large" });
    expect(!result.ok && result.message).toMatch(/too large/i);
    expect(!result.ok && result.message).toContain("5MB");
  });

  it("accepts a file of exactly 5MB", () => {
    const result = ingest({ bytes: new Uint8Array(FIVE_MB).fill(97), filename: "big.txt" });
    expect(result.ok).toBe(true);
  });

  it("says a file is too large even when its format is unsupported", () => {
    const result = ingest({ bytes: new Uint8Array(FIVE_MB + 1), filename: "big.docx" });
    expect(result).toMatchObject({ ok: false, reason: "too-large" });
  });

  it.each(["report.docx", "photo.png", "archive", "notes.txt.zip", ".txt"])(
    "refuses %s as an unsupported format, listing the supported formats",
    (filename) => {
      const result = txt("Hello there.", filename);
      expect(result).toMatchObject({ ok: false, reason: "unsupported-format" });
      expect(!result.ok && result.message).toMatch(/not supported/i);
      expect(!result.ok && result.message).toContain("TXT");
    },
  );

  it.each([
    { what: "an empty file", bytes: new Uint8Array() },
    { what: "a file of only whitespace", bytes: new TextEncoder().encode(" \n\t \r\n ") },
    { what: "a file that is not valid text", bytes: new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0xff, 0xfe]) },
    { what: "a binary file with null bytes", bytes: new Uint8Array([0x68, 0x69, 0x00, 0x00, 0x21]) },
  ])("refuses $what as could not be read", ({ bytes }) => {
    const result = ingest({ bytes, filename: "notes.txt" });
    expect(result).toMatchObject({ ok: false, reason: "corrupt" });
    expect(!result.ok && result.message).toMatch(/could not be read/i);
  });
});
