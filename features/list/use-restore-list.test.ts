import { act, renderHook } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { useRestoreList } from "@/features/list/use-restore-list";
import type { TaskList } from "@/entities/list/schema";

function jsonResponse(status: number, body: unknown) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json" },
  });
}

function makeList(overrides: Partial<TaskList>): TaskList {
  return {
    id: "l4",
    ownerId: "u1",
    title: "List",
    template: "work",
    taskIds: [],
    deadline: null,
    sharedWith: [],
    history: [],
    deletedAt: null,
    lastActivityAt: "2026-08-01T00:00:00.000Z",
    ...overrides,
  };
}

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("useRestoreList", () => {
  it("POSTs to /api/lists/:id/restore and returns the restored list on success", async () => {
    const restored = makeList({ id: "l4" });
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(jsonResponse(200, { data: restored })));

    const { result } = renderHook(() => useRestoreList());

    let returned: unknown;
    await act(async () => {
      returned = await result.current.restoreList("l4");
    });

    expect(returned).toEqual(restored);
    expect(result.current.isPending).toBe(false);
    expect(result.current.error).toBeNull();
    expect(fetch).toHaveBeenCalledWith("/api/lists/l4/restore", expect.objectContaining({ method: "POST" }));
  });

  it("sets isPending while the request is in flight", async () => {
    let resolveFetch: (value: Response) => void = () => {};
    const pending = new Promise<Response>((resolve) => {
      resolveFetch = resolve;
    });
    vi.stubGlobal("fetch", vi.fn().mockReturnValue(pending));

    const { result } = renderHook(() => useRestoreList());

    let restorePromise!: Promise<unknown>;
    act(() => {
      restorePromise = result.current.restoreList("l4");
    });

    expect(result.current.isPending).toBe(true);

    resolveFetch(jsonResponse(200, { data: makeList({}) }));
    await act(async () => {
      await restorePromise;
    });

    expect(result.current.isPending).toBe(false);
  });

  it("ignores a second call while a restore request is still pending", async () => {
    let resolveFetch: (value: Response) => void = () => {};
    const pending = new Promise<Response>((resolve) => {
      resolveFetch = resolve;
    });
    const fetchMock = vi.fn().mockReturnValue(pending);
    vi.stubGlobal("fetch", fetchMock);

    const { result } = renderHook(() => useRestoreList());

    let firstCall!: Promise<unknown>;
    let secondCall!: Promise<unknown>;
    act(() => {
      firstCall = result.current.restoreList("l4");
      secondCall = result.current.restoreList("l4");
    });

    expect(fetchMock).toHaveBeenCalledTimes(1);

    resolveFetch(jsonResponse(200, { data: makeList({}) }));
    await act(async () => {
      await Promise.all([firstCall, secondCall]);
    });

    expect(await secondCall).toBeNull();
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it("shows a session-expired message for a 401 response", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(jsonResponse(401, { error: { message: "Unauthorized" } })));

    const { result } = renderHook(() => useRestoreList());

    await act(async () => {
      await result.current.restoreList("l4");
    });

    expect(result.current.error).toBe("Сессия истекла. Войдите снова");
  });

  it("shows a permission message for a 403 response", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(jsonResponse(403, { error: { message: "You do not have permission to restore this list" } })),
    );

    const { result } = renderHook(() => useRestoreList());

    await act(async () => {
      await result.current.restoreList("l4");
    });

    expect(result.current.error).toMatch(/прав/i);
  });

  it("shows a not-found message for a 404 response", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(jsonResponse(404, { error: { message: "List not found" } })));

    const { result } = renderHook(() => useRestoreList());

    await act(async () => {
      await result.current.restoreList("does-not-exist");
    });

    expect(result.current.error).toMatch(/не найден/i);
  });

  it("shows an expired-window message for a 409 response", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(jsonResponse(409, { error: { message: "The 30-day restore window for this list has expired" } })),
    );

    const { result } = renderHook(() => useRestoreList());

    await act(async () => {
      await result.current.restoreList("l4");
    });

    expect(result.current.error).toMatch(/30/);
  });

  it("shows a network error message when the request fails outright", async () => {
    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new TypeError("Failed to fetch")));

    const { result } = renderHook(() => useRestoreList());

    await act(async () => {
      await result.current.restoreList("l4");
    });

    expect(result.current.error).toBe("Не удалось соединиться с сервером. Проверьте подключение к интернету");
    expect(result.current.isPending).toBe(false);
  });

  it("shows a generic message for an unexpected server error", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(jsonResponse(500, {})));

    const { result } = renderHook(() => useRestoreList());

    await act(async () => {
      await result.current.restoreList("l4");
    });

    expect(result.current.error).toBe("Что-то пошло не так. Попробуйте ещё раз");
  });

  it("shows a generic message when the success response has no data", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(jsonResponse(200, {})));

    const { result } = renderHook(() => useRestoreList());

    let returned: unknown;
    await act(async () => {
      returned = await result.current.restoreList("l4");
    });

    expect(returned).toBeNull();
    expect(result.current.error).toBe("Что-то пошло не так. Попробуйте ещё раз");
  });
});
