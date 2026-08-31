import { act, renderHook } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { useDeleteList } from "@/features/list/use-delete-list";
import type { TaskList } from "@/entities/list/schema";

function jsonResponse(status: number, body: unknown) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json" },
  });
}

function makeList(overrides: Partial<TaskList>): TaskList {
  return {
    id: "l2",
    ownerId: "u1",
    title: "List",
    template: "work",
    taskIds: [],
    deadline: null,
    sharedWith: [],
    history: [],
    deletedAt: "2026-08-20T00:00:00.000Z",
    lastActivityAt: "2026-08-01T00:00:00.000Z",
    ...overrides,
  };
}

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("useDeleteList", () => {
  it("DELETEs /api/lists/:id and returns the deleted list on success", async () => {
    const deleted = makeList({ id: "l7" });
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(jsonResponse(200, { data: deleted })));

    const { result } = renderHook(() => useDeleteList());

    let returned: unknown;
    await act(async () => {
      returned = await result.current.deleteList("l7");
    });

    expect(returned).toEqual(deleted);
    expect(result.current.isPending).toBe(false);
    expect(result.current.error).toBeNull();
    expect(fetch).toHaveBeenCalledWith("/api/lists/l7", expect.objectContaining({ method: "DELETE" }));
  });

  it("sets isPending while the request is in flight", async () => {
    let resolveFetch: (value: Response) => void = () => {};
    const pending = new Promise<Response>((resolve) => {
      resolveFetch = resolve;
    });
    vi.stubGlobal("fetch", vi.fn().mockReturnValue(pending));

    const { result } = renderHook(() => useDeleteList());

    let deletePromise!: Promise<unknown>;
    act(() => {
      deletePromise = result.current.deleteList("l7");
    });

    expect(result.current.isPending).toBe(true);

    resolveFetch(jsonResponse(200, { data: makeList({}) }));
    await act(async () => {
      await deletePromise;
    });

    expect(result.current.isPending).toBe(false);
  });

  it("ignores a second call while a delete request is still pending", async () => {
    let resolveFetch: (value: Response) => void = () => {};
    const pending = new Promise<Response>((resolve) => {
      resolveFetch = resolve;
    });
    const fetchMock = vi.fn().mockReturnValue(pending);
    vi.stubGlobal("fetch", fetchMock);

    const { result } = renderHook(() => useDeleteList());

    let firstCall!: Promise<unknown>;
    let secondCall!: Promise<unknown>;
    act(() => {
      firstCall = result.current.deleteList("l7");
      secondCall = result.current.deleteList("l7");
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

    const { result } = renderHook(() => useDeleteList());

    await act(async () => {
      await result.current.deleteList("l7");
    });

    expect(result.current.error).toBe("Сессия истекла. Войдите снова");
  });

  it("shows a permission message for a 403 response", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(jsonResponse(403, { error: { message: "You do not have permission to delete this list" } })),
    );

    const { result } = renderHook(() => useDeleteList());

    await act(async () => {
      await result.current.deleteList("l7");
    });

    expect(result.current.error).toMatch(/прав/i);
  });

  it("shows a not-found message for a 404 response", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(jsonResponse(404, { error: { message: "List not found" } })));

    const { result } = renderHook(() => useDeleteList());

    await act(async () => {
      await result.current.deleteList("does-not-exist");
    });

    expect(result.current.error).toMatch(/не найден/i);
  });

  it("shows a network error message when the request fails outright", async () => {
    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new TypeError("Failed to fetch")));

    const { result } = renderHook(() => useDeleteList());

    await act(async () => {
      await result.current.deleteList("l7");
    });

    expect(result.current.error).toBe("Не удалось соединиться с сервером. Проверьте подключение к интернету");
    expect(result.current.isPending).toBe(false);
  });

  it("shows a generic message for an unexpected server error", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(jsonResponse(500, {})));

    const { result } = renderHook(() => useDeleteList());

    await act(async () => {
      await result.current.deleteList("l7");
    });

    expect(result.current.error).toBe("Что-то пошло не так. Попробуйте ещё раз");
  });

  it("shows a generic message when the success response has no data", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(jsonResponse(200, {})));

    const { result } = renderHook(() => useDeleteList());

    let returned: unknown;
    await act(async () => {
      returned = await result.current.deleteList("l7");
    });

    expect(returned).toBeNull();
    expect(result.current.error).toBe("Что-то пошло не так. Попробуйте ещё раз");
  });
});
