import { describe, expect, it } from "vitest";
import { applyTaskTimer, createTask, findTaskById, insertTasks, updateTask } from "@/entities/task/repository";
import { createList } from "@/entities/list/repository";

async function makeTaskIn(listId: string) {
  return await createTask({
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
  it("starts a timer and persists server-owned timestamps", async () => {
    const list = await createList("u1", { title: "List", template: "work", deadline: null });
    const task = await makeTaskIn(list.id);
    const now = new Date("2026-08-29T10:00:00.000Z");

    const result = await applyTaskTimer(task.id, "u1", "start", now);

    expect(result.status).toBe("ok");
    if (result.status === "ok") {
      expect(result.task.timerStartedAt).toBe(now.toISOString());
      expect(result.task.timerPausedAt).toBeNull();
    }
    expect((await findTaskById(task.id))?.timerStartedAt).toBe(now.toISOString());
  });

  it("pauses a running timer and accumulates timeSpentMin", async () => {
    const list = await createList("u1", { title: "List", template: "work", deadline: null });
    const task = await makeTaskIn(list.id);
    await applyTaskTimer(task.id, "u1", "start", new Date("2026-08-29T10:00:00.000Z"));

    const result = await applyTaskTimer(task.id, "u1", "pause", new Date("2026-08-29T10:05:00.000Z"));

    expect(result.status).toBe("ok");
    if (result.status === "ok") {
      expect(result.task.timeSpentMin).toBe(5);
      expect(result.task.timerStartedAt).toBeNull();
      expect(result.task.timerPausedAt).toBe("2026-08-29T10:05:00.000Z");
    }
    expect((await findTaskById(task.id))?.timeSpentMin).toBe(5);
  });

  it("resumes a paused timer without resetting timeSpentMin", async () => {
    const list = await createList("u1", { title: "List", template: "work", deadline: null });
    const task = await makeTaskIn(list.id);
    await applyTaskTimer(task.id, "u1", "start", new Date("2026-08-29T10:00:00.000Z"));
    await applyTaskTimer(task.id, "u1", "pause", new Date("2026-08-29T10:05:00.000Z"));

    const result = await applyTaskTimer(task.id, "u1", "resume", new Date("2026-08-29T10:10:00.000Z"));

    expect(result.status).toBe("ok");
    if (result.status === "ok") {
      expect(result.task.timeSpentMin).toBe(5);
      expect(result.task.timerStartedAt).toBe("2026-08-29T10:10:00.000Z");
      expect(result.task.timerPausedAt).toBeNull();
    }
  });

  it("stops a running timer, committing elapsed minutes", async () => {
    const list = await createList("u1", { title: "List", template: "work", deadline: null });
    const task = await makeTaskIn(list.id);
    await applyTaskTimer(task.id, "u1", "start", new Date("2026-08-29T10:00:00.000Z"));

    const result = await applyTaskTimer(task.id, "u1", "stop", new Date("2026-08-29T10:03:00.000Z"));

    expect(result.status).toBe("ok");
    if (result.status === "ok") {
      expect(result.task.timeSpentMin).toBe(3);
      expect(result.task.timerStartedAt).toBeNull();
      expect(result.task.timerPausedAt).toBeNull();
    }
  });

  it("persists working elapsed using the acting user's workDayHours cap", async () => {
    const list = await createList("u2", { title: "List", template: "work", deadline: null });
    const task = await makeTaskIn(list.id);
    await applyTaskTimer(task.id, "u2", "start", new Date("2026-08-29T10:00:00.000Z"));

    const result = await applyTaskTimer(task.id, "u2", "pause", new Date("2026-08-29T17:00:00.000Z"));

    expect(result.status).toBe("ok");
    if (result.status === "ok") {
      expect(result.task.timeSpentMin).toBe(6 * 60);
    }
    expect((await findTaskById(task.id))?.timeSpentMin).toBe(6 * 60);
  });

  it("does not start a second parallel timer", async () => {
    const list = await createList("u1", { title: "List", template: "work", deadline: null });
    const task = await makeTaskIn(list.id);
    await applyTaskTimer(task.id, "u1", "start", new Date("2026-08-29T10:00:00.000Z"));

    const result = await applyTaskTimer(task.id, "u1", "start", new Date("2026-08-29T10:01:00.000Z"));

    expect(result.status).toBe("invalid_transition");
    expect((await findTaskById(task.id))?.timerStartedAt).toBe("2026-08-29T10:00:00.000Z");
  });

  it("returns not_found for an unknown task", async () => {
    expect((await applyTaskTimer("missing", "u1", "start")).status).toBe("not_found");
  });

  it("returns completed for a done task and does not persist a start", async () => {
    const list = await createList("u1", { title: "List", template: "work", deadline: null });
    const task = await makeTaskIn(list.id);
    await insertTasks([{ ...task, status: "done" }]);

    const result = await applyTaskTimer(task.id, "u1", "start", new Date("2026-08-29T10:00:00.000Z"));

    expect(result.status).toBe("completed");
    expect((await findTaskById(task.id))?.timerStartedAt).toBeNull();
  });

  it("returns deleted for a soft-deleted task", async () => {
    const list = await createList("u1", { title: "List", template: "work", deadline: null });
    const task = await makeTaskIn(list.id);
    await insertTasks([{ ...task, deletedAt: "2026-08-29T09:00:00.000Z" }]);

    expect((await applyTaskTimer(task.id, "u1", "start")).status).toBe("deleted");
  });

  it("keeps the timer running when an unrelated field is edited", async () => {
    const list = await createList("u1", { title: "List", template: "work", deadline: null });
    const task = await makeTaskIn(list.id);
    await applyTaskTimer(task.id, "u1", "start", new Date("2026-08-29T10:00:00.000Z"));

    await updateTask(task.id, "u1", { title: "Renamed" });

    const stored = (await findTaskById(task.id))!;
    expect(stored.title).toBe("Renamed");
    expect(stored.timerStartedAt).toBe("2026-08-29T10:00:00.000Z");
  });

  it("starts without resetting already accumulated timeSpentMin", async () => {
    const list = await createList("u1", { title: "List", template: "work", deadline: null });
    const task = await makeTaskIn(list.id);
    await insertTasks([{ ...(await findTaskById(task.id))!, timeSpentMin: 12 }]);

    const result = await applyTaskTimer(task.id, "u1", "start", new Date("2026-08-29T10:00:00.000Z"));

    expect(result.status).toBe("ok");
    if (result.status === "ok") {
      expect(result.task.timerStartedAt).toBe("2026-08-29T10:00:00.000Z");
      expect(result.task.timeSpentMin).toBe(12);
    }
  });
});
