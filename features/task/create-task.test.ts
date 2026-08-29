import { describe, expect, it } from "vitest";
import { createTaskForUser } from "@/features/task/create-task";
import { createList, findListById } from "@/entities/list/repository";
import { findTaskById } from "@/entities/task/repository";

function baseInput(listId: string) {
  return {
    listId,
    title: "New task",
    description: "",
    priority: 3 as const,
    category: null,
    tags: [],
    parentId: null,
    deadline: null,
    estimatedMin: 0,
  };
}

describe("createTaskForUser", () => {
  it("creates the task when the user owns the list", () => {
    const list = createList("u-owner-1", { title: "Owned", template: "work", deadline: null });

    const result = createTaskForUser("u-owner-1", baseInput(list.id));

    expect(result.status).toBe("ok");
    if (result.status === "ok") {
      expect(result.task.listId).toBe(list.id);
      expect(findTaskById(result.task.id)).toEqual(result.task);
    }
  });

  it("creates the task when the user has edit access via sharing", () => {
    const list = createList("u-owner-2", { title: "Shared", template: "work", deadline: null });
    findListById(list.id)!.sharedWith.push({ userId: "u-editor-2", access: "edit" });

    const result = createTaskForUser("u-editor-2", baseInput(list.id));

    expect(result.status).toBe("ok");
  });

  it("returns forbidden when the user only has read access", () => {
    const list = createList("u-owner-3", { title: "Shared", template: "work", deadline: null });
    findListById(list.id)!.sharedWith.push({ userId: "u-viewer-3", access: "read" });

    const result = createTaskForUser("u-viewer-3", baseInput(list.id));

    expect(result.status).toBe("forbidden");
  });

  it("returns forbidden when the user has no access to the list", () => {
    const list = createList("u-owner-4", { title: "Private", template: "work", deadline: null });

    const result = createTaskForUser("u-stranger-4", baseInput(list.id));

    expect(result.status).toBe("forbidden");
  });

  it("returns list_not_found for an unknown listId", () => {
    const result = createTaskForUser("u-anyone-5", baseInput("does-not-exist"));

    expect(result.status).toBe("list_not_found");
  });

  it("returns list_not_found for a soft-deleted list, even for its owner", () => {
    const list = createList("u-owner-6", { title: "Owned", template: "work", deadline: null });
    findListById(list.id)!.deletedAt = "2026-08-01T00:00:00.000Z";

    const result = createTaskForUser("u-owner-6", baseInput(list.id));

    expect(result.status).toBe("list_not_found");
  });

  it("ignores an ownerId-like field spoofed in the input and derives access from the session user only", () => {
    const list = createList("u-owner-7", { title: "Owned", template: "work", deadline: null });

    const result = createTaskForUser("u-stranger-7", {
      ...baseInput(list.id),
      // @ts-expect-error -- simulating a client attempting to smuggle extra fields
      ownerId: "u-owner-7",
    });

    expect(result.status).toBe("forbidden");
  });
});
