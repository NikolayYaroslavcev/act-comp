import { readFileSync } from "node:fs";
import { join } from "node:path";
import { afterEach, describe, expect, it, vi } from "vitest";
import { tasksApi } from "@/features/task/tasks-api";
import { makeStore } from "@/shared/store/store";
import type { Task } from "@/entities/task/schema";

function source(relativePath: string): string {
  return readFileSync(join(process.cwd(), relativePath), "utf8");
}

const TASK_DETAIL_SRC = source("widgets/task/task-detail.tsx");
const INLINE_EDIT_SRC = source("features/task/use-inline-task-edit.ts");
const KANBAN_SRC = source("features/task/use-kanban-board.ts");
const TASKS_API_SRC = source("features/task/tasks-api.ts");
const USE_UPDATE_TASK_SRC = source("features/task/use-update-task.ts");

function jsonResponse(status: number, body: unknown) {
  return new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json" } });
}

function makeTask(overrides: Partial<Task> = {}): Task {
  return {
    id: "t1",
    listId: "l1",
    code: "TEST-1",
    title: "Original title",
    description: "",
    status: "new",
    priority: 1,
    category: null,
    tags: [],
    dependsOn: [],
    parentId: null,
    subtaskIds: [],
    deadline: null,
    createdAt: "2026-08-01T00:00:00.000Z",
    estimatedMin: 60,
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

describe("tasksApi", () => {
  it("production consumers PATCH via useUpdateTask or requestUpdateTask, never via a getTask query", () => {
    expect(USE_UPDATE_TASK_SRC).toContain("useUpdateTaskMutation");
    expect(TASK_DETAIL_SRC).toContain("useUpdateTask");
    expect(TASK_DETAIL_SRC).not.toMatch(/useGetTaskQuery|endpoints\.getTask/);
    expect(INLINE_EDIT_SRC).toContain("requestUpdateTask");
    expect(INLINE_EDIT_SRC).not.toMatch(/tasksApi|useUpdateTaskMutation|useGetTaskQuery/);
    expect(KANBAN_SRC).toContain("requestUpdateTask");
    expect(KANBAN_SRC).not.toMatch(/tasksApi|useUpdateTaskMutation|useGetTaskQuery/);
  });

  it("does not define getTask — that query had no production subscriber and only existed as an orphan optimistic-update cache", () => {
    expect(TASKS_API_SRC).not.toMatch(/\bgetTask\b/);
    expect(tasksApi.endpoints).not.toHaveProperty("getTask");
  });

  it("updateTask unwraps the { data } envelope", async () => {
    const payload = { task: makeTask({ title: "Updated title" }), cascade: [] };
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(jsonResponse(200, { data: payload })));
    const store = makeStore();

    const result = await store.dispatch(
      tasksApi.endpoints.updateTask.initiate({ id: "t1", patch: { title: "Updated title" } }),
    );

    expect(result.data).toEqual(payload);
  });
});
