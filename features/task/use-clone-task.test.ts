import { act, renderHook } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { useCloneTask } from "@/features/task/use-clone-task";
import type { Task } from "@/entities/task/schema";

function jsonResponse(status: number, body: unknown) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json" },
  });
}

function makeTask(overrides: Partial<Task>): Task {
  return {
    id: "t2",
    listId: "l1",
    code: "TEST-2",
    title: "Task",
    description: "",
    status: "new",
    priority: 3,
    category: null,
    tags: [],
    dependsOn: [],
    parentId: null,
    subtaskIds: [],
    deadline: null,
    createdAt: "2026-08-01T00:00:00.000Z",
    estimatedMin: 0,
    timeSpentMin: 0,
    timerStartedAt: null,
    timerPausedAt: null,
    extensions: [],
    history: [],
    deletedAt: null,
    ...overrides,
  };
}

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("useCloneTask", () => {
  it("POSTs to the clone endpoint and returns the created task on success", async () => {
    const clonedTask = makeTask({ id: "t2", code: "TEST-2" });
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(jsonResponse(201, { data: clonedTask })));

    const { result } = renderHook(() => useCloneTask());

    let returned: unknown;
    await act(async () => {
      returned = await result.current.cloneTask("t1");
    });

    expect(returned).toEqual(clonedTask);
    expect(result.current.isPending).toBe(false);
    expect(result.current.error).toBeNull();
    expect(fetch).toHaveBeenCalledWith("/api/tasks/t1/clone", expect.objectContaining({ method: "POST" }));
  });

  it("sets isPending while the request is in flight", async () => {
    let resolveFetch: (value: Response) => void = () => {};
    const pending = new Promise<Response>((resolve) => {
      resolveFetch = resolve;
    });
    vi.stubGlobal("fetch", vi.fn().mockReturnValue(pending));

    const { result } = renderHook(() => useCloneTask());

    let clonePromise!: Promise<unknown>;
    act(() => {
      clonePromise = result.current.cloneTask("t1");
    });

    expect(result.current.isPending).toBe(true);

    resolveFetch(jsonResponse(201, { data: makeTask({}) }));
    await act(async () => {
      await clonePromise;
    });

    expect(result.current.isPending).toBe(false);
  });

  it("ignores a second call while a clone request is still pending", async () => {
    let resolveFetch: (value: Response) => void = () => {};
    const pending = new Promise<Response>((resolve) => {
      resolveFetch = resolve;
    });
    const fetchMock = vi.fn().mockReturnValue(pending);
    vi.stubGlobal("fetch", fetchMock);

    const { result } = renderHook(() => useCloneTask());

    let firstCall!: Promise<unknown>;
    let secondCall!: Promise<unknown>;
    act(() => {
      firstCall = result.current.cloneTask("t1");
      secondCall = result.current.cloneTask("t1");
    });

    expect(fetchMock).toHaveBeenCalledTimes(1);

    resolveFetch(jsonResponse(201, { data: makeTask({}) }));
    await act(async () => {
      await Promise.all([firstCall, secondCall]);
    });

    expect(await secondCall).toBeNull();
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it("shows a session-expired message for a 401 response", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(jsonResponse(401, { error: { message: "Unauthorized" } })));

    const { result } = renderHook(() => useCloneTask());

    let returned: unknown;
    await act(async () => {
      returned = await result.current.cloneTask("t1");
    });

    expect(returned).toBeNull();
    expect(result.current.error).toBe("Сессия истекла. Войдите снова");
  });

  it("shows a forbidden message for a 403 response", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(jsonResponse(403, { error: { message: "You do not have permission to clone this task" } })),
    );

    const { result } = renderHook(() => useCloneTask());

    await act(async () => {
      await result.current.cloneTask("t1");
    });

    expect(result.current.error).toBe("У вас нет прав на клонирование этой задачи");
  });

  it("shows a not-found message for a 404 response", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(jsonResponse(404, { error: { message: "Task not found" } })));

    const { result } = renderHook(() => useCloneTask());

    await act(async () => {
      await result.current.cloneTask("t1");
    });

    expect(result.current.error).toBe("Задача недоступна или была удалена");
  });

  it("shows a network error message when the request fails outright", async () => {
    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new TypeError("Failed to fetch")));

    const { result } = renderHook(() => useCloneTask());

    await act(async () => {
      await result.current.cloneTask("t1");
    });

    expect(result.current.error).toBe("Не удалось соединиться с сервером. Проверьте подключение к интернету");
    expect(result.current.isPending).toBe(false);
  });

  it("shows a generic message for an unexpected server error", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(jsonResponse(500, {})));

    const { result } = renderHook(() => useCloneTask());

    await act(async () => {
      await result.current.cloneTask("t1");
    });

    expect(result.current.error).toBe("Что-то пошло не так. Попробуйте ещё раз");
  });

  it("shows a generic message when the success response has no data", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(jsonResponse(201, {})));

    const { result } = renderHook(() => useCloneTask());

    let returned: unknown;
    await act(async () => {
      returned = await result.current.cloneTask("t1");
    });

    expect(returned).toBeNull();
    expect(result.current.error).toBe("Что-то пошло не так. Попробуйте ещё раз");
  });
});
