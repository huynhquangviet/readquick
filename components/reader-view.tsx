"use client";

import { ChevronLeft, ChevronRight } from "lucide-react";
import { useEffect, useState, type PointerEvent } from "react";

import { useSettings } from "@/components/settings-provider";
import { createHoldRepeat, type HoldRepeat } from "@/lib/reader/hold-repeat";
import { readerKeyAction } from "@/lib/reader/keyboard";
import { createPositionSaver } from "@/lib/reader/position-saver";
import { createPositionWriter } from "@/lib/reader/position-store";
import { positionAt, progressOf } from "@/lib/reader/progress";
import { MAX_SPEED, MIN_SPEED, createReader, type Clock } from "@/lib/reader/reader";
import { toReaderInput } from "@/lib/reader/stored-document";
import {
  FONT_STEP,
  MAX_FONT_SIZE,
  MIN_FONT_SIZE,
  SPEED_STEP,
  stepSpeed,
} from "@/lib/settings/settings";
import { createClient } from "@/lib/supabase/client";

const browserClock: Clock = {
  now: () => performance.now(),
  setTimeout: (callback, ms) => window.setTimeout(callback, ms),
  clearTimeout: (handle) => window.clearTimeout(handle as number),
};

// A letter is about 0.6em wide; a Word may use up to 90% of the width, so a
// very long Word shrinks to fit instead of running off the screen.
const LETTER_EM = 0.6;
const WORD_WIDTH_CQW = 90;
// A field where Space and the arrows edit text, or a control that keeps the
// arrows for itself (`data-reader-keys="off"`). The progress bar and Speed
// slider are not: after a drag they keep focus, and Space and the arrows must
// still work.
function isTypingTarget(target: EventTarget | null) {
  if (!(target instanceof HTMLElement)) return false;
  if (target.dataset.readerKeys === "off") return true;
  if (target instanceof HTMLInputElement && target.type === "range") return false;
  return target.isContentEditable || ["INPUT", "TEXTAREA", "SELECT"].includes(target.tagName);
}

/**
 * A button that acts when pressed and keeps acting while held. A press by
 * pointer is handled here; a press by keyboard (Enter) arrives as a click
 * with no pointer, `detail === 0`.
 */
function HoldButton({
  hold,
  label,
  className,
  children,
}: {
  hold: HoldRepeat;
  label: string;
  className: string;
  children: React.ReactNode;
}) {
  const release = (event: PointerEvent<HTMLButtonElement>) => {
    if (event.currentTarget.hasPointerCapture(event.pointerId)) {
      event.currentTarget.releasePointerCapture(event.pointerId);
    }
    hold.stop();
  };
  return (
    <button
      type="button"
      aria-label={label}
      className={className}
      onPointerDown={(event) => {
        if (event.button !== 0) return;
        // Keeps the release coming here if the finger slides off the button.
        event.currentTarget.setPointerCapture(event.pointerId);
        hold.start();
      }}
      onPointerUp={release}
      onPointerCancel={release}
      // Capture is lost when the button goes away or the window loses the pointer.
      onLostPointerCapture={() => hold.stop()}
      onContextMenu={(event) => event.preventDefault()}
      onClick={(event) => {
        if (event.detail === 0) {
          hold.start();
          hold.stop();
        }
      }}
    >
      {children}
    </button>
  );
}

/**
 * Shows a Document one Word at a time at the Focus point. The screen is one
 * big button: a tap toggles pause and play. It starts paused, at the Reading
 * position the user left. Below it are Rewind and Forward, a progress bar that
 * can be dragged, and the Speed and font size settings. The Reading position is
 * saved when the user pauses and every few seconds while reading.
 */
export function ReaderView({
  documentId,
  body,
  sentenceStarts,
  initialPosition,
}: {
  documentId: string;
  body: string;
  sentenceStarts: number[];
  initialPosition: number;
}) {
  const { settings, update } = useSettings();
  const [{ reader, wordCount }] = useState(() => {
    const input = toReaderInput({ body, sentence_starts: sentenceStarts });
    return {
      reader: createReader({
        ...input,
        clock: browserClock,
        speed: settings.speed,
        position: initialPosition,
      }),
      wordCount: input.words.length,
    };
  });
  const [rewindHold] = useState(() => createHoldRepeat({ action: () => reader.rewind(), clock: browserClock }));
  const [forwardHold] = useState(() => createHoldRepeat({ action: () => reader.forward(), clock: browserClock }));
  const [, rerender] = useState(0);

  // Speed can change while playing: from the slider, the arrow keys, or a saved value.
  useEffect(() => {
    reader.setSpeed(settings.speed);
  }, [reader, settings.speed]);

  useEffect(() => {
    // The Reader may have been paused by an earlier cleanup (a hidden route
    // that is shown again), so show what it is doing now.
    rerender((n) => n + 1);
    const stop = reader.subscribe((event) => {
      if (event.type !== "activity") rerender((n) => n + 1);
    });
    const saver = createPositionSaver({
      reader,
      clock: browserClock,
      save: createPositionWriter(createClient(), documentId),
    });
    return () => {
      stop();
      // Pausing saves the Reading position, so stop saving only after it.
      reader.pause();
      saver.stop();
      rewindHold.stop();
      forwardHold.stop();
    };
  }, [reader, rewindHold, forwardHold, documentId]);

  useEffect(() => {
    function onKeyDown(event: KeyboardEvent) {
      if (
        event.ctrlKey ||
        event.metaKey ||
        event.altKey ||
        isTypingTarget(event.target)
      )
        return;
      const action = readerKeyAction(event.key);
      if (!action) return;
      // Space would otherwise also press the focused button.
      event.preventDefault();
      if (action === "toggle") {
        if (event.repeat) return;
        if (reader.playing) reader.pause();
        else reader.play();
      } else if (action === "rewind") reader.rewind();
      else if (action === "forward") reader.forward();
      else {
        // From the Reader's own Speed, which is current even when keys repeat
        // faster than the screen redraws.
        const speed = stepSpeed(reader.speed, action);
        reader.setSpeed(speed);
        update({ speed });
      }
    }
    function onKeyUp(event: KeyboardEvent) {
      if (event.key === " " && !isTypingTarget(event.target))
        event.preventDefault();
    }
    window.addEventListener("keydown", onKeyDown);
    window.addEventListener("keyup", onKeyUp);
    return () => {
      window.removeEventListener("keydown", onKeyDown);
      window.removeEventListener("keyup", onKeyUp);
    };
  }, [reader, update]);

  const { text } = reader.current;
  const letters = Math.max(Array.from(text).length, 1);
  const fontSize = `min(${settings.fontSize}rem, ${WORD_WIDTH_CQW / (LETTER_EM * letters)}cqw)`;

  const hint = reader.ended
    ? "End of Document"
    : reader.playing
      ? "Tap to pause"
      : "Tap to read";

  const stepClass =
    "flex h-14 flex-1 items-center justify-center rounded-lg border text-lg select-none touch-manipulation hover:bg-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring";

  return (
    <div className="flex flex-col gap-4">
      <button
        type="button"
        disabled={reader.ended}
        aria-label={
          reader.ended ? "End of Document" : reader.playing ? "Pause" : "Play"
        }
        onClick={() => (reader.playing ? reader.pause() : reader.play())}
        style={{ containerType: "inline-size" }}
        className="flex min-h-[50svh] w-full flex-col items-center justify-center gap-10 rounded-lg select-none touch-manipulation focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:cursor-default"
      >
        <span className="flex w-full flex-col items-center">
          {/* Marks of the Focus point, above and below the centred Word. */}
          <span aria-hidden className="h-4 w-px bg-foreground/30" />
          <span
            className="w-full py-2 text-center font-mono leading-none whitespace-nowrap"
            style={{ fontSize }}
          >
            {text}
          </span>
          <span aria-hidden className="h-4 w-px bg-foreground/30" />
        </span>
        <span className="text-sm text-muted-foreground">{hint}</span>
      </button>
      <input
        type="range"
        min={0}
        max={1}
        step="any"
        value={progressOf(reader.position, wordCount)}
        onChange={(event) =>
          reader.seek(positionAt(event.currentTarget.valueAsNumber, wordCount))
        }
        aria-label="Progress"
        aria-valuetext={`Word ${reader.position + 1} of ${wordCount}`}
        className="h-8 w-full cursor-pointer accent-foreground touch-manipulation"
      />
      <div className="flex gap-4">
        <HoldButton hold={rewindHold} label="Rewind" className={stepClass}>
          <ChevronLeft aria-hidden />
        </HoldButton>
        <HoldButton hold={forwardHold} label="Forward" className={stepClass}>
          <ChevronRight aria-hidden />
        </HoldButton>
      </div>
      <div className="flex flex-col gap-3">
        <label className="flex items-center gap-4 text-sm">
          <span className="w-24 shrink-0">Speed</span>
          <input
            type="range"
            min={MIN_SPEED}
            max={MAX_SPEED}
            step={SPEED_STEP}
            value={settings.speed}
            onChange={(event) => update({ speed: event.currentTarget.valueAsNumber })}
            aria-label="Speed"
            aria-valuetext={`${settings.speed} words per minute`}
            className="h-8 w-full cursor-pointer accent-foreground touch-manipulation"
          />
          <span className="w-16 shrink-0 text-right tabular-nums text-muted-foreground">
            {settings.speed} wpm
          </span>
        </label>
        <label className="flex items-center gap-4 text-sm">
          <span className="w-24 shrink-0">Font size</span>
          <input
            type="range"
            min={MIN_FONT_SIZE}
            max={MAX_FONT_SIZE}
            step={FONT_STEP}
            value={settings.fontSize}
            onChange={(event) => update({ fontSize: event.currentTarget.valueAsNumber })}
            aria-label="Font size"
            data-reader-keys="off"
            className="h-8 w-full cursor-pointer accent-foreground touch-manipulation"
          />
          <span className="w-16 shrink-0" aria-hidden />
        </label>
      </div>
    </div>
  );
}
