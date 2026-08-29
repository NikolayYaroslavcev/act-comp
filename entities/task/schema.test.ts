import { describe, expect, it } from "vitest";
import { taskSchema } from "@/entities/task/schema";

const validTask = {
  id: "t1",
  listId: "l1",
  code: "TEST-1",
  title: "Do the thing",
  description: "",
  status: "new",
  priority: 3,
  category: null,
  tags: [],
  dependsOn: [],
  parentId: null,
  subtaskIds: [],
  deadline: null,
  createdAt: "2026-08-27T08:00:00.000Z",
  estimatedMin: 60,
  timeSpentMin: 0,
  timerStartedAt: null,
  timerPausedAt: null,
  extensions: [],
  history: [],
  deletedAt: null,
};

describe("taskSchema", () => {
  it("accepts a valid task", () => {
    expect(taskSchema.safeParse(validTask).success).toBe(true);
  });

  it("rejects a priority below 1", () => {
    const result = taskSchema.safeParse({ ...validTask, priority: 0 });
    expect(result.success).toBe(false);
  });

  it("rejects a priority above 5", () => {
    const result = taskSchema.safeParse({ ...validTask, priority: 6 });
    expect(result.success).toBe(false);
  });

  it("rejects an unknown status", () => {
    const result = taskSchema.safeParse({ ...validTask, status: "archived" });
    expect(result.success).toBe(false);
  });

  it("rejects a negative timeSpentMin", () => {
    const result = taskSchema.safeParse({ ...validTask, timeSpentMin: -1 });
    expect(result.success).toBe(false);
  });

  it("accepts a task with dependencies and a parent", () => {
    const result = taskSchema.safeParse({
      ...validTask,
      dependsOn: ["t2"],
      parentId: "t0",
    });
    expect(result.success).toBe(true);
  });
});
