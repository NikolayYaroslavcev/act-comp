"use client";

import { useEffect, useRef } from "react";

/** Idle (no pointer/keyboard) before an auto-pause while the tab stays visible. */
export const TIMER_IDLE_PAUSE_MS = 5 * 60 * 1000;

interface UseTimerInactivityPauseOptions {
  enabled: boolean;
  onPause: () => void;
}

/**
 * Auto-pauses a running timer when the tab is hidden or the user is idle.
 * Does not pause on window blur (switching to another window while this tab
 * is still visible is not treated as inactivity).
 */
export function useTimerInactivityPause({ enabled, onPause }: UseTimerInactivityPauseOptions): void {
  const onPauseRef = useRef(onPause);

  useEffect(() => {
    onPauseRef.current = onPause;
  }, [onPause]);

  useEffect(() => {
    if (!enabled) {
      return;
    }

    let pauseRequested = false;
    const pauseOnce = () => {
      if (pauseRequested) {
        return;
      }
      pauseRequested = true;
      onPauseRef.current();
    };

    const onVisibilityChange = () => {
      if (document.visibilityState === "hidden") {
        pauseOnce();
      }
    };

    let idleTimer = window.setTimeout(pauseOnce, TIMER_IDLE_PAUSE_MS);
    const bumpIdle = () => {
      if (pauseRequested) {
        return;
      }
      window.clearTimeout(idleTimer);
      idleTimer = window.setTimeout(pauseOnce, TIMER_IDLE_PAUSE_MS);
    };

    document.addEventListener("visibilitychange", onVisibilityChange);
    window.addEventListener("pointerdown", bumpIdle);
    window.addEventListener("keydown", bumpIdle);

    return () => {
      window.clearTimeout(idleTimer);
      document.removeEventListener("visibilitychange", onVisibilityChange);
      window.removeEventListener("pointerdown", bumpIdle);
      window.removeEventListener("keydown", bumpIdle);
    };
  }, [enabled]);
}
