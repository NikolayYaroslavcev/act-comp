import { describe, expect, it } from "vitest";
import { controlTaskTimerForUser } from "@/features/task/control-task-timer";
import { createList, findListById } from "@/entities/list/repository";
import { applyTaskTimer, createTask, findTaskById, insertTasks } from "@/entities/task/repository";

function makeTaskIn(listId: string) {
  return createTask({
    listId,
    title: "Task",
    description: "",
    priority: 3,
    category: null,
    tags: [],
    parentId: null,
    deadline: null,
    estimatedMin: 0,
  });
}

describe("controlTaskTimerForUser", () => {
  it("starts the timer for the list owner", () => {
    const list = createList("u-owner-1", { title: "Owned", template: "work", deadline: null });
    const task = makeTaskIn(list.id);

    const result = controlTaskTimerForUser("u-owner-1", task.id, "start", new Date("2026-08-29T10:00:00.000Z"));

    expect(result.status).toBe("ok");
    if (result.status === "ok") {
      expect(result.task.timerStartedAt).toBe("2026-08-29T10:00:00.000Z");
    }
  });

  it("allows a user with shared edit access", () => {
    const list = createList("u-owner-2", { title: "Shared", template: "work", deadline: null });
    findListById(list.id)!.sharedWith.push({ userId: "u-editor-2", access: "edit" });
    const task = makeTaskIn(list.id);

    const result = controlTaskTimerForUser("u-editor-2", task.id, "start", new Date("2026-08-29T10:00:00.000Z"));

    expect(result.status).toBe("ok");
  });

  it("returns forbidden for shared read access", () => {
    const list = createList("u-owner-3", { title: "Shared", template: "work", deadline: null });
    findListById(list.id)!.sharedWith.push({ userId: "u-viewer-3", access: "read" });
    const task = makeTaskIn(list.id);

    const result = controlTaskTimerForUser("u-viewer-3", task.id, "start");

    expect(result.status).toBe("forbidden");
    expect(findTaskById(task.id)!.timerStartedAt).toBeNull();
  });

  it("returns not_found instead of leaking another user's task", () => {
    const list = createList("u-owner-4", { title: "Private", template: "work", deadline: null });
    const task = makeTaskIn(list.id);

    expect(controlTaskTimerForUser("u-stranger-4", task.id, "start").status).toBe("not_found");
  });

  it("returns not_found for an unknown task", () => {
    expect(controlTaskTimerForUser("u-anyone-5", "does-not-exist", "start").status).toBe("not_found");
  });

  it("returns not_found for a soft-deleted task", () => {
    const list = createList("u-owner-6", { title: "Owned", template: "work", deadline: null });
    const task = makeTaskIn(list.id);
    insertTasks([{ ...task, deletedAt: "2026-08-01T00:00:00.000Z" }]);

    expect(controlTaskTimerForUser("u-owner-6", task.id, "start").status).toBe("not_found");
  });

  it("returns completed for a done task", () => {
    const list = createList("u-owner-7", { title: "Owned", template: "work", deadline: null });
    const task = makeTaskIn(list.id);
    insertTasks([{ ...task, status: "done" }]);

    expect(controlTaskTimerForUser("u-owner-7", task.id, "start").status).toBe("completed");
  });

  it("returns invalid_transition when start is repeated", () => {
    const list = createList("u-owner-8", { title: "Owned", template: "work", deadline: null });
    const task = makeTaskIn(list.id);
    applyTaskTimer(task.id, "u-owner-8", "start", new Date("2026-08-29T10:00:00.000Z"));

    expect(controlTaskTimerForUser("u-owner-8", task.id, "start").status).toBe("invalid_transition");
  });
});
