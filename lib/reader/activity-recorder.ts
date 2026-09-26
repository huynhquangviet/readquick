import { localDate } from "@/lib/reader/local-date";
import type { Clock, Reader } from "@/lib/reader/reader";

/** What was read on one local date since the last record. */
export interface ActivityRecord {
  /** The user's local date, YYYY-MM-DD. */
  date: string;
  seconds: number;
  wordsRead: number;
}

export interface ActivityRecorderOptions {
  reader: Pick<Reader, "subscribe">;
  clock: Clock;
  /** Milliseconds since the epoch. The local date comes from this, not from `clock`. */
  wallNow: () => number;
  /** The user's IANA time zone. */
  timeZone: string;
  /** Adds the activity to that day's row. */
  record: (record: ActivityRecord) => void | Promise<void>;
  intervalMs?: number;
}

export interface ActivityRecorder {
  stop(): void;
}

const DEFAULT_INTERVAL_MS = 10_000;

export function createActivityRecorder({
  reader,
  clock,
  wallNow,
  timeZone,
  record,
  intervalMs = DEFAULT_INTERVAL_MS,
}: ActivityRecorderOptions): ActivityRecorder {
  // Activity not yet stored, by local date, in the order the days came.
  const unsent = new Map<string, { playedMs: number; wordsRead: number }>();
  let timer: unknown;
  let retryTimer: unknown;
  let stopped = false;

  function flush() {
    for (const [date, { playedMs, wordsRead }] of [...unsent]) {
      unsent.delete(date);
      void send(date, playedMs, wordsRead);
    }
  }

  async function send(date: string, playedMs: number, wordsRead: number) {
    try {
      await record({ date, seconds: playedMs / 1000, wordsRead });
    } catch {
      // Still unsent. It goes out again with the next send, or on its own
      // if the user has stopped playing and there is no next send.
      add(date, playedMs, wordsRead);
      if (!stopped && retryTimer === undefined) {
        retryTimer = clock.setTimeout(() => {
          retryTimer = undefined;
          flush();
        }, intervalMs);
      }
    }
  }

  function add(date: string, playedMs: number, wordsRead: number) {
    const pending = unsent.get(date) ?? { playedMs: 0, wordsRead: 0 };
    unsent.set(date, {
      playedMs: pending.playedMs + playedMs,
      wordsRead: pending.wordsRead + wordsRead,
    });
  }

  function tick() {
    timer = clock.setTimeout(tick, intervalMs);
    flush();
  }

  const unsubscribe = reader.subscribe((event) => {
    if (event.type === "activity") {
      // Reading that crosses local midnight is split between the two days.
      add(localDate(wallNow(), timeZone), event.playedMs, event.wordsRead);
    } else if (event.type === "playback") {
      clock.clearTimeout(timer);
      if (event.playing) timer = clock.setTimeout(tick, intervalMs);
      else flush();
    }
  });
  return {
    stop() {
      stopped = true;
      unsubscribe();
      clock.clearTimeout(timer);
      clock.clearTimeout(retryTimer);
      flush();
    },
  };
}
