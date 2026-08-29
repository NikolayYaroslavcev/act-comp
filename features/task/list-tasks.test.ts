import { describe, expect, it } from "vitest";
import { listVisibleTasks } from "@/features/task/list-tasks";
import { createList, findListById } from "@/entities/list/repository";
import { createTask, insertTasks } from "@/entities/task/repository";

describe("listVisibleTasks", () => {
  it("returns tasks belonging to lists owned by the user", () => {
    const list = createList("u-owner-1", { title: "Owned", template: "work", deadline: null });
    const task = createTask({
      listId: list.id,
      title: "Task",
      description: "",
      priority: 3,
      category: null,
      tags: [],
      parentId: null,
      deadline: null,
      estimatedMin: 0,
    });

    const result = listVisibleTasks("u-owner-1");

    expect(result.map((t) => t.id)).toContain(task.id);
  });

  it("returns tasks belonging to lists shared with the user", () => {
    const list = createList("u-owner-2", { title: "Shared", template: "work", deadline: null });
    findListById(list.id)!.sharedWith.push({ userId: "u-viewer-2", access: "read" });
    const task = createTask({
      listId: list.id,
      title: "Task",
      description: "",
      priority: 3,
      category: null,
      tags: [],
      parentId: null,
      deadline: null,
      estimatedMin: 0,
    });

    const result = listVisibleTasks("u-viewer-2");

    expect(result.map((t) => t.id)).toContain(task.id);
  });

  it("does not return tasks belonging to lists the user cannot access", () => {
    const list = createList("u-owner-3", { title: "Private", template: "work", deadline: null });
    const task = createTask({
      listId: list.id,
      title: "Task",
      description: "",
      priority: 3,
      category: null,
      tags: [],
      parentId: null,
      deadline: null,
      estimatedMin: 0,
    });

    const result = listVisibleTasks("u-stranger-3");

    expect(result.map((t) => t.id)).not.toContain(task.id);
  });

  it("does not return soft-deleted tasks even from a visible list", () => {
    const list = createList("u-owner-4", { title: "Owned", template: "work", deadline: null });
    const task = createTask({
      listId: list.id,
      title: "Task",
      description: "",
      priority: 3,
      category: null,
      tags: [],
      parentId: null,
      deadline: null,
      estimatedMin: 0,
    });
    const deletedTask = { ...task, id: `${task.id}-deleted`, deletedAt: "2026-08-01T00:00:00.000Z" };
    insertTasks([deletedTask]);

    const result = listVisibleTasks("u-owner-4");

    expect(result.map((t) => t.id)).not.toContain(deletedTask.id);
  });

  it("does not return tasks from a soft-deleted list even for its owner", () => {
    const list = createList("u-owner-5", { title: "Owned", template: "work", deadline: null });
    const task = createTask({
      listId: list.id,
      title: "Task",
      description: "",
      priority: 3,
      category: null,
      tags: [],
      parentId: null,
      deadline: null,
      estimatedMin: 0,
    });
    findListById(list.id)!.deletedAt = "2026-08-01T00:00:00.000Z";

    const result = listVisibleTasks("u-owner-5");

    expect(result.map((t) => t.id)).not.toContain(task.id);
  });

  it("returns an empty array when the user has no accessible tasks", () => {
    expect(listVisibleTasks("u-nobody-6")).toEqual([]);
  });

  it("filters by listId when provided, within the visible set", () => {
    const listA = createList("u-owner-7", { title: "A", template: "work", deadline: null });
    const listB = createList("u-owner-7", { title: "B", template: "work", deadline: null });
    const taskA = createTask({
      listId: listA.id,
      title: "Task A",
      description: "",
      priority: 3,
      category: null,
      tags: [],
      parentId: null,
      deadline: null,
      estimatedMin: 0,
    });
    createTask({
      listId: listB.id,
      title: "Task B",
      description: "",
      priority: 3,
      category: null,
      tags: [],
      parentId: null,
      deadline: null,
      estimatedMin: 0,
    });

    const result = listVisibleTasks("u-owner-7", listA.id);

    expect(result.map((t) => t.id)).toEqual([taskA.id]);
  });
});
