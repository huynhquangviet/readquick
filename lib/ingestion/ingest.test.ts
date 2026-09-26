import { strToU8, zipSync } from "fflate";
import { describe, expect, it } from "vitest";

import { epub, type FixtureOptions } from "./epub-fixture";
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

  it("still sees an abbreviation behind an opening bracket or quote", () => {
    expect(sentences("He met (Mr. Lee) and “Dr. Kim” today. Then left")).toEqual([
      "He met (Mr. Lee) and “Dr. Kim” today.",
      "Then left",
    ]);
  });

  it("does not end a Sentence on a dotted abbreviation such as Ph.D. or e.g.", () => {
    expect(sentences("She has a Ph.D. in physics, e.g. optics. Wow")).toEqual([
      "She has a Ph.D. in physics, e.g. optics.",
      "Wow",
    ]);
  });

  it("still ends a Sentence on a short ordinary Word", () => {
    expect(sentences("Say no. Go on. Do it")).toEqual(["Say no.", "Go on.", "Do it"]);
  });

  it("ends a Sentence on a lone lower-case letter, such as a Vietnamese particle", () => {
    expect(sentences("Vâng ạ. Thế à. Ừ")).toEqual(["Vâng ạ.", "Thế à.", "Ừ"]);
  });

  it("does not end a Sentence on a single capital initial", () => {
    expect(sentences("J. K. Rowling wrote it. Fine")).toEqual([
      "J. K. Rowling wrote it.",
      "Fine",
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

function readableEpub(options: FixtureOptions, filename = "book.epub") {
  const result = ingest({ bytes: epub(options), filename });
  if (!result.ok) throw new Error(`expected a readable Document, got ${result.reason}`);
  return result.document;
}

describe("an EPUB Document", () => {
  it("reads its prose as Words", () => {
    const document = readableEpub({
      sections: [{ href: "ch1.xhtml", body: "<p>The quick <em>brown</em> fox.</p><p>It ran.</p>" }],
    });
    expect(document.format).toBe("epub");
    expect(document.words).toEqual(["The", "quick", "brown", "fox.", "It", "ran."]);
  });

  it("takes its title from the EPUB metadata, or else from the file name", () => {
    const sections = [{ href: "ch1.xhtml", body: "<p>Hello there.</p>" }];
    expect(readableEpub({ title: "The Old Man and the Sea", sections }, "x.epub").title).toBe(
      "The Old Man and the Sea",
    );
    expect(readableEpub({ sections }, "Moby Dick.epub").title).toBe("Moby Dick");
  });

  it("reads its sections in reading order and marks where Sentences start", () => {
    const document = readableEpub({
      sections: [
        { href: "ch1.xhtml", body: "<p>It began. It went on.</p>" },
        { href: "ch2.xhtml", body: "<p>Then it ended.</p>" },
      ],
    });
    expect(document.words).toEqual(["It", "began.", "It", "went", "on.", "Then", "it", "ended."]);
    expect(document.sentenceStarts).toEqual([0, 2, 5]);
  });

  it("reads a long book", () => {
    const document = readableEpub({
      sections: [{ href: "ch1.xhtml", body: `<p>${"word ".repeat(300_000)}</p>` }],
    });
    expect(document.words).toHaveLength(300_000);
  });

  it("keeps a Word whole when inline markup runs through it", () => {
    const document = readableEpub({
      sections: [{ href: "ch1.xhtml", body: "<p><font>T</font>he <big>old</big> man.</p>" }],
    });
    expect(document.words).toEqual(["The", "old", "man."]);
  });

  it("reads on past a self-closed script or style tag", () => {
    const document = readableEpub({
      sections: [{ href: "ch1.xhtml", body: '<script src="x.js"/><p>After the script.</p>' }],
    });
    expect(document.words).toEqual(["After", "the", "script."]);
  });

  it("puts a Chapter at the Word after an id that follows the last Word of a block", () => {
    const document = readableEpub({
      sections: [
        { href: "ch1.xhtml", body: '<p>Start here. End.<a id="k"></a></p><h1>Next</h1><p>More.</p>' },
      ],
      toc: { style: "nav", entries: [{ title: "Next", href: "ch1.xhtml#k" }] },
    });
    expect(document.words[3]).toBe("Next");
    expect(document.chapters).toEqual([{ title: "Next", wordIndex: 3 }]);
  });

  it("lists Chapters in reading order even if the table of contents is not", () => {
    const document = readableEpub({
      sections: [
        { href: "ch1.xhtml", body: "<p>Alpha beta.</p>" },
        { href: "ch2.xhtml", body: "<p>Gamma delta.</p>" },
      ],
      toc: {
        style: "nav",
        entries: [
          { title: "Second", href: "ch2.xhtml" },
          { title: "First", href: "ch1.xhtml" },
        ],
      },
    });
    expect(document.chapters.map((c) => c.title)).toEqual(["First", "Second"]);
  });

  it("opens an EPUB whose file names hold a stray percent sign", () => {
    const document = readableEpub({
      sections: [{ href: "100%.xhtml", body: "<p>Hello there.</p>" }],
      toc: { style: "nav", entries: [{ title: "Half", href: "100%.xhtml#50%" }] },
    });
    expect(document.words).toEqual(["Hello", "there."]);
    expect(document.chapters).toEqual([{ title: "Half", wordIndex: 0 }]);
  });

  it("leaves images, tables and other non-prose out of the Words", () => {
    const document = readableEpub({
      sections: [
        {
          href: "ch1.xhtml",
          body: `<p>Before.</p>
            <img src="cover.jpg" alt="A cover picture"/>
            <table><tr><td>cell one</td><td>cell two</td></tr></table>
            <svg xmlns="http://www.w3.org/2000/svg"><text>vector words</text></svg>
            <script>var hidden = 1;</script><style>p { color: red }</style>
            <p>After.</p>`,
        },
      ],
    });
    expect(document.words).toEqual(["Before.", "After."]);
  });

  it("stores an EPUB 3 table of contents as Chapters at their starting Words", () => {
    const document = readableEpub({
      sections: [
        { href: "ch1.xhtml", body: "<h1>One</h1><p>Alpha beta gamma.</p>" },
        {
          href: "ch2.xhtml",
          body: '<p>Delta epsilon.</p><h1 id="two">Two</h1><p>Zeta eta.</p>',
        },
      ],
      toc: {
        style: "nav",
        entries: [
          { title: "First", href: "ch1.xhtml" },
          { title: "Second", href: "ch2.xhtml#two" },
        ],
      },
    });
    expect(document.words).toEqual([
      "One", "Alpha", "beta", "gamma.", "Delta", "epsilon.", "Two", "Zeta", "eta.",
    ]);
    expect(document.chapters).toEqual([
      { title: "First", wordIndex: 0 },
      { title: "Second", wordIndex: 6 },
    ]);
  });

  it("stores an EPUB 2 table of contents as Chapters too", () => {
    const document = readableEpub({
      sections: [
        { href: "ch1.xhtml", body: "<p>Alpha beta.</p>" },
        { href: "ch2.xhtml", body: "<p>Gamma delta.</p>" },
      ],
      toc: {
        style: "ncx",
        entries: [
          { title: "Start", href: "ch1.xhtml" },
          { title: "Middle", href: "ch2.xhtml" },
        ],
      },
    });
    expect(document.chapters).toEqual([
      { title: "Start", wordIndex: 0 },
      { title: "Middle", wordIndex: 2 },
    ]);
  });

  it("has no Chapters when the EPUB has no table of contents", () => {
    expect(
      readableEpub({ sections: [{ href: "ch1.xhtml", body: "<p>Alpha beta.</p>" }] }).chapters,
    ).toEqual([]);
  });

  it("leaves out Chapters that point nowhere or at nothing readable", () => {
    const document = readableEpub({
      sections: [{ href: "ch1.xhtml", body: "<p>Alpha beta.</p>" }, { href: "end.xhtml", body: "" }],
      toc: {
        style: "nav",
        entries: [
          { title: "Real", href: "ch1.xhtml" },
          { title: "Missing", href: "gone.xhtml" },
          { title: "Empty", href: "end.xhtml" },
        ],
      },
    });
    expect(document.chapters).toEqual([{ title: "Real", wordIndex: 0 }]);
  });
});

const ENCRYPTION = (algorithm: string) => `<?xml version="1.0"?>
<encryption xmlns="urn:oasis:names:tc:opendocument:xmlns:container" xmlns:enc="http://www.w3.org/2001/04/xmlenc#">
  <enc:EncryptedData>
    <enc:EncryptionMethod Algorithm="${algorithm}"/>
    <enc:CipherData><enc:CipherReference URI="OEBPS/ch1.xhtml"/></enc:CipherData>
  </enc:EncryptedData>
</encryption>`;

describe("refusing an EPUB", () => {
  const sections = [{ href: "ch1.xhtml", body: "<p>Hello there.</p>" }];

  function refusalOf(bytes: Uint8Array, filename = "book.epub") {
    const result = ingest({ bytes, filename });
    if (result.ok) throw new Error("expected a refusal");
    return result;
  }

  it("refuses a DRM-protected EPUB, saying it is protected", () => {
    const result = refusalOf(
      epub({
        sections,
        files: {
          "META-INF/encryption.xml": ENCRYPTION("http://www.w3.org/2001/04/xmlenc#aes128-cbc"),
        },
      }),
    );
    expect(result.reason).toBe("protected");
    expect(result.message).toMatch(/protected/i);
  });

  it("refuses an EPUB with Apple FairPlay information as protected", () => {
    const result = refusalOf(epub({ sections, files: { "META-INF/sinf.xml": "<sinf/>" } }));
    expect(result.reason).toBe("protected");
  });

  it("refuses an EPUB with Adobe rights information as protected", () => {
    const result = refusalOf(epub({ sections, files: { "META-INF/rights.xml": "<rights/>" } }));
    expect(result.reason).toBe("protected");
  });

  it("refuses bytes that are not a zip archive as could not be read", () => {
    const result = refusalOf(new TextEncoder().encode("this is not an epub"));
    expect(result.reason).toBe("corrupt");
    expect(result.message).toMatch(/could not be read/i);
  });

  it("refuses a zip that is not an EPUB", () => {
    expect(refusalOf(zipSync({ "hello.txt": strToU8("hi") })).reason).toBe("corrupt");
  });

  it("refuses an EPUB with nothing readable in it", () => {
    expect(
      refusalOf(epub({ sections: [{ href: "ch1.xhtml", body: '<img src="a.jpg"/>' }] })).reason,
    ).toBe("corrupt");
  });

  it("refuses an EPUB that unpacks to far more than the upload limit", () => {
    const huge = epub({
      sections: [{ href: "ch1.xhtml", body: `<p>${"a ".repeat(40 * 1024 * 1024)}</p>` }],
    });
    expect(huge.byteLength).toBeLessThan(5 * 1024 * 1024);
    expect(refusalOf(huge).reason).toBe("corrupt");
  });

  it("opens an EPUB whose only encrypted parts are obfuscated fonts", () => {
    const result = ingest({
      bytes: epub({
        sections,
        files: { "META-INF/encryption.xml": ENCRYPTION("http://www.idpf.org/2008/embedding") },
      }),
      filename: "book.epub",
    });
    expect(result.ok).toBe(true);
  });
});
