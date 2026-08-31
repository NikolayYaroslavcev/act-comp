import { act, renderHook } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { useCreateList } from "@/features/list/use-create-list";
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
    deletedAt: null,
    lastActivityAt: "2026-08-01T00:00:00.000Z",
    ...overrides,
  };
}

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("useCreateList", () => {
  it("POSTs to /api/lists and returns the created list on success", async () => {
    const created = makeList({ id: "l2", title: "New list" });
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(jsonResponse(201, { data: created })));

    const { result } = renderHook(() => useCreateList());

    let returned: unknown;
    await act(async () => {
      returned = await result.current.createList({ title: "New list", template: "work", deadline: null });
    });

    expect(returned).toEqual(created);
    expect(result.current.isPending).toBe(false);
    expect(result.current.error).toBeNull();
    expect(fetch).toHaveBeenCalledWith(
      "/api/lists",
      expect.objectContaining({
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ title: "New list", template: "work", deadline: null }),
      }),
    );
  });

  it("sets isPending while the request is in flight", async () => {
    let resolveFetch: (value: Response) => void = () => {};
    const pending = new Promise<Response>((resolve) => {
      resolveFetch = resolve;
    });
    vi.stubGlobal("fetch", vi.fn().mockReturnValue(pending));

    const { result } = renderHook(() => useCreateList());

    let createPromise!: Promise<unknown>;
    act(() => {
      createPromise = result.current.createList({ title: "New list", template: "work", deadline: null });
    });

    expect(result.current.isPending).toBe(true);

    resolveFetch(jsonResponse(201, { data: makeList({}) }));
    await act(async () => {
      await createPromise;
    });

    expect(result.current.isPending).toBe(false);
  });

  it("ignores a second call while a create request is still pending", async () => {
    let resolveFetch: (value: Response) => void = () => {};
    const pending = new Promise<Response>((resolve) => {
      resolveFetch = resolve;
    });
    const fetchMock = vi.fn().mockReturnValue(pending);
    vi.stubGlobal("fetch", fetchMock);

    const { result } = renderHook(() => useCreateList());

    let firstCall!: Promise<unknown>;
    let secondCall!: Promise<unknown>;
    act(() => {
      firstCall = result.current.createList({ title: "A", template: "work", deadline: null });
      secondCall = result.current.createList({ title: "B", template: "work", deadline: null });
    });

    expect(fetchMock).toHaveBeenCalledTimes(1);

    resolveFetch(jsonResponse(201, { data: makeList({}) }));
    await act(async () => {
      await Promise.all([firstCall, secondCall]);
    });

    expect(await secondCall).toBeNull();
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it("shows a validation message for a 400 response", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(jsonResponse(400, { error: { message: "Validation failed" } })));

    const { result } = renderHook(() => useCreateList());

    let returned: unknown;
    await act(async () => {
      returned = await result.current.createList({ title: "", template: "work", deadline: null });
    });

    expect(returned).toBeNull();
    expect(result.current.error).toBe("Проверьте правильность заполнения полей");
  });

  it("shows a session-expired message for a 401 response", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(jsonResponse(401, { error: { message: "Unauthorized" } })));

    const { result } = renderHook(() => useCreateList());

    await act(async () => {
      await result.current.createList({ title: "New list", template: "work", deadline: null });
    });

    expect(result.current.error).toBe("Сессия истекла. Войдите снова");
  });

  it("shows a network error message when the request fails outright", async () => {
    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new TypeError("Failed to fetch")));

    const { result } = renderHook(() => useCreateList());

    await act(async () => {
      await result.current.createList({ title: "New list", template: "work", deadline: null });
    });

    expect(result.current.error).toBe("Не удалось соединиться с сервером. Проверьте подключение к интернету");
    expect(result.current.isPending).toBe(false);
  });

  it("shows a generic message for an unexpected server error", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(jsonResponse(500, {})));

    const { result } = renderHook(() => useCreateList());

    await act(async () => {
      await result.current.createList({ title: "New list", template: "work", deadline: null });
    });

    expect(result.current.error).toBe("Что-то пошло не так. Попробуйте ещё раз");
  });

  it("shows a generic message when the success response has no data", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(jsonResponse(201, {})));

    const { result } = renderHook(() => useCreateList());

    let returned: unknown;
    await act(async () => {
      returned = await result.current.createList({ title: "New list", template: "work", deadline: null });
    });

    expect(returned).toBeNull();
    expect(result.current.error).toBe("Что-то пошло не так. Попробуйте ещё раз");
  });
});
