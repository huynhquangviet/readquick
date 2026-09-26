export type ReaderKeyAction = "toggle" | "rewind" | "forward";

/** What a key press does in the Reader, or null if the key is not a Reader control. */
export function readerKeyAction(key: string): ReaderKeyAction | null {
  switch (key) {
    case " ":
      return "toggle";
    case "ArrowLeft":
      return "rewind";
    case "ArrowRight":
      return "forward";
    default:
      return null;
  }
}
