import type { Chapter } from "@/lib/ingestion/ingest";

function isJumpable(entry: unknown, wordCount: number): entry is Chapter {
  if (typeof entry !== "object" || entry === null) return false;
  const { title, wordIndex } = entry as Partial<Chapter>;
  return (
    typeof title === "string" &&
    title.trim() !== "" &&
    Number.isInteger(wordIndex) &&
    wordIndex! >= 0 &&
    wordIndex! < wordCount
  );
}

/**
 * The Chapters of a Document that the Reader can jump to, in reading order.
 * The stored value is JSON from the database, so entries that are malformed
 * or point outside the Document are left out rather than trusted.
 */
export function parseChapters(stored: unknown, wordCount: number): Chapter[] {
  if (!Array.isArray(stored)) return [];
  return stored
    .filter((entry) => isJumpable(entry, wordCount))
    .sort((a, b) => a.wordIndex - b.wordIndex);
}

/** The Chapter the Reading position is in, or none before the first Chapter starts. */
export function currentChapter(
  chapters: Chapter[],
  position: number,
): Chapter | undefined {
  return chapters.findLast((chapter) => chapter.wordIndex <= position);
}
