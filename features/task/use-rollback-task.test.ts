import { act, renderHook } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { useRollbackTask } from "@/features/task/use-rollback-task";
import type { Task } from "@/entities/task/schema";

function jsonResponse(status: number, body: unknown) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json" },
  });
}

function makeTask(overrides: Partial<Task> = {}): Task {
  return {
    id: "t1",
    listId: "l1",
    code: "TEST-1",
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

describe("useRollbackTask", () => {
  it("POSTs historyIndex and returns the updated task on success", async () => {
    const rolledBack = makeTask({ title: "Previous" });
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(jsonResponse(200, { data: { task: rolledBack, cascade: [] } })));

    const { result } = renderHook(() => useRollbackTask());

    let returned: unknown;
    await act(async () => {
      returned = await result.current.rollbackTask("t1", 0);
    });

    expect(returned).toEqual({ task: rolledBack, cascade: [] });
    expect(fetch).toHaveBeenCalledWith(
      "/api/tasks/t1/rollback",
      expect.objectContaining({
        method: "POST",
        body: JSON.stringify({ historyIndex: 0 }),
      }),
    );
  });

  it("does not send a second request while pending", async () => {
    let resolveFetch: (value: Response) => void = () => {};
    const pending = new Promise<Response>((resolve) => {
      resolveFetch = resolve;
    });
    const fetchMock = vi.fn().mockReturnValue(pending);
    vi.stubGlobal("fetch", fetchMock);

    const { result } = renderHook(() => useRollbackTask());

    act(() => {
      void result.current.rollbackTask("t1", 0);
      void result.current.rollbackTask("t1", 0);
    });

    expect(fetchMock).toHaveBeenCalledTimes(1);

    resolveFetch(jsonResponse(200, { data: { task: makeTask({}), cascade: [] } }));
    await act(async () => {
      await Promise.resolve();
    });
  });

  it("shows a Russian message for a 400 response", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(jsonResponse(400, { error: { message: "Unknown history version" } })));

    const { result } = renderHook(() => useRollbackTask());

    await act(async () => {
      await result.current.rollbackTask("t1", 0);
    });

    expect(result.current.error).toBe("Нельзя восстановить выбранную версию");
  });

  it("shows a Russian message for a network error", async () => {
    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new Error("offline")));

    const { result } = renderHook(() => useRollbackTask());

    await act(async () => {
      await result.current.rollbackTask("t1", 0);
    });

    expect(result.current.error).toBe("Не удалось соединиться с сервером. Проверьте подключение к интернету");
  });
});
