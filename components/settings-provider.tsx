"use client";

import { useTheme } from "next-themes";
import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from "react";

import { createClient } from "@/lib/supabase/client";
import type { Settings } from "@/lib/settings/settings";

// Dragging a slider changes a setting many times a second; one write follows.
const SAVE_DELAY_MS = 400;

interface SettingsContextValue {
  settings: Settings;
  /** Changes settings at once on this screen and saves them for the user. */
  update(patch: Partial<Settings>): void;
}

const SettingsContext = createContext<SettingsContextValue | null>(null);

export function useSettings(): SettingsContextValue {
  const value = useContext(SettingsContext);
  if (!value) throw new Error("useSettings needs a SettingsProvider");
  return value;
}

/** The columns of `user_settings`, for only the settings that changed. */
function toRow(patch: Partial<Settings>) {
  return {
    ...(patch.speed !== undefined && { speed: patch.speed }),
    ...(patch.fontSize !== undefined && { font_size: patch.fontSize }),
    ...(patch.theme !== undefined && { theme: patch.theme }),
  };
}

export function SettingsProvider({
  initial,
  themeSaved,
  children,
}: {
  initial: Settings;
  /** Whether the user has saved a theme; if not, this browser's own choice stands. */
  themeSaved: boolean;
  children: React.ReactNode;
}) {
  const [settings, setSettings] = useState(initial);
  const { setTheme } = useTheme();
  const unsaved = useRef<Partial<Settings>>({});
  const timer = useRef<number>(undefined);
  // Writes go out one after another, so an older one cannot land after a newer one.
  const writes = useRef<Promise<unknown>>(Promise.resolve());

  // The theme the user saved wins over what this browser remembered, so it is
  // the same on every device. Once: a later refresh must not undo a change
  // that has not been saved yet.
  const themeApplied = useRef(false);
  useEffect(() => {
    if (themeApplied.current) return;
    themeApplied.current = true;
    if (themeSaved) setTheme(initial.theme);
  }, [initial.theme, themeSaved, setTheme]);

  const flush = useCallback(async () => {
    window.clearTimeout(timer.current);
    const patch = unsaved.current;
    if (Object.keys(patch).length === 0) return;
    unsaved.current = {};
    // Only the changed columns are sent, so a change on this device does not
    // overwrite one made on another with an old value.
    const write = writes.current.then(async () => {
      const { error } = await createClient()
        .from("user_settings")
        .upsert(toRow(patch), { onConflict: "user_id" });
      // Try again with the next change, keeping anything changed since.
      if (error) unsaved.current = { ...patch, ...unsaved.current };
    });
    writes.current = write;
    await write;
  }, []);

  useEffect(() => {
    const onHide = () => {
      if (document.visibilityState === "hidden") void flush();
    };
    document.addEventListener("visibilitychange", onHide);
    return () => {
      document.removeEventListener("visibilitychange", onHide);
      void flush();
    };
  }, [flush]);

  const update = useCallback(
    (patch: Partial<Settings>) => {
      setSettings((current) => ({ ...current, ...patch }));
      unsaved.current = { ...unsaved.current, ...patch };
      window.clearTimeout(timer.current);
      timer.current = window.setTimeout(() => void flush(), SAVE_DELAY_MS);
    },
    [flush],
  );

  const value = useMemo(() => ({ settings, update }), [settings, update]);
  return <SettingsContext.Provider value={value}>{children}</SettingsContext.Provider>;
}
