import type { Clock, Reader } from "@/lib/reader/reader";

export interface PositionSaverOptions {
  reader: Pick<Reader, "position" | "playing" | "subscribe">;
  clock: Clock;
  /** Stores the Reading position (a Word index). */
  save: (position: number) => void | Promise<void>;
  /** How often the Reading position is saved while playing. */
  intervalMs?: number;
}

export interface PositionSaver {
  /** Stops saving. */
  stop(): void;
}

const DEFAULT_INTERVAL_MS = 5000;
// A drag of the progress bar moves many times; save once it has settled.
const SETTLE_MS = 1000;

export function createPositionSaver({
  reader,
  clock,
  save,
  intervalMs = DEFAULT_INTERVAL_MS,
}: PositionSaverOptions): PositionSaver {
  let timer: unknown;
  let settleTimer: unknown;
  // The opening position is where the user resumed, which is already stored.
  let saved: number | undefined = reader.position;

  async function attempt(position: number) {
    try {
      await save(position);
    } catch {
      // Still unsaved, so the next pause or tick tries again. A newer save
      // that has gone out since is not undone.
      if (saved === position) saved = undefined;
    }
  }

  function saveIfChanged() {
    if (reader.position === saved) return;
    saved = reader.position;
    void attempt(saved);
  }

  function tick() {
    timer = clock.setTimeout(tick, intervalMs);
    saveIfChanged();
  }

  const unsubscribe = reader.subscribe((event) => {
    // While playing, the interval saves. A move while paused is a drag,
    // Rewind or Forward, which no pause follows.
    if (event.type === "position" && !reader.playing) {
      clock.clearTimeout(settleTimer);
      settleTimer = clock.setTimeout(saveIfChanged, SETTLE_MS);
    }
    if (event.type !== "playback") return;
    clock.clearTimeout(timer);
    if (event.playing) {
      timer = clock.setTimeout(tick, intervalMs);
    } else {
      saveIfChanged();
    }
  });
  return {
    stop() {
      unsubscribe();
      clock.clearTimeout(timer);
      clock.clearTimeout(settleTimer);
      saveIfChanged();
    },
  };
}
