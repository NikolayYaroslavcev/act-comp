import { describe, expect, it } from "vitest";
import { controlTaskTimerForUser } from "@/features/task/control-task-timer";
import { createList, findListById } from "@/entities/list/repository";
import { applyTaskTimer, createTask, findTaskById, insertTasks } from "@/entities/task/repository";

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
    estimatedMin: 0,
  });
}

describe("controlTaskTimerForUser", () => {
  it("starts the timer for the list owner", async () => {
    const list = await createList("u-owner-1", { title: "Owned", template: "work", deadline: null });
    const task = await makeTaskIn(list.id);

    const result = await controlTaskTimerForUser("u-owner-1", task.id, "start", new Date("2026-08-29T10:00:00.000Z"));

    expect(result.status).toBe("ok");
    if (result.status === "ok") {
      expect(result.task.timerStartedAt).toBe("2026-08-29T10:00:00.000Z");
    }
  });

  it("allows a user with shared edit access", async () => {
    const list = await createList("u-owner-2", { title: "Shared", template: "work", deadline: null });
    (await findListById(list.id))!.sharedWith.push({ userId: "u-editor-2", access: "edit" });
    const task = await makeTaskIn(list.id);

    const result = await controlTaskTimerForUser("u-editor-2", task.id, "start", new Date("2026-08-29T10:00:00.000Z"));

    expect(result.status).toBe("ok");
  });

  it("returns forbidden for shared read access", async () => {
    const list = await createList("u-owner-3", { title: "Shared", template: "work", deadline: null });
    (await findListById(list.id))!.sharedWith.push({ userId: "u-viewer-3", access: "read" });
    const task = await makeTaskIn(list.id);

    const result = await controlTaskTimerForUser("u-viewer-3", task.id, "start");

    expect(result.status).toBe("forbidden");
    expect((await findTaskById(task.id))!.timerStartedAt).toBeNull();
  });

  it("returns not_found instead of leaking another user's task", async () => {
    const list = await createList("u-owner-4", { title: "Private", template: "work", deadline: null });
    const task = await makeTaskIn(list.id);

    expect((await controlTaskTimerForUser("u-stranger-4", task.id, "start")).status).toBe("not_found");
  });

  it("returns not_found for an unknown task", async () => {
    expect((await controlTaskTimerForUser("u-anyone-5", "does-not-exist", "start")).status).toBe("not_found");
  });

  it("returns not_found for a soft-deleted task", async () => {
    const list = await createList("u-owner-6", { title: "Owned", template: "work", deadline: null });
    const task = await makeTaskIn(list.id);
    await insertTasks([{ ...task, deletedAt: "2026-08-01T00:00:00.000Z" }]);

    expect((await controlTaskTimerForUser("u-owner-6", task.id, "start")).status).toBe("not_found");
  });

  it("returns completed for a done task", async () => {
    const list = await createList("u-owner-7", { title: "Owned", template: "work", deadline: null });
    const task = await makeTaskIn(list.id);
    await insertTasks([{ ...task, status: "done" }]);

    expect((await controlTaskTimerForUser("u-owner-7", task.id, "start")).status).toBe("completed");
  });

  it("returns invalid_transition when start is repeated", async () => {
    const list = await createList("u-owner-8", { title: "Owned", template: "work", deadline: null });
    const task = await makeTaskIn(list.id);
    await applyTaskTimer(task.id, "u-owner-8", "start", new Date("2026-08-29T10:00:00.000Z"));

    expect((await controlTaskTimerForUser("u-owner-8", task.id, "start")).status).toBe("invalid_transition");
  });

  it("pauses a running timer and persists working elapsed for the owner", async () => {
    const list = await createList("u-owner-9", { title: "Owned", template: "work", deadline: null });
    const task = await makeTaskIn(list.id);
    await applyTaskTimer(task.id, "u-owner-9", "start", new Date("2026-08-29T10:00:00.000Z"));

    const result = await controlTaskTimerForUser(
      "u-owner-9",
      task.id,
      "pause",
      new Date("2026-08-29T10:05:00.000Z"),
    );

    expect(result.status).toBe("ok");
    if (result.status === "ok") {
      expect(result.task.timeSpentMin).toBe(5);
      expect(result.task.timerPausedAt).toBe("2026-08-29T10:05:00.000Z");
    }
    expect((await findTaskById(task.id))?.timeSpentMin).toBe(5);
  });
});
