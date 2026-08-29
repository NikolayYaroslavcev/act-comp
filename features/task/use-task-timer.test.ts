import { act, renderHook } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { useTaskTimer } from "@/features/task/use-task-timer";
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
    timerStartedAt: "2026-08-29T10:00:00.000Z",
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

describe("useTaskTimer", () => {
  it("returns the updated task on success", async () => {
    const task = makeTask();
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(jsonResponse(200, { data: task })));

    const { result } = renderHook(() => useTaskTimer());

    let returned: unknown;
    await act(async () => {
      returned = await result.current.controlTimer("t1", "start");
    });

    expect(returned).toEqual(task);
    expect(result.current.error).toBeNull();
  });

  it("does not send a second request while one is pending", async () => {
    let resolveFetch: (value: Response) => void = () => {};
    const pending = new Promise<Response>((resolve) => {
      resolveFetch = resolve;
    });
    const fetchMock = vi.fn().mockReturnValue(pending);
    vi.stubGlobal("fetch", fetchMock);

    const { result } = renderHook(() => useTaskTimer());

    let first!: Promise<unknown>;
    let second!: Promise<unknown>;
    act(() => {
      first = result.current.controlTimer("t1", "start");
      second = result.current.controlTimer("t1", "pause");
    });

    expect(result.current.isPending).toBe(true);
    expect(fetchMock).toHaveBeenCalledTimes(1);

    resolveFetch(jsonResponse(200, { data: makeTask() }));
    await act(async () => {
      await first;
      await second;
    });
  });

  it("surfaces a forbidden error", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(jsonResponse(403, { error: { message: "x" } })));

    const { result } = renderHook(() => useTaskTimer());

    let returned: unknown;
    await act(async () => {
      returned = await result.current.controlTimer("t1", "start");
    });

    expect(returned).toBeNull();
    expect(result.current.error).toBe("У вас нет прав на управление таймером этой задачи");
  });
});
