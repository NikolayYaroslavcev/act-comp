import { act, renderHook } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { useDuplicateList } from "@/features/list/use-duplicate-list";
import type { TaskList } from "@/entities/list/schema";

function jsonResponse(status: number, body: unknown) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json" },
  });
}

function makeList(overrides: Partial<TaskList>): TaskList {
  return {
    id: "l2-copy",
    ownerId: "u1",
    title: "List (копия)",
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

describe("useDuplicateList", () => {
  it("POSTs /api/lists/:id/duplicate with the chosen options and returns the new list", async () => {
    const duplicated = makeList({ id: "l7-copy" });
    const fetchMock = vi.fn().mockResolvedValue(jsonResponse(201, { data: duplicated }));
    vi.stubGlobal("fetch", fetchMock);

    const { result } = renderHook(() => useDuplicateList());

    let returned: unknown;
    await act(async () => {
      returned = await result.current.duplicateList("l7", { copyTasks: true, copySharedWith: false });
    });

    expect(returned).toEqual(duplicated);
    expect(result.current.isPending).toBe(false);
    expect(result.current.error).toBeNull();
    expect(fetchMock).toHaveBeenCalledWith(
      "/api/lists/l7/duplicate",
      expect.objectContaining({
        method: "POST",
        body: JSON.stringify({ copyTasks: true, copySharedWith: false }),
      }),
    );
  });

  it("sets isPending while the request is in flight", async () => {
    let resolveFetch: (value: Response) => void = () => {};
    const pending = new Promise<Response>((resolve) => {
      resolveFetch = resolve;
    });
    vi.stubGlobal("fetch", vi.fn().mockReturnValue(pending));

    const { result } = renderHook(() => useDuplicateList());

    let duplicatePromise!: Promise<unknown>;
    act(() => {
      duplicatePromise = result.current.duplicateList("l7", { copyTasks: false, copySharedWith: false });
    });

    expect(result.current.isPending).toBe(true);

    resolveFetch(jsonResponse(201, { data: makeList({}) }));
    await act(async () => {
      await duplicatePromise;
    });

    expect(result.current.isPending).toBe(false);
  });

  it("ignores a second call while a duplicate request is still pending", async () => {
    let resolveFetch: (value: Response) => void = () => {};
    const pending = new Promise<Response>((resolve) => {
      resolveFetch = resolve;
    });
    const fetchMock = vi.fn().mockReturnValue(pending);
    vi.stubGlobal("fetch", fetchMock);

    const { result } = renderHook(() => useDuplicateList());

    let firstCall!: Promise<unknown>;
    let secondCall!: Promise<unknown>;
    act(() => {
      firstCall = result.current.duplicateList("l7", { copyTasks: false, copySharedWith: false });
      secondCall = result.current.duplicateList("l7", { copyTasks: false, copySharedWith: false });
    });

    expect(fetchMock).toHaveBeenCalledTimes(1);

    resolveFetch(jsonResponse(201, { data: makeList({}) }));
    await act(async () => {
      await Promise.all([firstCall, secondCall]);
    });

    expect(await secondCall).toBeNull();
  });

  it("shows a session-expired message for a 401 response", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(jsonResponse(401, { error: { message: "Unauthorized" } })));

    const { result } = renderHook(() => useDuplicateList());

    await act(async () => {
      await result.current.duplicateList("l7", { copyTasks: false, copySharedWith: false });
    });

    expect(result.current.error).toBe("Сессия истекла. Войдите снова");
  });

  it("shows a not-found message for a 404 response", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(jsonResponse(404, { error: { message: "List not found" } })));

    const { result } = renderHook(() => useDuplicateList());

    await act(async () => {
      await result.current.duplicateList("does-not-exist", { copyTasks: false, copySharedWith: false });
    });

    expect(result.current.error).toMatch(/не найден/i);
  });

  it("shows a network error message when the request fails outright", async () => {
    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new TypeError("Failed to fetch")));

    const { result } = renderHook(() => useDuplicateList());

    await act(async () => {
      await result.current.duplicateList("l7", { copyTasks: false, copySharedWith: false });
    });

    expect(result.current.error).toBe("Не удалось соединиться с сервером. Проверьте подключение к интернету");
    expect(result.current.isPending).toBe(false);
  });

  it("shows a generic message for an unexpected server error", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(jsonResponse(500, {})));

    const { result } = renderHook(() => useDuplicateList());

    await act(async () => {
      await result.current.duplicateList("l7", { copyTasks: false, copySharedWith: false });
    });

    expect(result.current.error).toBe("Что-то пошло не так. Попробуйте ещё раз");
  });
});
