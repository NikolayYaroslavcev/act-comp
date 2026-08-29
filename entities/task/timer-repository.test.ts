import { describe, expect, it } from "vitest";
import { applyTaskTimer, createTask, findTaskById, insertTasks, updateTask } from "@/entities/task/repository";
import { createList } from "@/entities/list/repository";

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
    estimatedMin: 100,
  });
}

describe("applyTaskTimer", () => {
  it("starts a timer and persists server-owned timestamps", () => {
    const list = createList("u1", { title: "List", template: "work", deadline: null });
    const task = makeTaskIn(list.id);
    const now = new Date("2026-08-29T10:00:00.000Z");

    const result = applyTaskTimer(task.id, "u1", "start", now);

    expect(result.status).toBe("ok");
    if (result.status === "ok") {
      expect(result.task.timerStartedAt).toBe(now.toISOString());
      expect(result.task.timerPausedAt).toBeNull();
    }
    expect(findTaskById(task.id)?.timerStartedAt).toBe(now.toISOString());
  });

  it("pauses a running timer and accumulates timeSpentMin", () => {
    const list = createList("u1", { title: "List", template: "work", deadline: null });
    const task = makeTaskIn(list.id);
    applyTaskTimer(task.id, "u1", "start", new Date("2026-08-29T10:00:00.000Z"));

    const result = applyTaskTimer(task.id, "u1", "pause", new Date("2026-08-29T10:05:00.000Z"));

    expect(result.status).toBe("ok");
    if (result.status === "ok") {
      expect(result.task.timeSpentMin).toBe(5);
      expect(result.task.timerStartedAt).toBeNull();
      expect(result.task.timerPausedAt).toBe("2026-08-29T10:05:00.000Z");
    }
    expect(findTaskById(task.id)?.timeSpentMin).toBe(5);
  });

  it("resumes a paused timer without resetting timeSpentMin", () => {
    const list = createList("u1", { title: "List", template: "work", deadline: null });
    const task = makeTaskIn(list.id);
    applyTaskTimer(task.id, "u1", "start", new Date("2026-08-29T10:00:00.000Z"));
    applyTaskTimer(task.id, "u1", "pause", new Date("2026-08-29T10:05:00.000Z"));

    const result = applyTaskTimer(task.id, "u1", "resume", new Date("2026-08-29T10:10:00.000Z"));

    expect(result.status).toBe("ok");
    if (result.status === "ok") {
      expect(result.task.timeSpentMin).toBe(5);
      expect(result.task.timerStartedAt).toBe("2026-08-29T10:10:00.000Z");
      expect(result.task.timerPausedAt).toBeNull();
    }
  });

  it("stops a running timer, committing elapsed minutes", () => {
    const list = createList("u1", { title: "List", template: "work", deadline: null });
    const task = makeTaskIn(list.id);
    applyTaskTimer(task.id, "u1", "start", new Date("2026-08-29T10:00:00.000Z"));

    const result = applyTaskTimer(task.id, "u1", "stop", new Date("2026-08-29T10:03:00.000Z"));

    expect(result.status).toBe("ok");
    if (result.status === "ok") {
      expect(result.task.timeSpentMin).toBe(3);
      expect(result.task.timerStartedAt).toBeNull();
      expect(result.task.timerPausedAt).toBeNull();
    }
  });

  it("does not start a second parallel timer", () => {
    const list = createList("u1", { title: "List", template: "work", deadline: null });
    const task = makeTaskIn(list.id);
    applyTaskTimer(task.id, "u1", "start", new Date("2026-08-29T10:00:00.000Z"));

    const result = applyTaskTimer(task.id, "u1", "start", new Date("2026-08-29T10:01:00.000Z"));

    expect(result.status).toBe("invalid_transition");
    expect(findTaskById(task.id)?.timerStartedAt).toBe("2026-08-29T10:00:00.000Z");
  });

  it("returns not_found for an unknown task", () => {
    expect(applyTaskTimer("missing", "u1", "start").status).toBe("not_found");
  });

  it("returns completed for a done task and does not persist a start", () => {
    const list = createList("u1", { title: "List", template: "work", deadline: null });
    const task = makeTaskIn(list.id);
    insertTasks([{ ...task, status: "done" }]);

    const result = applyTaskTimer(task.id, "u1", "start", new Date("2026-08-29T10:00:00.000Z"));

    expect(result.status).toBe("completed");
    expect(findTaskById(task.id)?.timerStartedAt).toBeNull();
  });

  it("returns deleted for a soft-deleted task", () => {
    const list = createList("u1", { title: "List", template: "work", deadline: null });
    const task = makeTaskIn(list.id);
    insertTasks([{ ...task, deletedAt: "2026-08-29T09:00:00.000Z" }]);

    expect(applyTaskTimer(task.id, "u1", "start").status).toBe("deleted");
  });

  it("keeps the timer running when an unrelated field is edited", () => {
    const list = createList("u1", { title: "List", template: "work", deadline: null });
    const task = makeTaskIn(list.id);
    applyTaskTimer(task.id, "u1", "start", new Date("2026-08-29T10:00:00.000Z"));

    updateTask(task.id, "u1", { title: "Renamed" });

    const stored = findTaskById(task.id)!;
    expect(stored.title).toBe("Renamed");
    expect(stored.timerStartedAt).toBe("2026-08-29T10:00:00.000Z");
  });

  it("starts without resetting already accumulated timeSpentMin", () => {
    const list = createList("u1", { title: "List", template: "work", deadline: null });
    const task = makeTaskIn(list.id);
    insertTasks([{ ...findTaskById(task.id)!, timeSpentMin: 12 }]);

    const result = applyTaskTimer(task.id, "u1", "start", new Date("2026-08-29T10:00:00.000Z"));

    expect(result.status).toBe("ok");
    if (result.status === "ok") {
      expect(result.task.timerStartedAt).toBe("2026-08-29T10:00:00.000Z");
      expect(result.task.timeSpentMin).toBe(12);
    }
  });
});
