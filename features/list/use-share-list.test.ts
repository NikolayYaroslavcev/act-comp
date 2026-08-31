import { act, renderHook } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { useShareList } from "@/features/list/use-share-list";
import type { TaskList } from "@/entities/list/schema";

function jsonResponse(status: number, body: unknown) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json" },
  });
}

function makeList(overrides: Partial<TaskList> = {}): TaskList {
  return {
    id: "l1",
    ownerId: "u1",
    title: "Sprint",
    template: "work",
    taskIds: [],
    deadline: null,
    sharedWith: [{ userId: "u2", access: "read" }],
    history: [],
    deletedAt: null,
    lastActivityAt: "2026-08-01T00:00:00.000Z",
    ...overrides,
  };
}

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("useShareList", () => {
  it("POSTs /api/lists/:id/share with the given input and returns the updated list", async () => {
    const updated = makeList({ sharedWith: [{ userId: "u2", access: "edit" }] });
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(jsonResponse(200, { data: updated })));

    const { result } = renderHook(() => useShareList());

    let returned: unknown;
    await act(async () => {
      returned = await result.current.shareList("l1", { userId: "u2", access: "edit" });
    });

    expect(returned).toEqual(updated);
    expect(result.current.isPending).toBe(false);
    expect(result.current.error).toBeNull();
    expect(fetch).toHaveBeenCalledWith(
      "/api/lists/l1/share",
      expect.objectContaining({
        method: "POST",
        body: JSON.stringify({ userId: "u2", access: "edit" }),
      }),
    );
  });

  it("does not send an ownerId field in the request body", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(jsonResponse(200, { data: makeList() })));
    const { result } = renderHook(() => useShareList());

    await act(async () => {
      await result.current.shareList("l1", { email: "user@example.com", access: "read" });
    });

    const body = JSON.parse((fetch as ReturnType<typeof vi.fn>).mock.calls[0][1].body as string) as Record<
      string,
      unknown
    >;
    expect(body).not.toHaveProperty("ownerId");
    expect(body).toEqual({ email: "user@example.com", access: "read" });
  });

  it("sets isPending while the request is in flight", async () => {
    let resolveFetch: (value: Response) => void = () => {};
    const pending = new Promise<Response>((resolve) => {
      resolveFetch = resolve;
    });
    vi.stubGlobal("fetch", vi.fn().mockReturnValue(pending));

    const { result } = renderHook(() => useShareList());

    let sharePromise!: Promise<unknown>;
    act(() => {
      sharePromise = result.current.shareList("l1", { userId: "u2", access: "read" });
    });

    expect(result.current.isPending).toBe(true);

    resolveFetch(jsonResponse(200, { data: makeList() }));
    await act(async () => {
      await sharePromise;
    });

    expect(result.current.isPending).toBe(false);
  });

  it("ignores a second call while a share request is still pending", async () => {
    let resolveFetch: (value: Response) => void = () => {};
    const pending = new Promise<Response>((resolve) => {
      resolveFetch = resolve;
    });
    const fetchMock = vi.fn().mockReturnValue(pending);
    vi.stubGlobal("fetch", fetchMock);

    const { result } = renderHook(() => useShareList());

    let firstCall!: Promise<unknown>;
    let secondCall!: Promise<unknown>;
    act(() => {
      firstCall = result.current.shareList("l1", { userId: "u2", access: "read" });
      secondCall = result.current.shareList("l1", { userId: "u3", access: "edit" });
    });

    expect(fetchMock).toHaveBeenCalledTimes(1);

    resolveFetch(jsonResponse(200, { data: makeList() }));
    await act(async () => {
      await Promise.all([firstCall, secondCall]);
    });

    expect(await secondCall).toBeNull();
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it("shows a validation message for a 400 response", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(jsonResponse(400, { error: { message: "Validation failed" } })));
    const { result } = renderHook(() => useShareList());

    await act(async () => {
      await result.current.shareList("l1", { access: "read" } as never);
    });

    expect(result.current.error).toMatch(/заполнения/i);
  });

  it("shows a dedicated message when the owner tries to share with themselves", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(jsonResponse(400, { error: { message: "Cannot share a list with yourself" } })),
    );
    const { result } = renderHook(() => useShareList());

    await act(async () => {
      await result.current.shareList("l1", { userId: "u1", access: "read" });
    });

    expect(result.current.error).toMatch(/самому себе/i);
  });

  it("shows a session-expired message for a 401 response", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(jsonResponse(401, { error: { message: "Unauthorized" } })));
    const { result } = renderHook(() => useShareList());

    await act(async () => {
      await result.current.shareList("l1", { userId: "u2", access: "read" });
    });

    expect(result.current.error).toBe("Сессия истекла. Войдите снова");
  });

  it("shows a permission message for a 403 response", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(
        jsonResponse(403, { error: { message: "Only the owner can manage sharing for this list" } }),
      ),
    );
    const { result } = renderHook(() => useShareList());

    await act(async () => {
      await result.current.shareList("l1", { userId: "u2", access: "read" });
    });

    expect(result.current.error).toMatch(/владелец/i);
  });

  it("shows a generic share-target message when the server cannot resolve the user", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(
        jsonResponse(400, { error: { message: "Unable to share this list with the specified user" } }),
      ),
    );
    const { result } = renderHook(() => useShareList());

    await act(async () => {
      await result.current.shareList("l1", { userId: "nobody", access: "read" });
    });

    expect(result.current.error).toMatch(/не удалось выдать доступ/i);
  });

  it("shows a list-not-found message for a 404 targeting a missing list", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(jsonResponse(404, { error: { message: "List not found" } })));
    const { result } = renderHook(() => useShareList());

    await act(async () => {
      await result.current.shareList("missing", { userId: "u2", access: "read" });
    });

    expect(result.current.error).toMatch(/список не найден/i);
  });

  it("shows a conflict message for a 409 response", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(jsonResponse(409, { error: { message: "Conflict" } })));
    const { result } = renderHook(() => useShareList());

    await act(async () => {
      await result.current.shareList("l1", { userId: "u2", access: "read" });
    });

    expect(result.current.error).toMatch(/конфликт/i);
  });

  it("shows a network error message when the request fails outright", async () => {
    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new TypeError("Failed to fetch")));
    const { result } = renderHook(() => useShareList());

    await act(async () => {
      await result.current.shareList("l1", { userId: "u2", access: "read" });
    });

    expect(result.current.error).toBe("Не удалось соединиться с сервером. Проверьте подключение к интернету");
    expect(result.current.isPending).toBe(false);
  });

  it("shows a generic message for an unexpected server error", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(jsonResponse(500, {})));
    const { result } = renderHook(() => useShareList());

    await act(async () => {
      await result.current.shareList("l1", { userId: "u2", access: "read" });
    });

    expect(result.current.error).toBe("Что-то пошло не так. Попробуйте ещё раз");
  });
});
