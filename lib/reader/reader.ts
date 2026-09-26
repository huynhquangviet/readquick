import { endsClause, endsSentence } from "@/lib/text/punctuation";

export interface Clock {
  now(): number;
  setTimeout(callback: () => void, ms: number): unknown;
  clearTimeout(handle: unknown): void;
}

export interface ReaderOptions {
  words: string[];
  sentenceStarts: number[];
  clock: Clock;
  speed?: number;
  position?: number;
}

/** The Word at the Focus point, split so the Anchor letter can sit on it. */
export interface ReaderWord {
  index: number;
  text: string;
  before: string;
  anchor: string;
  after: string;
}

export type ReaderEvent =
  /** The Reading position (a Word index) changed. */
  | { type: "position"; position: number }
  /** Increments since the last activity event: time spent playing and Words read. */
  | { type: "activity"; playedMs: number; wordsRead: number }
  /** Playback started, paused, or reached the end of the Document. */
  | { type: "playback"; playing: boolean; ended: boolean };

export interface Reader {
  readonly position: number;
  readonly current: ReaderWord;
  /** Words per minute, from 100 to 800. */
  readonly speed: number;
  readonly playing: boolean;
  /** True once the last Word has been shown. Playback does not loop. */
  readonly ended: boolean;
  setSpeed(wordsPerMinute: number): void;
  play(): void;
  pause(): void;
  seek(index: number): void;
  /** Back to the start of the current Sentence, or of the previous one if already there. */
  rewind(): void;
  /** On to the start of the next Sentence, or to the last Word in the last Sentence. */
  forward(): void;
  /** Returns a function that stops listening. */
  subscribe(listener: (event: ReaderEvent) => void): () => void;
}

const DEFAULT_SPEED = 250;
const MIN_SPEED = 100;
const MAX_SPEED = 800;

// Pause on punctuation: multipliers on the base duration.
const CLAUSE_PAUSE = 1.5; // , ; :
const SENTENCE_PAUSE = 2; // . ! ? …
const LONG_WORD_PAUSE = 1.5;
const LONG_WORD_LETTERS = 10; // a "very long Word" has more letters than this

const graphemes = new Intl.Segmenter(undefined, { granularity: "grapheme" });

function clampSpeed(wordsPerMinute: number, fallback: number) {
  if (!Number.isFinite(wordsPerMinute)) return fallback;
  return Math.min(Math.max(wordsPerMinute, MIN_SPEED), MAX_SPEED);
}

function splitAtAnchor(index: number, text: string): ReaderWord {
  const chars = Array.from(graphemes.segment(text), (part) => part.segment);
  const isLetter = (char: string) => /[\p{L}\p{N}]/u.test(char);
  let start = chars.findIndex(isLetter);
  let end = chars.length - 1 - [...chars].reverse().findIndex(isLetter);
  if (start === -1) {
    start = 0;
    end = chars.length - 1;
  }
  // Around the first third of the letters, so the eye lands early in the Word.
  const at = start + Math.floor((end - start) / 3);
  return {
    index,
    text,
    before: chars.slice(0, at).join(""),
    anchor: chars[at],
    after: chars.slice(at + 1).join(""),
  };
}

const EDGE_NON_LETTERS = /^[^\p{L}\p{N}]+|[^\p{L}\p{N}]+$/gu;

function displayMultiplier(word: string): number {
  let multiplier = 1;
  if (endsSentence(word)) multiplier = SENTENCE_PAUSE;
  else if (endsClause(word)) multiplier = CLAUSE_PAUSE;

  const letters = Array.from(word.replace(EDGE_NON_LETTERS, "")).length;
  if (letters > LONG_WORD_LETTERS) multiplier *= LONG_WORD_PAUSE;
  return multiplier;
}

export function createReader(options: ReaderOptions): Reader {
  const { words, clock } = options;
  if (words.length === 0) throw new RangeError("A Reader needs at least one Word");
  const sentenceStarts = [...options.sentenceStarts].sort((a, b) => a - b);
  const lastIndex = words.length - 1;
  let speed = clampSpeed(options.speed ?? DEFAULT_SPEED, DEFAULT_SPEED);
  let position = Math.min(Math.max(options.position ?? 0, 0), lastIndex);
  let playing = false;
  let ended = false;
  let timer: unknown;
  // When the Word at the Focus point (re)started its display time.
  let shownAt = 0;
  // When the Word at the Focus point is due to give way to the next one.
  let dueAt = 0;
  // How long the Word at the Focus point had been on screen when playback paused.
  let shownBeforePauseMs = 0;
  // Whether the Word now at the Focus point has been counted as read yet.
  let counted = false;
  // The clock time up to which played time has been reported.
  let reportedAt = 0;
  const listeners = new Set<(event: ReaderEvent) => void>();

  function emit(event: ReaderEvent) {
    for (const listener of [...listeners]) listener(event);
  }

  function reportActivity(wordsRead: number) {
    const now = clock.now();
    const playedMs = now - reportedAt;
    reportedAt = now;
    if (playedMs > 0 || wordsRead > 0) {
      emit({ type: "activity", playedMs, wordsRead });
    }
  }

  function emitPlayback() {
    emit({ type: "playback", playing, ended });
  }

  // Keeps the Word on screen for what the Speed gives it, less time it has had.
  function schedule(alreadyShownMs = 0) {
    const duration = displayDuration(position);
    shownAt = clock.now() - alreadyShownMs;
    // A Word already past its time (the Speed went up) is due now, not in the past.
    dueAt = Math.max(shownAt + duration, clock.now());
    timer = clock.setTimeout(advance, Math.max(0, duration - alreadyShownMs));
  }

  function displayDuration(index: number) {
    return (60000 / speed) * displayMultiplier(words[index]);
  }

  // The current Word is on screen while playing: count it, once per showing.
  function countWord() {
    if (counted) return;
    counted = true;
    reportActivity(1);
  }

  function advance() {
    if (position === lastIndex) {
      reportActivity(0);
      playing = false;
      ended = true;
      emitPlayback();
      return;
    }
    // A late timer must not push every later Word back: the next Word was
    // due to start when this one was, so count the lateness towards it. But a
    // Word always gets its own display time, however late the clock was.
    const lateBy = Math.max(0, clock.now() - dueAt);
    moveTo(position + 1, lateBy < displayDuration(position + 1) ? lateBy : 0);
  }

  function moveTo(target: number, alreadyShownMs = 0) {
    position = target;
    ended = false;
    counted = false;
    shownBeforePauseMs = 0;
    if (playing) {
      clock.clearTimeout(timer);
      schedule(alreadyShownMs);
    }
    // Listeners may pause or seek in response, so the timing is settled first.
    emit({ type: "position", position });
    if (playing) countWord();
  }

  function seek(index: number) {
    const target = Math.min(Math.max(index, 0), lastIndex);
    if (target !== position) moveTo(target);
  }

  function sentenceStartAtOrBefore(index: number) {
    return sentenceStarts.findLast((start) => start <= index) ?? 0;
  }

  return {
    get position() {
      return position;
    },
    get playing() {
      return playing;
    },
    get ended() {
      return ended;
    },
    get speed() {
      return speed;
    },
    setSpeed(wordsPerMinute: number) {
      speed = clampSpeed(wordsPerMinute, speed);
      if (!playing) return;
      clock.clearTimeout(timer);
      schedule(clock.now() - shownAt);
    },
    get current() {
      return splitAtAnchor(position, words[position]);
    },
    play() {
      if (playing || ended) return;
      playing = true;
      reportedAt = clock.now();
      schedule(shownBeforePauseMs);
      countWord();
      // Last, so a listener that pauses in response finds everything settled.
      emitPlayback();
    },
    pause() {
      if (!playing) return;
      reportActivity(0);
      shownBeforePauseMs = clock.now() - shownAt;
      playing = false;
      clock.clearTimeout(timer);
      emitPlayback();
    },
    seek,
    rewind() {
      const start = sentenceStartAtOrBefore(position);
      seek(start < position ? start : sentenceStartAtOrBefore(position - 1));
    },
    forward() {
      const next = sentenceStarts.find((start) => start > position);
      seek(next ?? lastIndex);
    },
    subscribe(listener) {
      listeners.add(listener);
      return () => {
        listeners.delete(listener);
      };
    },
  };
}
