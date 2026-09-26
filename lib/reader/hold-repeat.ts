import type { Clock } from "@/lib/reader/reader";

export interface HoldRepeatOptions {
  action: () => void;
  clock: Clock;
  /** How long a button is held before it starts repeating. */
  delayMs?: number;
  /** The time between repeats once it has started. */
  intervalMs?: number;
}

export interface HoldRepeat {
  /** The button went down: act now, and keep acting while it stays down. */
  start(): void;
  /** The button came up. */
  stop(): void;
}

const DEFAULT_DELAY_MS = 400;
const DEFAULT_INTERVAL_MS = 150;

export function createHoldRepeat({
  action,
  clock,
  delayMs = DEFAULT_DELAY_MS,
  intervalMs = DEFAULT_INTERVAL_MS,
}: HoldRepeatOptions): HoldRepeat {
  let held = false;
  let timer: unknown;

  function repeat() {
    if (!held) return;
    timer = clock.setTimeout(repeat, intervalMs);
    action();
  }

  return {
    start() {
      if (held) return;
      held = true;
      timer = clock.setTimeout(repeat, delayMs);
      action();
    },
    stop() {
      if (!held) return;
      held = false;
      clock.clearTimeout(timer);
    },
  };
}
