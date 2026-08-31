import { act, renderHook } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { INLINE_TASK_AUTOSAVE_MS, useInlineTaskEdit } from "@/features/task/use-inline-task-edit";
import type { Task } from "@/entities/task/schema";
import type { UpdateTaskInput } from "@/entities/task/requests";

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
    title: "Исходное",
    description: "Описание",
    status: "new",
    priority: 3,
    category: "dev",
    tags: ["a"],
    dependsOn: [],
    parentId: null,
    subtaskIds: [],
    deadline: "2026-10-01T12:00:00.000Z",
    createdAt: "2026-08-01T00:00:00.000Z",
    estimatedMin: 30,
    timeSpentMin: 0,
    timerStartedAt: null,
    timerPausedAt: null,
    extensions: [],
    history: [],
    deletedAt: null,
    ...overrides,
  };
}

function patchCalls(fetchMock: ReturnType<typeof vi.fn>) {
  return fetchMock.mock.calls.filter(([, init]) => (init as RequestInit | undefined)?.method === "PATCH");
}

function patchBodies(fetchMock: ReturnType<typeof vi.fn>): UpdateTaskInput[] {
  return patchCalls(fetchMock).map(([, init]) => JSON.parse(String((init as RequestInit).body)) as UpdateTaskInput);
}

beforeEach(() => {
  vi.useFakeTimers();
});

afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllGlobals();
});

describe("useInlineTaskEdit", () => {
  it("does not PATCH while the user is still typing", async () => {
    const fetchMock = vi.fn().mockResolvedValue(jsonResponse(200, { data: { task: makeTask(), cascade: [] } }));
    vi.stubGlobal("fetch", fetchMock);
    const { result } = renderHook(() =>
      useInlineTaskEdit({ task: makeTask(), enabled: true, onTaskUpdated: vi.fn() }),
    );

    act(() => {
      result.current.setField("title", "И");
    });
    act(() => {
      result.current.setField("title", "Ис");
    });
    act(() => {
      result.current.setField("title", "Изм");
    });
    await act(async () => {
      vi.advanceTimersByTime(INLINE_TASK_AUTOSAVE_MS - 1);
    });

    expect(patchCalls(fetchMock)).toHaveLength(0);
  });

  it("sends a single PATCH after debounce, not one per keypress", async () => {
    const updated = makeTask({ title: "Изм", history: [{ field: "title", old: "Исходное", new: "Изм", at: "2026-08-30T00:00:00.000Z", byUserId: "u1" }] });
    const fetchMock = vi.fn().mockResolvedValue(jsonResponse(200, { data: { task: updated, cascade: [] } }));
    vi.stubGlobal("fetch", fetchMock);
    const onTaskUpdated = vi.fn();
    const { result } = renderHook(() =>
      useInlineTaskEdit({ task: makeTask(), enabled: true, onTaskUpdated }),
    );

    act(() => {
      result.current.setField("title", "И");
    });
    act(() => {
      result.current.setField("title", "Ис");
    });
    act(() => {
      result.current.setField("title", "Изм");
    });
    await act(async () => {
      vi.advanceTimersByTime(INLINE_TASK_AUTOSAVE_MS);
    });

    expect(patchCalls(fetchMock)).toHaveLength(1);
    expect(patchBodies(fetchMock)[0]).toEqual({ title: "Изм" });
    expect(fetchMock).toHaveBeenCalledWith(
      "/api/tasks/t1",
      expect.objectContaining({ method: "PATCH" }),
    );
    expect(onTaskUpdated).toHaveBeenCalledWith(updated);
    expect(result.current.statusOf("title")).toBe("saved");
  });

  it("does not PATCH when disabled", async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);
    const { result } = renderHook(() =>
      useInlineTaskEdit({ task: makeTask(), enabled: false, onTaskUpdated: vi.fn() }),
    );

    act(() => {
      result.current.setField("title", "Чужое");
    });
    await act(async () => {
      vi.advanceTimersByTime(INLINE_TASK_AUTOSAVE_MS);
    });

    expect(patchCalls(fetchMock)).toHaveLength(0);
  });

  it("rejects an empty title without sending PATCH and keeps the last valid value", async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);
    const task = makeTask({ title: "Исходное" });
    const { result } = renderHook(() =>
      useInlineTaskEdit({ task, enabled: true, onTaskUpdated: vi.fn() }),
    );

    act(() => {
      result.current.setField("title", "   ");
    });
    await act(async () => {
      vi.advanceTimersByTime(INLINE_TASK_AUTOSAVE_MS);
    });

    expect(patchCalls(fetchMock)).toHaveLength(0);
    expect(result.current.statusOf("title")).toBe("invalid");
    expect(result.current.messageOf("title")).toBeTruthy();
    expect(result.current.committed.title).toBe("Исходное");
  });

  it("saves description, priority, category, tags, deadline, estimate and status as separate patches", async () => {
    const fetchMock = vi.fn().mockImplementation((_url: string, init?: RequestInit) => {
      const body = JSON.parse(String(init?.body)) as UpdateTaskInput;
      return jsonResponse(200, { data: { task: { ...makeTask(), ...body }, cascade: [] } });
    });
    vi.stubGlobal("fetch", fetchMock);
    const { result } = renderHook(() =>
      useInlineTaskEdit({ task: makeTask(), enabled: true, onTaskUpdated: vi.fn() }),
    );

    act(() => {
      result.current.setField("description", "Новое описание");
      result.current.setField("priority", "5");
      result.current.setField("category", "ops");
      result.current.setField("tags", "x, y");
      result.current.setField("estimatedMin", "90");
      result.current.setField("status", "in_progress");
    });
    await act(async () => {
      vi.advanceTimersByTime(INLINE_TASK_AUTOSAVE_MS);
    });

    const bodies = patchBodies(fetchMock);
    expect(bodies).toEqual(
      expect.arrayContaining([
        { description: "Новое описание" },
        { priority: 5 },
        { category: "ops" },
        { tags: ["x", "y"] },
        { estimatedMin: 90 },
        { status: "in_progress" },
      ]),
    );
    expect(bodies).toHaveLength(6);
  });

  it("round-trips deadline through datetime-local without a second timezone shift", async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      jsonResponse(200, { data: { task: makeTask({ deadline: "2026-10-01T12:00:00.000Z" }), cascade: [] } }),
    );
    vi.stubGlobal("fetch", fetchMock);
    const { result } = renderHook(() =>
      useInlineTaskEdit({
        task: makeTask({ deadline: "2026-10-01T12:00:00.000Z" }),
        enabled: true,
        onTaskUpdated: vi.fn(),
      }),
    );

    const displayed = result.current.values.deadline;
    act(() => {
      result.current.setField("deadline", displayed);
    });
    await act(async () => {
      vi.advanceTimersByTime(INLINE_TASK_AUTOSAVE_MS);
    });
    expect(patchCalls(fetchMock)).toHaveLength(0);

    const [datePart, timePart] = displayed.split("T");
    const [hours, minutes] = timePart.split(":");
    const nextLocal = `${datePart}T${String((Number(hours) + 1) % 24).padStart(2, "0")}:${minutes}`;
    act(() => {
      result.current.setField("deadline", nextLocal);
    });
    await act(async () => {
      vi.advanceTimersByTime(INLINE_TASK_AUTOSAVE_MS);
    });

    expect(patchBodies(fetchMock)[0]?.deadline).toBe(new Date(nextLocal).toISOString());
  });

  it("shows an API error and rolls back only the failed field", async () => {
    const fetchMock = vi.fn().mockImplementation((_url: string, init?: RequestInit) => {
      const body = JSON.parse(String(init?.body)) as UpdateTaskInput;
      if ("title" in body) {
        return jsonResponse(400, { error: { message: "Validation failed" } });
      }
      return jsonResponse(200, { data: { task: { ...makeTask(), ...body }, cascade: [] } });
    });
    vi.stubGlobal("fetch", fetchMock);
    const { result } = renderHook(() =>
      useInlineTaskEdit({ task: makeTask({ title: "Исходное", description: "Описание" }), enabled: true, onTaskUpdated: vi.fn() }),
    );

    act(() => {
      result.current.setField("title", "Новое");
      result.current.setField("description", "Другое");
    });
    await act(async () => {
      vi.advanceTimersByTime(INLINE_TASK_AUTOSAVE_MS);
    });

    expect(result.current.statusOf("title")).toBe("error");
    expect(result.current.messageOf("title")).toBe("Проверьте правильность заполнения полей");
    expect(result.current.values.title).toBe("Исходное");
    expect(result.current.values.description).toBe("Другое");
    expect(result.current.statusOf("description")).toBe("saved");
  });

  it("shows a network error without wiping other fields", async () => {
    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new TypeError("Failed to fetch")));
    const { result } = renderHook(() =>
      useInlineTaskEdit({ task: makeTask(), enabled: true, onTaskUpdated: vi.fn() }),
    );

    act(() => {
      result.current.setField("title", "Офлайн");
    });
    await act(async () => {
      vi.advanceTimersByTime(INLINE_TASK_AUTOSAVE_MS);
    });

    expect(result.current.statusOf("title")).toBe("error");
    expect(result.current.messageOf("title")).toBe("Не удалось соединиться с сервером. Проверьте подключение к интернету");
    expect(result.current.values.title).toBe("Исходное");
  });

  it("ignores a stale PATCH response so an older title cannot overwrite a newer one", async () => {
    const resolvers: Array<(value: Response) => void> = [];
    vi.stubGlobal(
      "fetch",
      vi.fn().mockImplementation(() => new Promise<Response>((resolve) => resolvers.push(resolve))),
    );
    const onTaskUpdated = vi.fn();
    const { result } = renderHook(() =>
      useInlineTaskEdit({ task: makeTask({ title: "A" }), enabled: true, onTaskUpdated }),
    );

    act(() => {
      result.current.setField("title", "B");
    });
    await act(async () => {
      vi.advanceTimersByTime(INLINE_TASK_AUTOSAVE_MS);
    });

    act(() => {
      result.current.setField("title", "C");
    });
    await act(async () => {
      vi.advanceTimersByTime(INLINE_TASK_AUTOSAVE_MS);
    });

    expect(resolvers).toHaveLength(2);

    await act(async () => {
      resolvers[0](jsonResponse(200, { data: { task: makeTask({ title: "B" }), cascade: [] } }));
    });
    expect(result.current.values.title).toBe("C");

    await act(async () => {
      resolvers[1](jsonResponse(200, { data: { task: makeTask({ title: "C" }), cascade: [] } }));
    });
    expect(result.current.values.title).toBe("C");
    expect(onTaskUpdated.mock.calls.at(-1)?.[0]).toMatchObject({ title: "C" });
  });

  it("applies optimistic field updates without replacing unrelated in-flight fields from an older response", async () => {
    const resolvers: Array<(value: Response) => void> = [];
    vi.stubGlobal(
      "fetch",
      vi.fn().mockImplementation(() => new Promise<Response>((resolve) => resolvers.push(resolve))),
    );
    const onTaskUpdated = vi.fn();
    const { result } = renderHook(() =>
      useInlineTaskEdit({
        task: makeTask({ title: "A", description: "D0" }),
        enabled: true,
        onTaskUpdated,
      }),
    );

    act(() => {
      result.current.setField("title", "B");
    });
    await act(async () => {
      vi.advanceTimersByTime(INLINE_TASK_AUTOSAVE_MS);
    });
    act(() => {
      result.current.setField("description", "D1");
    });
    await act(async () => {
      vi.advanceTimersByTime(INLINE_TASK_AUTOSAVE_MS);
    });

    const callsBeforeTitleResolve = onTaskUpdated.mock.calls.length;
    await act(async () => {
      resolvers[0](jsonResponse(200, { data: { task: makeTask({ title: "B", description: "D0" }), cascade: [] } }));
    });

    expect(result.current.values.description).toBe("D1");
    const callsAfterTitleResolved = onTaskUpdated.mock.calls.slice(callsBeforeTitleResolve);
    expect(callsAfterTitleResolved.some(([updated]) => updated.description === "D0")).toBe(false);
  });

  describe("applyExternalTask", () => {
    it("merges every clean field from an external snapshot when nothing is being edited", () => {
      const task = makeTask();
      const { result } = renderHook(() =>
        useInlineTaskEdit({ task, enabled: true, onTaskUpdated: vi.fn() }),
      );

      const external = makeTask({ priority: 5, title: "Внешнее", timeSpentMin: 42 });
      let merged!: Task;
      act(() => {
        merged = result.current.applyExternalTask(external);
      });

      expect(merged).toEqual(external);
      expect(result.current.committed).toEqual(external);
      expect(result.current.values.priority).toBe("5");
      expect(result.current.values.title).toBe("Внешнее");
    });

    it("does not overwrite a field the user is actively typing into, before autosave has fired", () => {
      const task = makeTask({ title: "Исходное", priority: 3 });
      const { result } = renderHook(() =>
        useInlineTaskEdit({ task, enabled: true, onTaskUpdated: vi.fn() }),
      );

      act(() => {
        result.current.setField("title", "Черновик");
      });

      const external = makeTask({ title: "Внешнее от другого", priority: 5 });
      act(() => {
        result.current.applyExternalTask(external);
      });

      // The user's own draft stays exactly as typed.
      expect(result.current.values.title).toBe("Черновик");
      expect(result.current.committed.title).toBe("Исходное");
      // A field the user isn't touching merges in immediately.
      expect(result.current.committed.priority).toBe(5);
      expect(result.current.values.priority).toBe("5");
      expect(result.current.statusOf("title")).not.toBe("error");
    });

    it("does not overwrite a field whose autosave PATCH is still in flight", async () => {
      const task = makeTask({ priority: 3 });
      const pendingPatch = new Promise<Response>(() => {});
      const fetchMock = vi.fn().mockReturnValue(pendingPatch);
      vi.stubGlobal("fetch", fetchMock);
      const { result } = renderHook(() =>
        useInlineTaskEdit({ task, enabled: true, onTaskUpdated: vi.fn() }),
      );

      act(() => {
        result.current.setField("priority", "5");
      });
      await act(async () => {
        vi.advanceTimersByTime(INLINE_TASK_AUTOSAVE_MS);
      });
      expect(result.current.statusOf("priority")).toBe("saving");

      const external = makeTask({ priority: 9 });
      let merged!: Task;
      act(() => {
        merged = result.current.applyExternalTask(external);
      });

      // Neither the external value nor the stale committed baseline wins —
      // the user's own optimistic in-flight value is what stays displayed.
      expect(result.current.values.priority).toBe("5");
      expect(result.current.committed.priority).toBe(3);
      expect(merged.priority).toBe(5);
    });

    it("always takes non-inline task fields from the external snapshot, even while a field is being edited", () => {
      const task = makeTask({ timeSpentMin: 0, subtaskIds: [] });
      const { result } = renderHook(() =>
        useInlineTaskEdit({ task, enabled: true, onTaskUpdated: vi.fn() }),
      );

      act(() => {
        result.current.setField("title", "Черновик");
      });

      const external = makeTask({ timeSpentMin: 120, subtaskIds: ["s1"] });
      let merged!: Task;
      act(() => {
        merged = result.current.applyExternalTask(external);
      });

      expect(result.current.committed.timeSpentMin).toBe(120);
      expect(result.current.committed.subtaskIds).toEqual(["s1"]);
      expect(merged.timeSpentMin).toBe(120);
      expect(merged.subtaskIds).toEqual(["s1"]);
    });
  });
});
