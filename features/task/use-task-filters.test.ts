import { act, renderHook } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { TASK_SEARCH_DEBOUNCE_MS, useTaskFilters } from "./use-task-filters";
import { EMPTY_TASK_FILTER_CRITERIA, type TaskFilterCriteria } from "@/entities/saved-filter/query-schema";
import type { Task } from "@/entities/task/schema";

function makeTask(overrides: Partial<Task>): Task {
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

describe("useTaskFilters", () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("returns every task unfiltered before any apply", () => {
    const tasks = [makeTask({ id: "t1" }), makeTask({ id: "t2" })];
    const { result } = renderHook(() => useTaskFilters(tasks));
    expect(result.current.filteredTasks).toEqual(tasks);
  });

  it("does not apply search on each keypress before the debounce interval", () => {
    const tasks = [makeTask({ id: "t1", title: "Alpha" }), makeTask({ id: "t2", title: "Beta" })];
    const { result } = renderHook(() => useTaskFilters(tasks));

    act(() => {
      result.current.setDraft({ ...EMPTY_TASK_FILTER_CRITERIA, search: "a" });
    });
    act(() => {
      result.current.setDraft({ ...EMPTY_TASK_FILTER_CRITERIA, search: "al" });
    });
    act(() => {
      result.current.setDraft({ ...EMPTY_TASK_FILTER_CRITERIA, search: "alpha" });
    });

    expect(result.current.filteredTasks).toEqual(tasks);
    expect(result.current.appliedSearch).toBe("");

    act(() => {
      vi.advanceTimersByTime(TASK_SEARCH_DEBOUNCE_MS - 1);
    });
    expect(result.current.filteredTasks).toEqual(tasks);

    act(() => {
      vi.advanceTimersByTime(1);
    });

    expect(result.current.filteredTasks.map((t) => t.id)).toEqual(["t1"]);
    expect(result.current.appliedSearch).toBe("alpha");
  });

  it("does not debounce structured filters; they still wait for apply", () => {
    const tasks = [makeTask({ id: "t1", status: "new" }), makeTask({ id: "t2", status: "done" })];
    const { result } = renderHook(() => useTaskFilters(tasks));

    act(() => {
      result.current.setDraft({ ...EMPTY_TASK_FILTER_CRITERIA, status: ["done"] });
    });
    act(() => {
      vi.advanceTimersByTime(TASK_SEARCH_DEBOUNCE_MS);
    });

    expect(result.current.filteredTasks).toEqual(tasks);

    act(() => {
      result.current.apply();
    });

    expect(result.current.filteredTasks.map((t) => t.id)).toEqual(["t2"]);
  });

  it("cancels a pending search debounce on clear", () => {
    const tasks = [makeTask({ id: "t1", title: "Alpha" }), makeTask({ id: "t2", title: "Beta" })];
    const { result } = renderHook(() => useTaskFilters(tasks));

    act(() => {
      result.current.setDraft({ ...EMPTY_TASK_FILTER_CRITERIA, search: "alpha" });
    });
    act(() => {
      result.current.clear();
    });
    act(() => {
      vi.advanceTimersByTime(TASK_SEARCH_DEBOUNCE_MS);
    });

    expect(result.current.draft).toEqual(EMPTY_TASK_FILTER_CRITERIA);
    expect(result.current.filteredTasks).toEqual(tasks);
    expect(result.current.appliedSearch).toBe("");
  });

  it("does not apply a pending search after unmount", () => {
    const tasks = [makeTask({ id: "t1", title: "Alpha" })];
    const { result, unmount } = renderHook(() => useTaskFilters(tasks));

    act(() => {
      result.current.setDraft({ ...EMPTY_TASK_FILTER_CRITERIA, search: "alpha" });
    });
    unmount();

    expect(() => {
      act(() => {
        vi.advanceTimersByTime(TASK_SEARCH_DEBOUNCE_MS);
      });
    }).not.toThrow();
  });

  it("filters once apply is called", () => {
    const tasks = [makeTask({ id: "t1", title: "Alpha" }), makeTask({ id: "t2", title: "Beta" })];
    const { result } = renderHook(() => useTaskFilters(tasks));

    act(() => {
      result.current.setDraft({ ...EMPTY_TASK_FILTER_CRITERIA, search: "alpha" });
    });
    act(() => {
      result.current.apply();
    });

    expect(result.current.filteredTasks.map((t) => t.id)).toEqual(["t1"]);
    expect(result.current.appliedSearch).toBe("alpha");
  });

  it("resets both draft and applied state on clear", () => {
    const tasks = [makeTask({ id: "t1", title: "Alpha" }), makeTask({ id: "t2", title: "Beta" })];
    const { result } = renderHook(() => useTaskFilters(tasks));

    act(() => {
      result.current.setDraft({ ...EMPTY_TASK_FILTER_CRITERIA, search: "alpha" });
      result.current.apply();
    });
    act(() => {
      result.current.clear();
    });

    expect(result.current.draft).toEqual(EMPTY_TASK_FILTER_CRITERIA);
    expect(result.current.filteredTasks).toEqual(tasks);
  });

  it("restores and immediately applies a given criteria", () => {
    const tasks = [makeTask({ id: "t1", priority: 5 }), makeTask({ id: "t2", priority: 1 })];
    const { result } = renderHook(() => useTaskFilters(tasks));

    act(() => {
      result.current.restore({ ...EMPTY_TASK_FILTER_CRITERIA, priorityMin: 3 });
    });

    expect(result.current.filteredTasks.map((t) => t.id)).toEqual(["t1"]);
    expect(result.current.draft.priorityMin).toBe(3);
  });

  it("keeps only task criteria when restoring a saved-filter query payload", () => {
    const tasks = [makeTask({ id: "t1", title: "Alpha" }), makeTask({ id: "t2", title: "Beta" })];
    const { result } = renderHook(() => useTaskFilters(tasks));

    act(() => {
      result.current.restore({
        ...EMPTY_TASK_FILTER_CRITERIA,
        search: "alpha",
        saved: true,
        label: "Alphas",
      } as TaskFilterCriteria & { saved: boolean; label: string });
    });

    expect(result.current.draft).toEqual({ ...EMPTY_TASK_FILTER_CRITERIA, search: "alpha" });
    expect(result.current.filteredTasks.map((t) => t.id)).toEqual(["t1"]);
  });
});
