import { DEFAULT_SPEED, MAX_SPEED, MIN_SPEED } from "@/lib/reader/reader";

export type Theme = "light" | "dark" | "system";

/** One set per user, shared by every Document and every device. */
export interface Settings {
  /** Words per minute. */
  speed: number;
  /** The size of a Word at the Focus point, in rem. */
  fontSize: number;
  /** Null until the user picks one; their browser's own choice stands until then. */
  theme: Theme;
}

export const MIN_FONT_SIZE = 2;
export const MAX_FONT_SIZE = 5;
export const FONT_STEP = 0.5;
export const THEMES: readonly Theme[] = ["light", "dark", "system"];

export const DEFAULT_SETTINGS: Settings = { speed: DEFAULT_SPEED, fontSize: 3, theme: "system" };

export function toTheme(value: unknown): Theme | undefined {
  return THEMES.find((theme) => theme === value);
}

function numberIn(value: unknown, min: number, max: number, fallback: number) {
  if (typeof value !== "number" || !Number.isFinite(value)) return fallback;
  return Math.min(Math.max(value, min), max);
}

/** Turns whatever was stored (or nothing) into usable settings, one field at a time. */
export function parseSettings(raw: unknown): Settings {
  const saved = typeof raw === "object" && raw !== null ? (raw as Record<string, unknown>) : {};
  return {
    speed: numberIn(saved.speed, MIN_SPEED, MAX_SPEED, DEFAULT_SETTINGS.speed),
    fontSize: numberIn(saved.fontSize, MIN_FONT_SIZE, MAX_FONT_SIZE, DEFAULT_SETTINGS.fontSize),
    theme: toTheme(saved.theme) ?? DEFAULT_SETTINGS.theme,
  };
}

export const SPEED_STEP = 25;

/** Where Speed goes when the up or down arrow key is pressed. */
export function stepSpeed(speed: number, direction: "faster" | "slower"): number {
  const next = direction === "faster" ? speed + SPEED_STEP : speed - SPEED_STEP;
  return Math.min(Math.max(next, MIN_SPEED), MAX_SPEED);
}
