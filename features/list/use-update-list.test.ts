import { act, renderHook } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { useUpdateList } from "@/features/list/use-update-list";
import type { TaskList } from "@/entities/list/schema";

function jsonResponse(status: number, body: unknown) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json" },
  });
}

function makeList(overrides: Partial<TaskList>): TaskList {
  return {
    id: "l7",
    ownerId: "u1",
    title: "New title",
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

describe("useUpdateList", () => {
  it("PATCHes /api/lists/:id with the given input and returns the updated list on success", async () => {
    const updated = makeList({ id: "l7", title: "New title" });
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(jsonResponse(200, { data: updated })));

    const { result } = renderHook(() => useUpdateList());

    let returned: unknown;
    await act(async () => {
      returned = await result.current.updateList("l7", { title: "New title", template: "work", deadline: null });
    });

    expect(returned).toEqual(updated);
    expect(result.current.isPending).toBe(false);
    expect(result.current.error).toBeNull();
    expect(fetch).toHaveBeenCalledWith(
      "/api/lists/l7",
      expect.objectContaining({
        method: "PATCH",
        body: JSON.stringify({ title: "New title", template: "work", deadline: null }),
      }),
    );
  });

  it("sets isPending while the request is in flight", async () => {
    let resolveFetch: (value: Response) => void = () => {};
    const pending = new Promise<Response>((resolve) => {
      resolveFetch = resolve;
    });
    vi.stubGlobal("fetch", vi.fn().mockReturnValue(pending));

    const { result } = renderHook(() => useUpdateList());

    let updatePromise!: Promise<unknown>;
    act(() => {
      updatePromise = result.current.updateList("l7", { title: "New title" });
    });

    expect(result.current.isPending).toBe(true);

    resolveFetch(jsonResponse(200, { data: makeList({}) }));
    await act(async () => {
      await updatePromise;
    });

    expect(result.current.isPending).toBe(false);
  });

  it("ignores a second call while an update request is still pending", async () => {
    let resolveFetch: (value: Response) => void = () => {};
    const pending = new Promise<Response>((resolve) => {
      resolveFetch = resolve;
    });
    const fetchMock = vi.fn().mockReturnValue(pending);
    vi.stubGlobal("fetch", fetchMock);

    const { result } = renderHook(() => useUpdateList());

    let firstCall!: Promise<unknown>;
    let secondCall!: Promise<unknown>;
    act(() => {
      firstCall = result.current.updateList("l7", { title: "A" });
      secondCall = result.current.updateList("l7", { title: "B" });
    });

    expect(fetchMock).toHaveBeenCalledTimes(1);

    resolveFetch(jsonResponse(200, { data: makeList({}) }));
    await act(async () => {
      await Promise.all([firstCall, secondCall]);
    });

    expect(await secondCall).toBeNull();
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it("shows a validation message for a 400 response", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(jsonResponse(400, { error: { message: "Validation failed" } })));

    const { result } = renderHook(() => useUpdateList());

    await act(async () => {
      await result.current.updateList("l7", { template: "hobby" as never });
    });

    expect(result.current.error).toMatch(/заполнения/i);
  });

  it("shows a session-expired message for a 401 response", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(jsonResponse(401, { error: { message: "Unauthorized" } })));

    const { result } = renderHook(() => useUpdateList());

    await act(async () => {
      await result.current.updateList("l7", { title: "New title" });
    });

    expect(result.current.error).toBe("Сессия истекла. Войдите снова");
  });

  it("shows a permission message for a 403 response", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(jsonResponse(403, { error: { message: "You do not have permission to edit this list" } })),
    );

    const { result } = renderHook(() => useUpdateList());

    await act(async () => {
      await result.current.updateList("l7", { title: "New title" });
    });

    expect(result.current.error).toMatch(/прав/i);
  });

  it("shows a not-found message for a 404 response", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(jsonResponse(404, { error: { message: "List not found" } })));

    const { result } = renderHook(() => useUpdateList());

    await act(async () => {
      await result.current.updateList("does-not-exist", { title: "New title" });
    });

    expect(result.current.error).toMatch(/не найден/i);
  });

  it("shows a network error message when the request fails outright", async () => {
    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new TypeError("Failed to fetch")));

    const { result } = renderHook(() => useUpdateList());

    await act(async () => {
      await result.current.updateList("l7", { title: "New title" });
    });

    expect(result.current.error).toBe("Не удалось соединиться с сервером. Проверьте подключение к интернету");
    expect(result.current.isPending).toBe(false);
  });

  it("shows a generic message for an unexpected server error", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(jsonResponse(500, {})));

    const { result } = renderHook(() => useUpdateList());

    await act(async () => {
      await result.current.updateList("l7", { title: "New title" });
    });

    expect(result.current.error).toBe("Что-то пошло не так. Попробуйте ещё раз");
  });

  it("shows a generic message when the success response has no data", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(jsonResponse(200, {})));

    const { result } = renderHook(() => useUpdateList());

    let returned: unknown;
    await act(async () => {
      returned = await result.current.updateList("l7", { title: "New title" });
    });

    expect(returned).toBeNull();
    expect(result.current.error).toBe("Что-то пошло не так. Попробуйте ещё раз");
  });
});
