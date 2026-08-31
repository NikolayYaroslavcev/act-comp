import { describe, expect, it } from "vitest";
import { listActivityForTask } from "@/entities/activity/repository";
import { createComment } from "@/entities/comment/repository";
import { createList } from "@/entities/list/repository";
import {
  applyTaskExtension,
  applyTaskTimer,
  cloneTask,
  createTask,
  deleteTask,
  restoreTask,
  rollbackTask,
  updateTask,
} from "@/entities/task/repository";

const NOW = new Date("2026-08-30T12:00:00.000Z");
const AT = NOW.toISOString();

async function makeTaskIn(listId: string, title = "Task") {
  return await createTask(
    {
      listId,
      title,
      description: "",
      priority: 3,
      category: null,
      tags: [],
      parentId: null,
      deadline: null,
      estimatedMin: 0,
    },
    "u1",
  );
}

describe("task mutations record activity", () => {
  it("records created with the acting user when createTask receives byUserId", async () => {
    const list = await createList("u1", { title: "Owned", template: "work", deadline: null });
    const task = await makeTaskIn(list.id);

    const [created] = (await listActivityForTask(task.id)).filter((item) => item.action === "created");
    expect(created).toMatchObject({ entityId: task.id, byUserId: "u1", action: "created" });
    expect(created.at).toBe(task.createdAt);
  });

  it("does not record created when createTask has no acting user", async () => {
    const list = await createList("u1", { title: "Owned", template: "work", deadline: null });
    const task = await createTask({
      listId: list.id,
      title: "Anonymous",
      description: "",
      priority: 3,
      category: null,
      tags: [],
      parentId: null,
      deadline: null,
      estimatedMin: 0,
    });

    expect((await listActivityForTask(task.id)).filter((item) => item.action === "created")).toEqual([]);
  });

  it("records one field activity per changed field with old/new metadata", async () => {
    const list = await createList("u1", { title: "Owned", template: "work", deadline: null });
    const task = await makeTaskIn(list.id);
    await updateTask(task.id, "u1", { title: "New", priority: 5 }, NOW);

    const fieldEvents = (await listActivityForTask(task.id)).filter((item) => item.action === "updated");
    expect(fieldEvents).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          byUserId: "u1",
          action: "updated",
          at: AT,
          metadata: { field: "title", old: "Task", new: "New" },
        }),
        expect.objectContaining({
          byUserId: "u1",
          action: "updated",
          at: AT,
          metadata: { field: "priority", old: 3, new: 5 },
        }),
      ]),
    );
  });

  it("records status_changed for a status update", async () => {
    const list = await createList("u1", { title: "Owned", template: "work", deadline: null });
    const task = await makeTaskIn(list.id);
    await updateTask(task.id, "u1", { status: "in_progress" }, NOW);

    expect(await listActivityForTask(task.id)).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          action: "status_changed",
          byUserId: "u1",
          metadata: { field: "status", old: "new", new: "in_progress" },
        }),
      ]),
    );
  });

  it("does not record activity for a no-op update", async () => {
    const list = await createList("u1", { title: "Owned", template: "work", deadline: null });
    const task = await makeTaskIn(list.id);
    const before = (await listActivityForTask(task.id)).length;
    await updateTask(task.id, "u1", { title: "Task" }, NOW);
    expect(await listActivityForTask(task.id)).toHaveLength(before);
  });

  it("records a single rolled_back event instead of field updates", async () => {
    const list = await createList("u1", { title: "Owned", template: "work", deadline: null });
    const task = await makeTaskIn(list.id);
    await updateTask(task.id, "u1", { title: "Changed" }, NOW);
    const afterEdit = (await listActivityForTask(task.id)).filter((item) => item.action === "updated").length;

    await rollbackTask(task.id, "u1", 0, new Date("2026-08-30T13:00:00.000Z"));

    const events = await listActivityForTask(task.id);
    expect(events.filter((item) => item.action === "updated")).toHaveLength(afterEdit);
    expect(events).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          action: "rolled_back",
          byUserId: "u1",
          metadata: { historyIndex: 0 },
        }),
      ]),
    );
  });

  it("records timer actions only when the timer actually transitions", async () => {
    const list = await createList("u1", { title: "Owned", template: "work", deadline: null });
    const task = await makeTaskIn(list.id);

    await applyTaskTimer(task.id, "u1", "start", NOW);
    await applyTaskTimer(task.id, "u1", "pause", new Date("2026-08-30T12:05:00.000Z"));
    await applyTaskTimer(task.id, "u1", "pause", new Date("2026-08-30T12:06:00.000Z"));
    await applyTaskTimer(task.id, "u1", "resume", new Date("2026-08-30T12:07:00.000Z"));
    await applyTaskTimer(task.id, "u1", "stop", new Date("2026-08-30T12:08:00.000Z"));

    expect((await listActivityForTask(task.id)).map((item) => item.action)).toEqual(
      expect.arrayContaining(["timer_started", "timer_paused", "timer_resumed", "timer_stopped"]),
    );
    expect((await listActivityForTask(task.id)).filter((item) => item.action === "timer_paused")).toHaveLength(1);
  });

  it("records duplicated on the clone with the source task id", async () => {
    const list = await createList("u1", { title: "Owned", template: "work", deadline: null });
    const task = await makeTaskIn(list.id);
    const result = await cloneTask(task.id, NOW, "u1");
    expect(result.status).toBe("ok");
    if (result.status !== "ok") {
      return;
    }

    expect(await listActivityForTask(result.task.id)).toEqual([
      expect.objectContaining({
        action: "duplicated",
        byUserId: "u1",
        metadata: { sourceTaskId: task.id },
      }),
    ]);
    expect((await listActivityForTask(task.id)).some((item) => item.action === "duplicated")).toBe(false);
  });

  it("records commented with the comment id", async () => {
    const list = await createList("u1", { title: "Owned", template: "work", deadline: null });
    const task = await makeTaskIn(list.id);
    const comment = await createComment({ taskId: task.id, authorId: "u2", text: "Hi" }, NOW);

    expect(await listActivityForTask(task.id)).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          action: "commented",
          byUserId: "u2",
          metadata: { commentId: comment.id },
        }),
      ]),
    );
  });

  it("records an updated activity for the estimatedMin field when an extension is applied", async () => {
    const list = await createList("u1", { title: "Owned", template: "work", deadline: null });
    const task = await makeTaskIn(list.id);

    await applyTaskExtension(task.id, "u1", { commentId: "c-combined", addedMin: 310 }, NOW);

    expect(await listActivityForTask(task.id)).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          action: "updated",
          metadata: { field: "estimatedMin", old: 0, new: 310 },
        }),
      ]),
    );
    expect((await listActivityForTask(task.id)).filter((item) => item.action === "updated")).toHaveLength(1);
  });

  it("records deleted and restored", async () => {
    const list = await createList("u1", { title: "Owned", template: "work", deadline: null });
    const task = await makeTaskIn(list.id);
    await deleteTask(task.id, "u1", NOW);
    await restoreTask(task.id, "u1", new Date("2026-08-30T12:01:00.000Z"));

    expect((await listActivityForTask(task.id)).map((item) => item.action)).toEqual(
      expect.arrayContaining(["deleted", "restored"]),
    );
  });

  it("does not add a second deleted activity on an already-deleted task", async () => {
    const list = await createList("u1", { title: "Owned", template: "work", deadline: null });
    const task = await makeTaskIn(list.id);
    await deleteTask(task.id, "u1", NOW);
    const afterFirst = (await listActivityForTask(task.id)).filter((item) => item.action === "deleted").length;
    await deleteTask(task.id, "u1", new Date("2026-08-30T12:02:00.000Z"));
    expect((await listActivityForTask(task.id)).filter((item) => item.action === "deleted")).toHaveLength(afterFirst);
  });
});
