import { act, renderHook } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { TIMER_IDLE_PAUSE_MS, useTimerInactivityPause } from "./use-timer-inactivity-pause";

function setVisibility(state: DocumentVisibilityState) {
  Object.defineProperty(document, "visibilityState", {
    configurable: true,
    value: state,
  });
  document.dispatchEvent(new Event("visibilitychange"));
}

describe("useTimerInactivityPause", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    setVisibility("visible");
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("pauses a running timer when the document becomes hidden", () => {
    const onPause = vi.fn();
    renderHook(() => useTimerInactivityPause({ enabled: true, onPause }));

    act(() => {
      setVisibility("hidden");
    });

    expect(onPause).toHaveBeenCalledTimes(1);
  });

  it("does not pause on window blur while the document stays visible", () => {
    const onPause = vi.fn();
    renderHook(() => useTimerInactivityPause({ enabled: true, onPause }));

    act(() => {
      window.dispatchEvent(new Event("blur"));
    });

    expect(onPause).not.toHaveBeenCalled();
  });

  it("pauses after the idle timeout with no user activity", () => {
    const onPause = vi.fn();
    renderHook(() => useTimerInactivityPause({ enabled: true, onPause }));

    act(() => {
      vi.advanceTimersByTime(TIMER_IDLE_PAUSE_MS - 1);
    });
    expect(onPause).not.toHaveBeenCalled();

    act(() => {
      vi.advanceTimersByTime(1);
    });
    expect(onPause).toHaveBeenCalledTimes(1);
  });

  it("resets the idle timeout on pointer activity", () => {
    const onPause = vi.fn();
    renderHook(() => useTimerInactivityPause({ enabled: true, onPause }));

    act(() => {
      vi.advanceTimersByTime(TIMER_IDLE_PAUSE_MS - 1);
      window.dispatchEvent(new Event("pointerdown"));
      vi.advanceTimersByTime(TIMER_IDLE_PAUSE_MS - 1);
    });

    expect(onPause).not.toHaveBeenCalled();

    act(() => {
      vi.advanceTimersByTime(1);
    });
    expect(onPause).toHaveBeenCalledTimes(1);
  });

  it("does not pause when the timer is not running", () => {
    const onPause = vi.fn();
    renderHook(() => useTimerInactivityPause({ enabled: false, onPause }));

    act(() => {
      setVisibility("hidden");
      vi.advanceTimersByTime(TIMER_IDLE_PAUSE_MS);
    });

    expect(onPause).not.toHaveBeenCalled();
  });

  it("does not send a second pause for a repeated visibilitychange while still pending", () => {
    const onPause = vi.fn();
    renderHook(() => useTimerInactivityPause({ enabled: true, onPause }));

    act(() => {
      setVisibility("hidden");
      setVisibility("hidden");
    });

    expect(onPause).toHaveBeenCalledTimes(1);
  });

  it("clears the idle timer on unmount", () => {
    const onPause = vi.fn();
    const { unmount } = renderHook(() => useTimerInactivityPause({ enabled: true, onPause }));

    unmount();
    act(() => {
      vi.advanceTimersByTime(TIMER_IDLE_PAUSE_MS);
    });

    expect(onPause).not.toHaveBeenCalled();
  });
});
