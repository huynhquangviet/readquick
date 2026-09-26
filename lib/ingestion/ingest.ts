import { endsSentence } from "@/lib/text/punctuation";

export interface IngestInput {
  bytes: Uint8Array;
  /** The extension of the file name is the declared format. */
  filename: string;
}

export interface Chapter {
  title: string;
  /** Index of the first Word of the Chapter. */
  wordIndex: number;
}

export interface IngestedDocument {
  title: string;
  /** Lower-case format, e.g. "txt". */
  format: string;
  words: string[];
  /** Word indexes at which a Sentence begins. Always starts with 0. */
  sentenceStarts: number[];
  chapters: Chapter[];
}

export type RefusalReason = "too-large" | "unsupported-format" | "corrupt";

export type Refusal = { ok: false; reason: RefusalReason; message: string };

export type IngestResult = { ok: true; document: IngestedDocument } | Refusal;

export const MAX_FILE_BYTES = 5 * 1024 * 1024;

const SUPPORTED_FORMATS = ["txt"];

const REFUSALS = {
  "too-large": "This Document is too large. The limit is 5MB.",
  "unsupported-format": `This Document's format is not supported. Supported formats: ${SUPPORTED_FORMATS.map((f) => f.toUpperCase()).join(", ")}.`,
  corrupt: "This Document could not be read. It may be damaged or empty; try another copy.",
} satisfies Record<RefusalReason, string>;

export function refusal(reason: RefusalReason): Refusal {
  return { ok: false, reason, message: REFUSALS[reason] };
}

/**
 * Cuts text into Words on whitespace. This is a stable contract: a Reading
 * position is a Word index, so changing this rule would shift every saved
 * position. Each Vietnamese syllable is its own Word because syllables are
 * separated by spaces.
 */
function toWords(text: string): string[] {
  return text.split(/\s+/u).filter((word) => word !== "");
}

function toSentenceStarts(words: string[]): number[] {
  const starts = [0];
  for (let i = 0; i < words.length - 1; i++) {
    if (endsSentence(words[i])) starts.push(i + 1);
  }
  return starts;
}

function titleFrom(filename: string): string {
  return filename.replace(/\.[^.]*$/, "").trim() || "Untitled";
}

function formatOf(filename: string): string | undefined {
  return /^.+\.([^.]+)$/.exec(filename)?.[1].toLowerCase();
}

/** Decodes UTF-8 text, or returns undefined if the bytes are not text. */
function decodeText(bytes: Uint8Array): string | undefined {
  try {
    const text = new TextDecoder("utf-8", { fatal: true }).decode(bytes);
    return text.includes("\u0000") ? undefined : text;
  } catch {
    return undefined;
  }
}

export function ingest({ bytes, filename }: IngestInput): IngestResult {
  if (bytes.byteLength > MAX_FILE_BYTES) return refusal("too-large");
  const format = formatOf(filename);
  if (!format || !SUPPORTED_FORMATS.includes(format)) return refusal("unsupported-format");

  const text = decodeText(bytes);
  const words = text === undefined ? [] : toWords(text);
  if (words.length === 0) return refusal("corrupt");

  return {
    ok: true,
    document: {
      title: titleFrom(filename),
      format,
      words,
      sentenceStarts: toSentenceStarts(words),
      chapters: [],
    },
  };
}
