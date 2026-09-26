/** A row of `document_texts`: the Words joined by single spaces, and where each Sentence starts. */
export interface StoredText {
  body: string;
  sentence_starts: number[];
}

/** Splitting on a single space gives back exactly the Words that were stored. */
export function toReaderInput({ body, sentence_starts }: StoredText) {
  return { words: body.split(" "), sentenceStarts: sentence_starts };
}
