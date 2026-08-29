import { act, renderHook } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { useKanbanBoard } from "@/features/task/use-kanban-board";

function jsonResponse(status: number, body: unknown) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json" },
  });
}

function okBody(taskId: string, status: string) {
  return { data: { task: { id: taskId, status }, cascade: [] } };
}

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("useKanbanBoard", () => {
  it("applies an optimistic status override immediately, before the request resolves", () => {
    let resolveFetch: (value: Response) => void = () => {};
    vi.stubGlobal(
      "fetch",
      vi.fn().mockReturnValue(new Promise<Response>((resolve) => (resolveFetch = resolve))),
    );

    const { result } = renderHook(() => useKanbanBoard());

    act(() => {
      result.current.moveTask("t1", "in_progress");
    });

    expect(result.current.statusOverrides).toEqual({ t1: "in_progress" });
    expect(result.current.pendingTaskIds.has("t1")).toBe(true);
    resolveFetch(jsonResponse(200, okBody("t1", "in_progress")));
  });

  it("clears the override and reports the updated task on success", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(jsonResponse(200, okBody("t1", "in_progress"))));
    const onTaskUpdated = vi.fn();

    const { result } = renderHook(() => useKanbanBoard({ onTaskUpdated }));

    await act(async () => {
      result.current.moveTask("t1", "in_progress");
      await Promise.resolve();
      await Promise.resolve();
    });

    expect(result.current.statusOverrides).toEqual({});
    expect(result.current.pendingTaskIds.has("t1")).toBe(false);
    expect(onTaskUpdated).toHaveBeenCalledWith({ id: "t1", status: "in_progress" });
  });

  it("rolls back the override and records an error message on failure", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(jsonResponse(409, { error: { message: "Cycle" } })),
    );

    const { result } = renderHook(() => useKanbanBoard());

    await act(async () => {
      result.current.moveTask("t1", "done");
      await Promise.resolve();
      await Promise.resolve();
    });

    expect(result.current.statusOverrides).toEqual({});
    expect(result.current.pendingTaskIds.has("t1")).toBe(false);
    expect(result.current.errorsByTaskId.t1).toBe("Изменение создаёт цикл зависимостей. Проверьте выбранные зависимости");
  });

  it("clears a task's error via dismissError", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(jsonResponse(404, { error: { message: "Not found" } })));

    const { result } = renderHook(() => useKanbanBoard());

    await act(async () => {
      result.current.moveTask("t1", "done");
      await Promise.resolve();
      await Promise.resolve();
    });
    expect(result.current.errorsByTaskId.t1).toBeDefined();

    act(() => {
      result.current.dismissError("t1");
    });

    expect(result.current.errorsByTaskId.t1).toBeUndefined();
  });

  it("PATCHes only the target status", async () => {
    const fetchMock = vi.fn().mockResolvedValue(jsonResponse(200, okBody("t1", "done")));
    vi.stubGlobal("fetch", fetchMock);

    const { result } = renderHook(() => useKanbanBoard());

    await act(async () => {
      result.current.moveTask("t1", "done");
      await Promise.resolve();
      await Promise.resolve();
    });

    expect(fetchMock).toHaveBeenCalledWith(
      "/api/tasks/t1",
      expect.objectContaining({ method: "PATCH", body: JSON.stringify({ status: "done" }) }),
    );
  });

  it("rolls back and records the existing forbidden message on 403", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(jsonResponse(403, { error: { message: "Forbidden" } })));

    const { result } = renderHook(() => useKanbanBoard());

    await act(async () => {
      result.current.moveTask("t1", "done");
      await Promise.resolve();
      await Promise.resolve();
    });

    expect(result.current.statusOverrides).toEqual({});
    expect(result.current.errorsByTaskId.t1).toBe("У вас нет прав на редактирование этой задачи");
  });

  it("rolls back and records the existing network error message when fetch rejects", async () => {
    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new TypeError("Failed to fetch")));

    const { result } = renderHook(() => useKanbanBoard());

    await act(async () => {
      result.current.moveTask("t1", "done");
      await Promise.resolve();
      await Promise.resolve();
    });

    expect(result.current.statusOverrides).toEqual({});
    expect(result.current.errorsByTaskId.t1).toBe("Не удалось соединиться с сервером. Проверьте подключение к интернету");
  });

  it("does not let one task's failure roll back or clobber a different task's concurrent success", async () => {
    let resolveT1: (value: Response) => void = () => {};
    const fetchMock = vi.fn((input: RequestInfo | URL) => {
      const url = String(input);
      if (url.includes("t1")) {
        return new Promise<Response>((resolve) => (resolveT1 = resolve));
      }
      return Promise.resolve(jsonResponse(200, okBody("t2", "done")));
    });
    vi.stubGlobal("fetch", fetchMock);
    const onTaskUpdated = vi.fn();

    const { result } = renderHook(() => useKanbanBoard({ onTaskUpdated }));

    act(() => {
      result.current.moveTask("t1", "in_progress");
      result.current.moveTask("t2", "done");
    });

    expect(result.current.statusOverrides).toEqual({ t1: "in_progress", t2: "done" });

    // t2 resolves (success) while t1 is still in flight.
    await act(async () => {
      await Promise.resolve();
      await Promise.resolve();
      await Promise.resolve();
    });

    expect(result.current.statusOverrides).toEqual({ t1: "in_progress" });
    expect(result.current.pendingTaskIds.has("t2")).toBe(false);
    expect(onTaskUpdated).toHaveBeenCalledWith({ id: "t2", status: "done" });

    // t1 now fails — must roll back only t1, leaving t2's already-applied success untouched.
    await act(async () => {
      resolveT1(jsonResponse(500, {}));
      await Promise.resolve();
      await Promise.resolve();
    });

    expect(result.current.statusOverrides).toEqual({});
    expect(result.current.errorsByTaskId.t1).toBe("Что-то пошло не так. Попробуйте ещё раз");
    expect(result.current.errorsByTaskId.t2).toBeUndefined();
    expect(onTaskUpdated).toHaveBeenCalledTimes(1);
  });
});
