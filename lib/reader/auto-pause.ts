import type { Reader } from "@/lib/reader/reader";

/** The part of `document` that says whether the tab can be seen. */
export interface VisibilitySource {
  readonly hidden: boolean;
  addEventListener(type: "visibilitychange", listener: () => void): void;
  removeEventListener(type: "visibilitychange", listener: () => void): void;
}

/**
 * Pauses the Reader when the tab is hidden, so play time and Words read are
 * not counted while nobody is looking. Showing the tab again does not resume:
 * the user taps to read. Returns a function that stops listening.
 */
export function pauseWhenHidden(reader: Pick<Reader, "pause">, tab: VisibilitySource) {
  const onChange = () => {
    if (tab.hidden) reader.pause();
  };
  tab.addEventListener("visibilitychange", onChange);
  return () => tab.removeEventListener("visibilitychange", onChange);
}
