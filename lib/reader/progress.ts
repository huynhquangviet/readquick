/** How far through the Document the Word at `position` is, from 0 (first Word) to 1 (last Word). */
export function progressOf(position: number, wordCount: number): number {
  const lastIndex = wordCount - 1;
  return lastIndex > 0 ? position / lastIndex : 0;
}

/** The Word a point on the progress bar stands for; `progress` is clamped to 0..1. */
export function positionAt(progress: number, wordCount: number): number {
  const lastIndex = wordCount - 1;
  if (lastIndex <= 0) return 0;
  return Math.round(Math.min(Math.max(progress, 0), 1) * lastIndex);
}
