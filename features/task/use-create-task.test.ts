import { act, renderHook } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { useCreateTask } from "@/features/task/use-create-task";
import type { CreateTaskInput } from "@/entities/task/requests";
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

const INPUT: CreateTaskInput = {
  listId: "l1",
  title: "New task",
  description: "",
  tags: [],
  parentId: null,
  deadline: null,
};

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("useCreateTask", () => {
  it("POSTs to /api/tasks and returns the created task on success", async () => {
    const created = makeTask({ id: "t2", title: "New task" });
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(jsonResponse(201, { data: created })));

    const { result } = renderHook(() => useCreateTask());

    let returned: unknown;
    await act(async () => {
      returned = await result.current.createTask(INPUT);
    });

    expect(returned).toEqual(created);
    expect(result.current.isPending).toBe(false);
    expect(result.current.error).toBeNull();
    expect(fetch).toHaveBeenCalledWith(
      "/api/tasks",
      expect.objectContaining({
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(INPUT),
      }),
    );
  });

  it("sets isPending while the request is in flight", async () => {
    let resolveFetch: (value: Response) => void = () => {};
    const pending = new Promise<Response>((resolve) => {
      resolveFetch = resolve;
    });
    vi.stubGlobal("fetch", vi.fn().mockReturnValue(pending));

    const { result } = renderHook(() => useCreateTask());

    let createPromise!: Promise<unknown>;
    act(() => {
      createPromise = result.current.createTask(INPUT);
    });

    expect(result.current.isPending).toBe(true);

    resolveFetch(jsonResponse(201, { data: makeTask({}) }));
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

    const { result } = renderHook(() => useCreateTask());

    let firstCall!: Promise<unknown>;
    let secondCall!: Promise<unknown>;
    act(() => {
      firstCall = result.current.createTask(INPUT);
      secondCall = result.current.createTask(INPUT);
    });

    expect(fetchMock).toHaveBeenCalledTimes(1);

    resolveFetch(jsonResponse(201, { data: makeTask({}) }));
    await act(async () => {
      await Promise.all([firstCall, secondCall]);
    });

    expect(await secondCall).toBeNull();
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it("shows a validation message for a 400 response", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(jsonResponse(400, { error: { message: "Validation failed" } })));

    const { result } = renderHook(() => useCreateTask());

    let returned: unknown;
    await act(async () => {
      returned = await result.current.createTask(INPUT);
    });

    expect(returned).toBeNull();
    expect(result.current.error).toBe("Проверьте правильность заполнения полей");
  });

  it("shows a session-expired message for a 401 response", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(jsonResponse(401, { error: { message: "Unauthorized" } })));

    const { result } = renderHook(() => useCreateTask());

    await act(async () => {
      await result.current.createTask(INPUT);
    });

    expect(result.current.error).toBe("Сессия истекла. Войдите снова");
  });

  it("shows a forbidden message for a 403 response", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(jsonResponse(403, { error: { message: "You do not have permission to create tasks in this list" } })),
    );

    const { result } = renderHook(() => useCreateTask());

    await act(async () => {
      await result.current.createTask(INPUT);
    });

    expect(result.current.error).toBe("У вас нет прав на создание задач в этом списке");
  });

  it("shows a not-found message for a 404 response", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(jsonResponse(404, { error: { message: "List not found" } })));

    const { result } = renderHook(() => useCreateTask());

    await act(async () => {
      await result.current.createTask(INPUT);
    });

    expect(result.current.error).toBe("Список недоступен или был удалён");
  });

  it("shows a network error message when the request fails outright", async () => {
    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new TypeError("Failed to fetch")));

    const { result } = renderHook(() => useCreateTask());

    await act(async () => {
      await result.current.createTask(INPUT);
    });

    expect(result.current.error).toBe("Не удалось соединиться с сервером. Проверьте подключение к интернету");
    expect(result.current.isPending).toBe(false);
  });

  it("shows a generic message for an unexpected server error", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(jsonResponse(500, {})));

    const { result } = renderHook(() => useCreateTask());

    await act(async () => {
      await result.current.createTask(INPUT);
    });

    expect(result.current.error).toBe("Что-то пошло не так. Попробуйте ещё раз");
  });

  it("shows a generic message when the success response has no data", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(jsonResponse(201, {})));

    const { result } = renderHook(() => useCreateTask());

    let returned: unknown;
    await act(async () => {
      returned = await result.current.createTask(INPUT);
    });

    expect(returned).toBeNull();
    expect(result.current.error).toBe("Что-то пошло не так. Попробуйте ещё раз");
  });
});
