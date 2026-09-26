// Punctuation rules shared by Sentence detection (Ingestion) and Pause on
// punctuation (Reader), so a Word the Reader treats as ending a Sentence is the
// same Word that Ingestion ends a Sentence on.

// Words that end in a full stop without ending a Sentence.
const ABBREVIATIONS = new Set([
  // English
  "mr", "mrs", "ms", "dr", "prof", "sr", "jr", "st", "vs",
  // Vietnamese
  "tp", "gs", "pgs", "ts", "ths", "ks", "bs", "nxb",
]);

const OPENERS = /^[\p{Ps}\p{Pi}"'“‘]+/u;
const CLOSERS = /[\p{Pe}\p{Pf}"'”’]+$/u;
// A capital initial like "J." (but not a lone lower-case letter, which can be a
// whole Word: Vietnamese "ạ." or "à."), or a dotted abbreviation like "e.g.",
// "U.S." and "Ph.D." (but not an ordinary short Word like "no.").
const DOTTED_ABBREVIATION = /^\p{Lu}\.$|^(\p{L}{1,2}\.){2,}$/u;

/** The Word without opening brackets or quotes in front, or closing ones behind. */
export function withoutBrackets(word: string): string {
  return word.replace(OPENERS, "").replace(CLOSERS, "");
}

/** Whether a Word ends a Sentence: terminal punctuation, and not an abbreviation. */
export function endsSentence(word: string): boolean {
  const bare = withoutBrackets(word);
  if (!/[.!?…]$/u.test(bare)) return false;
  if (DOTTED_ABBREVIATION.test(bare)) return false;
  return !(bare.endsWith(".") && ABBREVIATIONS.has(bare.slice(0, -1).toLowerCase()));
}

/** Whether a Word ends a clause: a comma, semicolon or colon. */
export function endsClause(word: string): boolean {
  return /[,;:]$/u.test(withoutBrackets(word));
}
