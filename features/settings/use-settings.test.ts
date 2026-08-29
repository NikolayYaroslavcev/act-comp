import { act, renderHook, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { useSettings } from "@/features/settings/use-settings";
import type { Settings } from "@/entities/user/schema";

const SETTINGS: Settings = {
  theme: "system",
  workDayHours: 8,
  notifications: {
    deadlineReminders: true,
    timeThresholdAlerts: true,
    workHoursRecalculation: true,
    otherUserChanges: true,
  },
  taskDefaults: { priority: 3, category: null, estimatedMin: 60 },
};

function jsonResponse(status: number, body: unknown) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json" },
  });
}

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("useSettings", () => {
  it("returns updated settings and clears pending state on success", async () => {
    const next = { ...SETTINGS, theme: "dark" as const };
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(jsonResponse(200, { data: next })));

    const { result } = renderHook(() => useSettings());

    let returned: unknown;
    await act(async () => {
      returned = await result.current.updateSettings({ theme: "dark" });
    });

    expect(returned).toEqual(next);
    expect(result.current.isPending).toBe(false);
    expect(result.current.error).toBeNull();
    expect(fetch).toHaveBeenCalledWith(
      "/api/settings",
      expect.objectContaining({
        method: "PATCH",
        body: JSON.stringify({ theme: "dark" }),
      }),
    );
  });

  it("sets isPending while the request is in flight", async () => {
    let resolveFetch: (value: Response) => void = () => {};
    const pending = new Promise<Response>((resolve) => {
      resolveFetch = resolve;
    });
    vi.stubGlobal("fetch", vi.fn().mockReturnValue(pending));

    const { result } = renderHook(() => useSettings());

    let updatePromise!: Promise<unknown>;
    act(() => {
      updatePromise = result.current.updateSettings({ theme: "dark" });
    });

    await waitFor(() => expect(result.current.isPending).toBe(true));

    resolveFetch(jsonResponse(200, { data: SETTINGS }));
    await act(async () => {
      await updatePromise;
    });

    expect(result.current.isPending).toBe(false);
  });

  it("shows a session-expired message for a 401 response", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(jsonResponse(401, { error: { message: "x" } })));

    const { result } = renderHook(() => useSettings());

    let returned: unknown;
    await act(async () => {
      returned = await result.current.updateSettings({ theme: "dark" });
    });

    expect(returned).toBeNull();
    expect(result.current.error).toBe("Сессия истекла. Войдите снова");
  });

  it("shows a validation message for a 400 response", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(jsonResponse(400, { error: { message: "x" } })));

    const { result } = renderHook(() => useSettings());

    await act(async () => {
      await result.current.updateSettings({ theme: "dark" });
    });

    expect(result.current.error).toBe("Проверьте правильность заполнения формы");
  });

  it("shows a network error message when the request fails outright", async () => {
    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new TypeError("Failed to fetch")));

    const { result } = renderHook(() => useSettings());

    await act(async () => {
      await result.current.updateSettings({ theme: "dark" });
    });

    expect(result.current.error).toBe(
      "Не удалось соединиться с сервером. Проверьте подключение к интернету",
    );
  });

  it("shows a generic message for an unexpected server error", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(jsonResponse(500, {})));

    const { result } = renderHook(() => useSettings());

    await act(async () => {
      await result.current.updateSettings({ theme: "dark" });
    });

    expect(result.current.error).toBe("Что-то пошло не так. Попробуйте ещё раз");
  });
});
