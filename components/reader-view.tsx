"use client";

import { useEffect, useState } from "react";

import { createReader, type Clock } from "@/lib/reader/reader";
import { toReaderInput } from "@/lib/reader/stored-document";

const browserClock: Clock = {
  now: () => performance.now(),
  setTimeout: (callback, ms) => window.setTimeout(callback, ms),
  clearTimeout: (handle) => window.clearTimeout(handle as number),
};

// A letter is about 0.6em wide; a Word's longer side may use up to 44% of the
// width, so a very long Word shrinks to fit instead of running off the screen.
const LETTER_EM = 0.6;
const SIDE_WIDTH_CQW = 44;
const BASE_FONT_REM = 3;

/**
 * Shows a Document one Word at a time at the Focus point. The screen is one
 * big button: a tap toggles pause and play. It starts paused.
 */
export function ReaderView({
  body,
  sentenceStarts,
}: {
  body: string;
  sentenceStarts: number[];
}) {
  const [reader] = useState(() =>
    createReader({ ...toReaderInput({ body, sentence_starts: sentenceStarts }), clock: browserClock }),
  );
  const [, rerender] = useState(0);

  useEffect(() => {
    // The Reader may have been paused by an earlier cleanup (a hidden route
    // that is shown again), so show what it is doing now.
    rerender((n) => n + 1);
    const stop = reader.subscribe((event) => {
      if (event.type !== "activity") rerender((n) => n + 1);
    });
    return () => {
      stop();
      reader.pause();
    };
  }, [reader]);

  const { before, anchor, after } = reader.current;
  const longerSide = Math.max(Array.from(before).length, Array.from(after).length, 1);
  const fontSize = `min(${BASE_FONT_REM}rem, ${SIDE_WIDTH_CQW / (LETTER_EM * longerSide)}cqw)`;

  const hint = reader.ended ? "End of Document" : reader.playing ? "Tap to pause" : "Tap to read";

  return (
    <button
      type="button"
      disabled={reader.ended}
      aria-label={reader.ended ? "End of Document" : reader.playing ? "Pause" : "Play"}
      onClick={() => (reader.playing ? reader.pause() : reader.play())}
      style={{ containerType: "inline-size" }}
      className="flex min-h-[65svh] w-full flex-col items-center justify-center gap-10 rounded-lg select-none touch-manipulation focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:cursor-default"
    >
      <span className="flex w-full flex-col items-center">
        {/* Marks of the Focus point, above and below the Anchor letter. */}
        <span aria-hidden className="h-4 w-px bg-foreground/30" />
        <span
          className="grid w-full grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)] items-baseline py-2 font-mono leading-none whitespace-nowrap"
          style={{ fontSize }}
        >
          <span className="text-right">{before}</span>
          <span className="text-red-500">{anchor}</span>
          <span className="text-left">{after}</span>
        </span>
        <span aria-hidden className="h-4 w-px bg-foreground/30" />
      </span>
      <span className="text-sm text-muted-foreground">{hint}</span>
    </button>
  );
}
