/**
 * Cuts text into Words on whitespace. This is a stable contract: a Reading
 * position is a Word index, so changing this rule would shift every saved
 * position. Each Vietnamese syllable is its own Word because syllables are
 * separated by spaces.
 */
export function toWords(text: string): string[] {
  return text.split(/\s+/u).filter((word) => word !== "");
}
