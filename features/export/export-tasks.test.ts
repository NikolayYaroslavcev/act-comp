import { describe, expect, it } from "vitest";
import { applyExportQuery } from "./export-tasks";
import { EMPTY_TASK_FILTER_CRITERIA, type TaskFilterCriteria } from "@/entities/saved-filter/query-schema";
import type { Task } from "@/entities/task/schema";

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

const backend = makeTask({ id: "t1", title: "backend api", status: "in_progress", priority: 4, tags: ["api"] });
const frontend = makeTask({ id: "t2", title: "frontend ui", status: "new", priority: 2, tags: ["ui"] });
const done = makeTask({ id: "t3", title: "backend docs", status: "done", priority: 5, tags: ["api"] });

describe("applyExportQuery", () => {
  it("exports every provided task when criteria are empty", () => {
    expect(applyExportQuery([backend, frontend, done], EMPTY_TASK_FILTER_CRITERIA).map((t) => t.id)).toEqual([
      "t1",
      "t2",
      "t3",
    ]);
  });

  it("applies search using the same query as the list view", () => {
    const criteria: TaskFilterCriteria = { ...EMPTY_TASK_FILTER_CRITERIA, search: "backend" };
    expect(applyExportQuery([backend, frontend, done], criteria).map((t) => t.id)).toEqual(["t1", "t3"]);
  });

  it("applies structured filters", () => {
    const criteria: TaskFilterCriteria = { ...EMPTY_TASK_FILTER_CRITERIA, status: ["in_progress"], priorityMin: 3 };
    expect(applyExportQuery([backend, frontend, done], criteria).map((t) => t.id)).toEqual(["t1"]);
  });

  it("combines search and filters", () => {
    const criteria: TaskFilterCriteria = {
      ...EMPTY_TASK_FILTER_CRITERIA,
      search: "backend",
      status: ["in_progress"],
      priorityMin: 3,
    };
    expect(applyExportQuery([backend, frontend, done], criteria).map((t) => t.id)).toEqual(["t1"]);
  });
});
