import type { Clock } from "@/lib/reader/reader";

type Timer = { id: number; at: number; callback: () => void };

/**
 * A manually advanced Clock for tests: timers only fire inside `advance`.
 * `lateBy` makes every timer fire that many ms after it was due, like a busy
 * real clock does.
 */
export function createFakeClock({ lateBy = 0 } = {}): Clock & { advance(ms: number): void } {
  let now = 0;
  let nextId = 1;
  let timers: Timer[] = [];

  return {
    now: () => now,
    setTimeout(callback, ms) {
      const timer = { id: nextId++, at: now + ms, callback };
      timers.push(timer);
      return timer.id;
    },
    clearTimeout(handle) {
      timers = timers.filter((timer) => timer.id !== handle);
    },
    advance(ms) {
      const target = now + ms;
      for (;;) {
        const due = timers
          .filter((timer) => timer.at + lateBy <= target)
          .sort((a, b) => a.at - b.at || a.id - b.id)[0];
        if (!due) break;
        timers = timers.filter((timer) => timer !== due);
        now = due.at + lateBy;
        due.callback();
      }
      now = target;
    },
  };
}
