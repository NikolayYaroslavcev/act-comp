import { describe, expect, it } from "vitest";
import {
  createList,
  deleteList,
  duplicateList,
  findListById,
  listLists,
  restoreList,
  shareList,
  updateList,
} from "@/entities/list/repository";
import { countTasks, createTask, findTaskById } from "@/entities/task/repository";

const MS_PER_DAY = 24 * 60 * 60 * 1000;

function daysAgo(now: Date, days: number): string {
  return new Date(now.getTime() - days * MS_PER_DAY).toISOString();
}

describe("createList", () => {
  it("creates a list owned by the given user with the given title and template", () => {
    const list = createList("u-create-1", { title: "New list", template: "work", deadline: null });

    expect(list.ownerId).toBe("u-create-1");
    expect(list.title).toBe("New list");
    expect(list.template).toBe("work");
  });

  it("initializes generated fields correctly", () => {
    const list = createList("u-create-2", { title: "Another list", template: "personal", deadline: null });

    expect(list.id).toBeTruthy();
    expect(list.taskIds).toEqual([]);
    expect(list.sharedWith).toEqual([]);
    expect(list.history).toEqual([]);
    expect(list.deletedAt).toBeNull();
    expect(list.lastActivityAt).toBeTruthy();
  });

  it("stores the given deadline", () => {
    const deadline = "2026-09-01T00:00:00.000Z";
    const list = createList("u-create-3", { title: "Deadline list", template: "project", deadline });

    expect(list.deadline).toBe(deadline);
  });

  it("assigns a unique id to each created list", () => {
    const first = createList("u-create-4", { title: "First", template: "work", deadline: null });
    const second = createList("u-create-4", { title: "Second", template: "work", deadline: null });

    expect(first.id).not.toBe(second.id);
  });

  it("persists the list so it can be found by id", () => {
    const list = createList("u-create-5", { title: "Findable", template: "project", deadline: null });

    expect(findListById(list.id)).toEqual(list);
  });

  it("does not remove or modify existing lists", () => {
    const existing = createList("u-create-6a", { title: "Pre-existing", template: "work", deadline: null });
    const beforeCount = listLists().length;

    createList("u-create-6b", { title: "New one", template: "work", deadline: null });

    expect(listLists().length).toBe(beforeCount + 1);
    expect(findListById(existing.id)).toEqual(existing);
  });
});

describe("updateList", () => {
  it("returns not_found for an unknown list id", () => {
    const result = updateList("does-not-exist", "u1", { title: "New title" });
    expect(result).toEqual({ status: "not_found" });
  });

  it("updates an allowed field for the owner", () => {
    const list = createList("u-update-1", { title: "Old title", template: "work", deadline: null });

    const result = updateList(list.id, "u-update-1", { title: "New title" });

    expect(result.status).toBe("ok");
    if (result.status === "ok") {
      expect(result.list.title).toBe("New title");
    }
  });

  it("returns not_found for a user with no relation to the list (cannot view it)", () => {
    const list = createList("u-update-2", { title: "Owned", template: "work", deadline: null });

    const result = updateList(list.id, "someone-else", { title: "Hijacked" });

    expect(result).toEqual({ status: "not_found" });
  });

  it("does not change the list when the caller cannot view it", () => {
    const list = createList("u-update-3", { title: "Owned", template: "work", deadline: null });

    updateList(list.id, "someone-else", { title: "Hijacked" });

    expect(findListById(list.id)?.title).toBe("Owned");
  });

  it("returns not_found for a stranger targeting an already soft-deleted list", () => {
    const list = createList("u-update-15", { title: "Owned", template: "work", deadline: null });
    (findListById(list.id) as { deletedAt: string | null }).deletedAt = "2026-08-10T00:00:00.000Z";

    const result = updateList(list.id, "someone-else", { title: "Hijacked" });

    expect(result).toEqual({ status: "not_found" });
  });

  it("does not change ownerId", () => {
    const list = createList("u-update-4", { title: "Owned", template: "work", deadline: null });

    const result = updateList(list.id, "u-update-4", { title: "Renamed" });

    expect(result.status).toBe("ok");
    if (result.status === "ok") {
      expect(result.list.ownerId).toBe("u-update-4");
    }
  });

  it("preserves taskIds across an update", () => {
    const list = createList("u-update-5", { title: "Owned", template: "work", deadline: null });
    findListById(list.id)!.taskIds.push("t1");

    const result = updateList(list.id, "u-update-5", { title: "Renamed" });

    expect(result.status).toBe("ok");
    if (result.status === "ok") {
      expect(result.list.taskIds).toEqual(["t1"]);
    }
  });

  it("preserves sharedWith across an update", () => {
    const list = createList("u-update-6", { title: "Owned", template: "work", deadline: null });
    findListById(list.id)!.sharedWith.push({ userId: "u2", access: "read" });

    const result = updateList(list.id, "u-update-6", { title: "Renamed" });

    expect(result.status).toBe("ok");
    if (result.status === "ok") {
      expect(result.list.sharedWith).toEqual([{ userId: "u2", access: "read" }]);
    }
  });

  it("appends a history entry describing the change", () => {
    const list = createList("u-update-7", { title: "Old title", template: "work", deadline: null });

    const result = updateList(list.id, "u-update-7", { title: "New title" });

    expect(result.status).toBe("ok");
    if (result.status === "ok") {
      expect(result.list.history).toHaveLength(1);
      expect(result.list.history[0]).toMatchObject({
        field: "title",
        old: "Old title",
        new: "New title",
        byUserId: "u-update-7",
      });
    }
  });

  it("bumps lastActivityAt when a real change is applied", () => {
    const list = createList("u-update-8", { title: "Old title", template: "work", deadline: null });
    const before = list.lastActivityAt;

    const result = updateList(list.id, "u-update-8", { title: "New title" });

    expect(result.status).toBe("ok");
    if (result.status === "ok") {
      expect(new Date(result.list.lastActivityAt).getTime()).toBeGreaterThanOrEqual(new Date(before).getTime());
    }
  });

  it("does not add a history entry for a no-op update", () => {
    const list = createList("u-update-9", { title: "Same title", template: "work", deadline: null });

    const result = updateList(list.id, "u-update-9", { title: "Same title" });

    expect(result.status).toBe("ok");
    if (result.status === "ok") {
      expect(result.list.history).toEqual([]);
    }
  });

  it("does not bump lastActivityAt for a no-op update", () => {
    const list = createList("u-update-10", { title: "Same title", template: "work", deadline: null });
    const before = list.lastActivityAt;

    const result = updateList(list.id, "u-update-10", { title: "Same title" });

    expect(result.status).toBe("ok");
    if (result.status === "ok") {
      expect(result.list.lastActivityAt).toBe(before);
    }
  });

  it("does not modify other lists", () => {
    const untouched = createList("u-update-11a", { title: "Untouched", template: "work", deadline: null });
    const target = createList("u-update-11b", { title: "Target", template: "work", deadline: null });

    updateList(target.id, "u-update-11b", { title: "Renamed" });

    expect(findListById(untouched.id)).toEqual(untouched);
  });

  it("returns forbidden for a read-only shared user", () => {
    const list = createList("u-update-12", { title: "Owned", template: "work", deadline: null });
    findListById(list.id)!.sharedWith.push({ userId: "u-viewer", access: "read" });

    const result = updateList(list.id, "u-viewer", { title: "Hijacked" });

    expect(result).toEqual({ status: "forbidden" });
  });

  it("allows an edit-access shared user to update the list", () => {
    const list = createList("u-update-13", { title: "Owned", template: "work", deadline: null });
    findListById(list.id)!.sharedWith.push({ userId: "u-editor", access: "edit" });

    const result = updateList(list.id, "u-editor", { title: "Edited by collaborator" });

    expect(result.status).toBe("ok");
    if (result.status === "ok") {
      expect(result.list.title).toBe("Edited by collaborator");
    }
  });

  it("returns deleted for a soft-deleted list owned by the caller", () => {
    const list = createList("u-update-14", { title: "Owned", template: "work", deadline: null });
    const db = findListById(list.id)!;
    (db as { deletedAt: string | null }).deletedAt = "2026-08-10T00:00:00.000Z";

    const result = updateList(list.id, "u-update-14", { title: "Should not apply" });

    expect(result).toEqual({ status: "deleted" });
  });
});

describe("deleteList", () => {
  it("returns not_found for an unknown list id", () => {
    const result = deleteList("does-not-exist", "u1");
    expect(result).toEqual({ status: "not_found" });
  });

  it("returns not_found for a user with no relation to the list (cannot view it)", () => {
    const list = createList("u-delete-1", { title: "Owned", template: "work", deadline: null });

    const result = deleteList(list.id, "someone-else");

    expect(result).toEqual({ status: "not_found" });
  });

  it("returns forbidden for an edit-access shared user", () => {
    const list = createList("u-delete-2", { title: "Owned", template: "work", deadline: null });
    findListById(list.id)!.sharedWith.push({ userId: "u-editor", access: "edit" });

    const result = deleteList(list.id, "u-editor");

    expect(result).toEqual({ status: "forbidden" });
  });

  it("returns forbidden for a read-only shared user", () => {
    const list = createList("u-delete-2b", { title: "Owned", template: "work", deadline: null });
    findListById(list.id)!.sharedWith.push({ userId: "u-viewer", access: "read" });

    const result = deleteList(list.id, "u-viewer");

    expect(result).toEqual({ status: "forbidden" });
  });

  it("returns not_found for a stranger targeting an already soft-deleted list", () => {
    const list = createList("u-delete-2c", { title: "Owned", template: "work", deadline: null });
    deleteList(list.id, "u-delete-2c");

    const result = deleteList(list.id, "someone-else");

    expect(result).toEqual({ status: "not_found" });
  });

  it("does not change the list when the caller cannot view it", () => {
    const list = createList("u-delete-3", { title: "Owned", template: "work", deadline: null });

    deleteList(list.id, "someone-else");

    expect(findListById(list.id)?.deletedAt).toBeNull();
  });

  it("sets deletedAt for the owner", () => {
    const list = createList("u-delete-4", { title: "Owned", template: "work", deadline: null });

    const result = deleteList(list.id, "u-delete-4");

    expect(result.status).toBe("ok");
    if (result.status === "ok") {
      expect(result.list.deletedAt).not.toBeNull();
    }
  });

  it("does not remove the list from storage", () => {
    const list = createList("u-delete-5", { title: "Owned", template: "work", deadline: null });

    deleteList(list.id, "u-delete-5");

    expect(findListById(list.id)).toBeDefined();
    expect(listLists().some((l) => l.id === list.id)).toBe(true);
  });

  it("preserves taskIds after deletion", () => {
    const list = createList("u-delete-6", { title: "Owned", template: "work", deadline: null });
    findListById(list.id)!.taskIds.push("t1");

    const result = deleteList(list.id, "u-delete-6");

    expect(result.status).toBe("ok");
    if (result.status === "ok") {
      expect(result.list.taskIds).toEqual(["t1"]);
    }
  });

  it("preserves sharedWith after deletion", () => {
    const list = createList("u-delete-7", { title: "Owned", template: "work", deadline: null });
    findListById(list.id)!.sharedWith.push({ userId: "u2", access: "read" });

    const result = deleteList(list.id, "u-delete-7");

    expect(result.status).toBe("ok");
    if (result.status === "ok") {
      expect(result.list.sharedWith).toEqual([{ userId: "u2", access: "read" }]);
    }
  });

  it("appends a history entry describing the deletion", () => {
    const list = createList("u-delete-8", { title: "Owned", template: "work", deadline: null });

    const result = deleteList(list.id, "u-delete-8");

    expect(result.status).toBe("ok");
    if (result.status === "ok") {
      expect(result.list.history).toHaveLength(1);
      expect(result.list.history[0]).toMatchObject({
        field: "deletedAt",
        old: null,
        byUserId: "u-delete-8",
      });
    }
  });

  it("bumps lastActivityAt on deletion", () => {
    const list = createList("u-delete-9", { title: "Owned", template: "work", deadline: null });
    const before = list.lastActivityAt;

    const result = deleteList(list.id, "u-delete-9");

    expect(result.status).toBe("ok");
    if (result.status === "ok") {
      expect(new Date(result.list.lastActivityAt).getTime()).toBeGreaterThanOrEqual(new Date(before).getTime());
    }
  });

  it("does not modify other lists", () => {
    const untouched = createList("u-delete-10a", { title: "Untouched", template: "work", deadline: null });
    const target = createList("u-delete-10b", { title: "Target", template: "work", deadline: null });

    deleteList(target.id, "u-delete-10b");

    expect(findListById(untouched.id)).toEqual(untouched);
  });

  it("is idempotent for an already-deleted list: keeps the original deletedAt", () => {
    const list = createList("u-delete-11", { title: "Owned", template: "work", deadline: null });
    const first = deleteList(list.id, "u-delete-11");
    expect(first.status).toBe("ok");
    const deletedAtAfterFirst = first.status === "ok" ? first.list.deletedAt : null;

    const second = deleteList(list.id, "u-delete-11");

    expect(second.status).toBe("ok");
    if (second.status === "ok") {
      expect(second.list.deletedAt).toBe(deletedAtAfterFirst);
    }
  });

  it("is idempotent for an already-deleted list: does not add another history entry", () => {
    const list = createList("u-delete-12", { title: "Owned", template: "work", deadline: null });
    deleteList(list.id, "u-delete-12");

    const second = deleteList(list.id, "u-delete-12");

    expect(second.status).toBe("ok");
    if (second.status === "ok") {
      expect(second.list.history).toHaveLength(1);
    }
  });
});

describe("restoreList", () => {
  it("returns not_found for an unknown list id", () => {
    const result = restoreList("does-not-exist", "u1", new Date());
    expect(result).toEqual({ status: "not_found" });
  });

  it("returns not_found for a user who does not own the list", () => {
    const list = createList("u-restore-1", { title: "Owned", template: "work", deadline: null });
    deleteList(list.id, "u-restore-1");

    const result = restoreList(list.id, "someone-else", new Date());

    expect(result).toEqual({ status: "not_found" });
  });

  it("returns forbidden for an edit-access shared user", () => {
    const list = createList("u-restore-2", { title: "Owned", template: "work", deadline: null });
    findListById(list.id)!.sharedWith.push({ userId: "u-editor", access: "edit" });
    deleteList(list.id, "u-restore-2");

    const result = restoreList(list.id, "u-editor", new Date());

    expect(result).toEqual({ status: "forbidden" });
  });

  it("does not change the list when the restore is forbidden", () => {
    const list = createList("u-restore-3", { title: "Owned", template: "work", deadline: null });
    deleteList(list.id, "u-restore-3");
    const deletedAt = findListById(list.id)!.deletedAt;

    restoreList(list.id, "someone-else", new Date());

    expect(findListById(list.id)?.deletedAt).toBe(deletedAt);
  });

  it("sets deletedAt to null for the owner within the restore window", () => {
    const list = createList("u-restore-4", { title: "Owned", template: "work", deadline: null });
    deleteList(list.id, "u-restore-4");

    const result = restoreList(list.id, "u-restore-4", new Date());

    expect(result.status).toBe("ok");
    if (result.status === "ok") {
      expect(result.list.deletedAt).toBeNull();
    }
  });

  it("preserves ownerId, title, template and deadline after restore", () => {
    const deadline = "2026-10-01T00:00:00.000Z";
    const list = createList("u-restore-5", { title: "Owned", template: "project", deadline });
    deleteList(list.id, "u-restore-5");

    const result = restoreList(list.id, "u-restore-5", new Date());

    expect(result.status).toBe("ok");
    if (result.status === "ok") {
      expect(result.list.ownerId).toBe("u-restore-5");
      expect(result.list.title).toBe("Owned");
      expect(result.list.template).toBe("project");
      expect(result.list.deadline).toBe(deadline);
    }
  });

  it("preserves taskIds after restore", () => {
    const list = createList("u-restore-6", { title: "Owned", template: "work", deadline: null });
    findListById(list.id)!.taskIds.push("t1");
    deleteList(list.id, "u-restore-6");

    const result = restoreList(list.id, "u-restore-6", new Date());

    expect(result.status).toBe("ok");
    if (result.status === "ok") {
      expect(result.list.taskIds).toEqual(["t1"]);
    }
  });

  it("preserves sharedWith after restore", () => {
    const list = createList("u-restore-7", { title: "Owned", template: "work", deadline: null });
    findListById(list.id)!.sharedWith.push({ userId: "u2", access: "read" });
    deleteList(list.id, "u-restore-7");

    const result = restoreList(list.id, "u-restore-7", new Date());

    expect(result.status).toBe("ok");
    if (result.status === "ok") {
      expect(result.list.sharedWith).toEqual([{ userId: "u2", access: "read" }]);
    }
  });

  it("appends a history entry describing the restoration", () => {
    const list = createList("u-restore-8", { title: "Owned", template: "work", deadline: null });
    deleteList(list.id, "u-restore-8");
    const deletedAt = findListById(list.id)!.deletedAt;

    const result = restoreList(list.id, "u-restore-8", new Date());

    expect(result.status).toBe("ok");
    if (result.status === "ok") {
      expect(result.list.history).toHaveLength(2);
      expect(result.list.history[1]).toMatchObject({
        field: "deletedAt",
        old: deletedAt,
        new: null,
        byUserId: "u-restore-8",
      });
    }
  });

  it("bumps lastActivityAt on restore", () => {
    const list = createList("u-restore-9", { title: "Owned", template: "work", deadline: null });
    deleteList(list.id, "u-restore-9");
    const beforeRestore = findListById(list.id)!.lastActivityAt;

    const result = restoreList(list.id, "u-restore-9", new Date());

    expect(result.status).toBe("ok");
    if (result.status === "ok") {
      expect(new Date(result.list.lastActivityAt).getTime()).toBeGreaterThanOrEqual(
        new Date(beforeRestore).getTime(),
      );
    }
  });

  it("does not modify other lists", () => {
    const untouched = createList("u-restore-10a", { title: "Untouched", template: "work", deadline: null });
    const target = createList("u-restore-10b", { title: "Target", template: "work", deadline: null });
    deleteList(target.id, "u-restore-10b");

    restoreList(target.id, "u-restore-10b", new Date());

    expect(findListById(untouched.id)).toEqual(untouched);
  });

  it("returns expired when the 30-day restore window has passed", () => {
    const now = new Date("2026-08-27T12:00:00.000Z");
    const list = createList("u-restore-11", { title: "Owned", template: "work", deadline: null });
    (findListById(list.id) as { deletedAt: string | null }).deletedAt = daysAgo(now, 31);

    const result = restoreList(list.id, "u-restore-11", now);

    expect(result).toEqual({ status: "expired" });
  });

  it("does not change the list when the restore has expired", () => {
    const now = new Date("2026-08-27T12:00:00.000Z");
    const list = createList("u-restore-12", { title: "Owned", template: "work", deadline: null });
    const expiredDeletedAt = daysAgo(now, 31);
    (findListById(list.id) as { deletedAt: string | null }).deletedAt = expiredDeletedAt;

    restoreList(list.id, "u-restore-12", now);

    expect(findListById(list.id)?.deletedAt).toBe(expiredDeletedAt);
    expect(findListById(list.id)?.history).toEqual([]);
  });

  it("allows restore exactly at the 30-day boundary", () => {
    const now = new Date("2026-08-27T12:00:00.000Z");
    const list = createList("u-restore-13", { title: "Owned", template: "work", deadline: null });
    (findListById(list.id) as { deletedAt: string | null }).deletedAt = daysAgo(now, 30);

    const result = restoreList(list.id, "u-restore-13", now);

    expect(result.status).toBe("ok");
  });

  it("is idempotent for a list that is not deleted: returns ok without changes", () => {
    const list = createList("u-restore-14", { title: "Owned", template: "work", deadline: null });
    const before = findListById(list.id)!;

    const result = restoreList(list.id, "u-restore-14", new Date());

    expect(result.status).toBe("ok");
    if (result.status === "ok") {
      expect(result.list).toEqual(before);
    }
  });

  it("is idempotent for a list that is not deleted: does not add a history entry", () => {
    const list = createList("u-restore-15", { title: "Owned", template: "work", deadline: null });

    const result = restoreList(list.id, "u-restore-15", new Date());

    expect(result.status).toBe("ok");
    if (result.status === "ok") {
      expect(result.list.history).toEqual([]);
    }
  });

  it("is idempotent for a list that is not deleted: does not bump lastActivityAt", () => {
    const list = createList("u-restore-16", { title: "Owned", template: "work", deadline: null });
    const before = list.lastActivityAt;

    const result = restoreList(list.id, "u-restore-16", new Date());

    expect(result.status).toBe("ok");
    if (result.status === "ok") {
      expect(result.list.lastActivityAt).toBe(before);
    }
  });
});

describe("duplicateList", () => {
  const NO_COPY = { copyTasks: false, copySharedWith: false };

  it("returns not_found for an unknown list id", () => {
    const result = duplicateList("does-not-exist", "u1", NO_COPY);
    expect(result).toEqual({ status: "not_found" });
  });

  it("returns not_found for a user with no relation to the list", () => {
    const list = createList("u-dup-1", { title: "Owned", template: "work", deadline: null });

    const result = duplicateList(list.id, "someone-else", NO_COPY);

    expect(result).toEqual({ status: "not_found" });
  });

  it("allows the owner to duplicate", () => {
    const list = createList("u-dup-2", { title: "Owned", template: "work", deadline: null });

    const result = duplicateList(list.id, "u-dup-2", NO_COPY);

    expect(result.status).toBe("ok");
  });

  it("allows an edit-access shared user to duplicate", () => {
    const list = createList("u-dup-3", { title: "Owned", template: "work", deadline: null });
    findListById(list.id)!.sharedWith.push({ userId: "u-editor", access: "edit" });

    const result = duplicateList(list.id, "u-editor", NO_COPY);

    expect(result.status).toBe("ok");
  });

  it("allows a read-only shared user to duplicate", () => {
    const list = createList("u-dup-4", { title: "Owned", template: "work", deadline: null });
    findListById(list.id)!.sharedWith.push({ userId: "u-viewer", access: "read" });

    const result = duplicateList(list.id, "u-viewer", NO_COPY);

    expect(result.status).toBe("ok");
  });

  it("returns deleted for a soft-deleted source list", () => {
    const list = createList("u-dup-5", { title: "Owned", template: "work", deadline: null });
    deleteList(list.id, "u-dup-5");

    const result = duplicateList(list.id, "u-dup-5", NO_COPY);

    expect(result).toEqual({ status: "deleted" });
  });

  it("assigns the calling user as owner, not the source owner", () => {
    const list = createList("u-dup-6", { title: "Owned", template: "work", deadline: null });
    findListById(list.id)!.sharedWith.push({ userId: "u-editor", access: "edit" });

    const result = duplicateList(list.id, "u-editor", NO_COPY);

    expect(result.status).toBe("ok");
    if (result.status === "ok") {
      expect(result.list.ownerId).toBe("u-editor");
    }
  });

  it("creates a list with a new id distinct from the source", () => {
    const list = createList("u-dup-7", { title: "Owned", template: "work", deadline: null });

    const result = duplicateList(list.id, "u-dup-7", NO_COPY);

    expect(result.status).toBe("ok");
    if (result.status === "ok") {
      expect(result.list.id).not.toBe(list.id);
    }
  });

  it("copies title, template and deadline", () => {
    const deadline = "2026-09-01T00:00:00.000Z";
    const list = createList("u-dup-8", { title: "Project X", template: "project", deadline });

    const result = duplicateList(list.id, "u-dup-8", NO_COPY);

    expect(result.status).toBe("ok");
    if (result.status === "ok") {
      expect(result.list.title).toBe("Project X");
      expect(result.list.template).toBe("project");
      expect(result.list.deadline).toBe(deadline);
    }
  });

  it("does not modify the source list", () => {
    const list = createList("u-dup-9", { title: "Owned", template: "work", deadline: null });
    const snapshot = { ...findListById(list.id)! };

    duplicateList(list.id, "u-dup-9", NO_COPY);

    expect(findListById(list.id)).toEqual(snapshot);
  });

  it("does not modify other lists", () => {
    const untouched = createList("u-dup-10a", { title: "Untouched", template: "work", deadline: null });
    const target = createList("u-dup-10b", { title: "Target", template: "work", deadline: null });

    duplicateList(target.id, "u-dup-10b", NO_COPY);

    expect(findListById(untouched.id)).toEqual(untouched);
  });

  it("gives the duplicate independent history, no deletedAt and a fresh lastActivityAt", () => {
    const list = createList("u-dup-11", { title: "Owned", template: "work", deadline: null });
    updateList(list.id, "u-dup-11", { title: "Renamed" });

    const result = duplicateList(list.id, "u-dup-11", NO_COPY);

    expect(result.status).toBe("ok");
    if (result.status === "ok") {
      expect(result.list.history).toEqual([]);
      expect(result.list.deletedAt).toBeNull();
      expect(result.list.lastActivityAt).toBeTruthy();
    }
  });

  it("does not copy taskIds when copyTasks is false", () => {
    const list = createList("u-dup-12", { title: "Owned", template: "work", deadline: null });
    createTask({ listId: list.id, title: "Task A", description: "", priority: 3, category: null, tags: [], parentId: null, deadline: null, estimatedMin: 0 });

    const result = duplicateList(list.id, "u-dup-12", NO_COPY);

    expect(result.status).toBe("ok");
    if (result.status === "ok") {
      expect(result.list.taskIds).toEqual([]);
    }
  });

  it("does not copy sharedWith when copySharedWith is false", () => {
    const list = createList("u-dup-13", { title: "Owned", template: "work", deadline: null });
    findListById(list.id)!.sharedWith.push({ userId: "u2", access: "read" });

    const result = duplicateList(list.id, "u-dup-13", NO_COPY);

    expect(result.status).toBe("ok");
    if (result.status === "ok") {
      expect(result.list.sharedWith).toEqual([]);
    }
  });

  it("copies sharedWith when copySharedWith is true", () => {
    const list = createList("u-dup-14", { title: "Owned", template: "work", deadline: null });
    findListById(list.id)!.sharedWith.push({ userId: "u2", access: "read" });

    const result = duplicateList(list.id, "u-dup-14", { copyTasks: false, copySharedWith: true });

    expect(result.status).toBe("ok");
    if (result.status === "ok") {
      expect(result.list.sharedWith).toEqual([{ userId: "u2", access: "read" }]);
    }
  });

  it("creates new tasks with new ids and the new listId when copyTasks is true", () => {
    const list = createList("u-dup-15", { title: "Owned", template: "work", deadline: null });
    const task = createTask({
      listId: list.id,
      title: "Task A",
      description: "",
      priority: 3,
      category: null,
      tags: [],
      parentId: null,
      deadline: null,
      estimatedMin: 0,
    });

    const result = duplicateList(list.id, "u-dup-15", { copyTasks: true, copySharedWith: false });

    expect(result.status).toBe("ok");
    if (result.status === "ok") {
      expect(result.list.taskIds).toHaveLength(1);
      const newTaskId = result.list.taskIds[0];
      expect(newTaskId).not.toBe(task.id);
      const newTask = findTaskById(newTaskId);
      expect(newTask?.listId).toBe(result.list.id);
      expect(newTask?.title).toBe("Task A");
    }
  });

  it("does not modify the original tasks when copyTasks is true", () => {
    const list = createList("u-dup-16", { title: "Owned", template: "work", deadline: null });
    const task = createTask({
      listId: list.id,
      title: "Task A",
      description: "",
      priority: 3,
      category: null,
      tags: [],
      parentId: null,
      deadline: null,
      estimatedMin: 0,
    });

    duplicateList(list.id, "u-dup-16", { copyTasks: true, copySharedWith: false });

    expect(findTaskById(task.id)).toEqual(task);
    expect(findListById(list.id)!.taskIds).toEqual([task.id]);
  });

  it("does not create tasks when copyTasks is false even if the source has tasks", () => {
    const list = createList("u-dup-17", { title: "Owned", template: "work", deadline: null });
    createTask({
      listId: list.id,
      title: "Task A",
      description: "",
      priority: 3,
      category: null,
      tags: [],
      parentId: null,
      deadline: null,
      estimatedMin: 0,
    });
    const before = countTasks();

    duplicateList(list.id, "u-dup-17", NO_COPY);

    expect(countTasks()).toBe(before);
  });

  it("creates a further new list on a repeated duplicate call", () => {
    const list = createList("u-dup-18", { title: "Owned", template: "work", deadline: null });

    const first = duplicateList(list.id, "u-dup-18", NO_COPY);
    const second = duplicateList(list.id, "u-dup-18", NO_COPY);

    expect(first.status).toBe("ok");
    expect(second.status).toBe("ok");
    if (first.status === "ok" && second.status === "ok") {
      expect(first.list.id).not.toBe(second.list.id);
    }
  });
});

describe("shareList", () => {
  it("returns not_found for an unknown list id", () => {
    const result = shareList("does-not-exist", "u-share-1", { userId: "u2", access: "read" });
    expect(result).toEqual({ status: "not_found" });
  });

  it("returns not_found for a caller who does not own the list", () => {
    const list = createList("u-share-2", { title: "Owned", template: "work", deadline: null });

    const result = shareList(list.id, "someone-else", { userId: "u2", access: "read" });

    expect(result).toEqual({ status: "not_found" });
  });

  it("returns forbidden for an edit-access shared user (only the owner may manage sharing)", () => {
    const list = createList("u-share-3", { title: "Owned", template: "work", deadline: null });
    findListById(list.id)!.sharedWith.push({ userId: "u-editor", access: "edit" });

    const result = shareList(list.id, "u-editor", { userId: "u2", access: "read" });

    expect(result).toEqual({ status: "forbidden" });
  });

  it("returns deleted for a soft-deleted list", () => {
    const list = createList("u-share-4", { title: "Owned", template: "work", deadline: null });
    deleteList(list.id, "u-share-4");

    const result = shareList(list.id, "u-share-4", { userId: "u2", access: "read" });

    expect(result).toEqual({ status: "deleted" });
  });

  it("returns user_not_found for an unknown target userId", () => {
    const list = createList("u-share-5", { title: "Owned", template: "work", deadline: null });

    const result = shareList(list.id, "u-share-5", { userId: "does-not-exist", access: "read" });

    expect(result).toEqual({ status: "user_not_found" });
  });

  it("returns user_not_found for an unknown target email", () => {
    const list = createList("u-share-6", { title: "Owned", template: "work", deadline: null });

    const result = shareList(list.id, "u-share-6", { email: "nobody@example.com", access: "read" });

    expect(result).toEqual({ status: "user_not_found" });
  });

  it("returns self_share when the owner tries to share the list with themselves via userId", () => {
    const list = createList("u1", { title: "Owned", template: "work", deadline: null });

    const result = shareList(list.id, "u1", { userId: "u1", access: "read" });

    expect(result).toEqual({ status: "self_share" });
  });

  it("returns self_share when the owner tries to share the list with themselves via email", () => {
    const list = createList("u1", { title: "Owned", template: "work", deadline: null });

    const result = shareList(list.id, "u1", { email: "admin@example.com", access: "read" });

    expect(result).toEqual({ status: "self_share" });
  });

  it("adds a new read-access share resolved by userId", () => {
    const list = createList("u-share-7", { title: "Owned", template: "work", deadline: null });

    const result = shareList(list.id, "u-share-7", { userId: "u2", access: "read" });

    expect(result.status).toBe("ok");
    if (result.status === "ok") {
      expect(result.list.sharedWith).toEqual([{ userId: "u2", access: "read" }]);
    }
  });

  it("adds a new edit-access share resolved by email", () => {
    const list = createList("u-share-8", { title: "Owned", template: "work", deadline: null });

    const result = shareList(list.id, "u-share-8", { email: "user@example.com", access: "edit" });

    expect(result.status).toBe("ok");
    if (result.status === "ok") {
      expect(result.list.sharedWith).toEqual([{ userId: "u2", access: "edit" }]);
    }
  });

  it("email lookup is case-insensitive", () => {
    const list = createList("u-share-9", { title: "Owned", template: "work", deadline: null });

    const result = shareList(list.id, "u-share-9", { email: "USER@EXAMPLE.COM", access: "read" });

    expect(result.status).toBe("ok");
    if (result.status === "ok") {
      expect(result.list.sharedWith).toEqual([{ userId: "u2", access: "read" }]);
    }
  });

  it("updates the access level when the target is already shared with", () => {
    const list = createList("u-share-10", { title: "Owned", template: "work", deadline: null });
    findListById(list.id)!.sharedWith.push({ userId: "u2", access: "read" });

    const result = shareList(list.id, "u-share-10", { userId: "u2", access: "edit" });

    expect(result.status).toBe("ok");
    if (result.status === "ok") {
      expect(result.list.sharedWith).toEqual([{ userId: "u2", access: "edit" }]);
    }
  });

  it("does not duplicate an entry for a user already shared with", () => {
    const list = createList("u-share-11", { title: "Owned", template: "work", deadline: null });
    findListById(list.id)!.sharedWith.push({ userId: "u2", access: "read" });

    const result = shareList(list.id, "u-share-11", { userId: "u2", access: "read" });

    expect(result.status).toBe("ok");
    if (result.status === "ok") {
      expect(result.list.sharedWith).toHaveLength(1);
    }
  });

  it("preserves existing shares for other users", () => {
    const list = createList("u-share-12", { title: "Owned", template: "work", deadline: null });
    findListById(list.id)!.sharedWith.push({ userId: "u2", access: "read" });

    const result = shareList(list.id, "u-share-12", { userId: "u3", access: "edit" });

    expect(result.status).toBe("ok");
    if (result.status === "ok") {
      expect(result.list.sharedWith).toEqual([
        { userId: "u2", access: "read" },
        { userId: "u3", access: "edit" },
      ]);
    }
  });

  it("does not change ownerId, title, template or taskIds", () => {
    const list = createList("u-share-13", { title: "Owned", template: "project", deadline: null });
    findListById(list.id)!.taskIds.push("t1");

    const result = shareList(list.id, "u-share-13", { userId: "u2", access: "read" });

    expect(result.status).toBe("ok");
    if (result.status === "ok") {
      expect(result.list.ownerId).toBe("u-share-13");
      expect(result.list.title).toBe("Owned");
      expect(result.list.template).toBe("project");
      expect(result.list.taskIds).toEqual(["t1"]);
    }
  });

  it("bumps lastActivityAt on a successful share", () => {
    const list = createList("u-share-14", { title: "Owned", template: "work", deadline: null });
    const before = list.lastActivityAt;

    const result = shareList(list.id, "u-share-14", { userId: "u2", access: "read" });

    expect(result.status).toBe("ok");
    if (result.status === "ok") {
      expect(new Date(result.list.lastActivityAt).getTime()).toBeGreaterThanOrEqual(new Date(before).getTime());
    }
  });

  it("does not modify other lists", () => {
    const untouched = createList("u-share-15a", { title: "Untouched", template: "work", deadline: null });
    const target = createList("u-share-15b", { title: "Target", template: "work", deadline: null });

    shareList(target.id, "u-share-15b", { userId: "u2", access: "read" });

    expect(findListById(untouched.id)).toEqual(untouched);
  });

  it("does not change the list when forbidden", () => {
    const list = createList("u-share-16", { title: "Owned", template: "work", deadline: null });

    shareList(list.id, "someone-else", { userId: "u2", access: "read" });

    expect(findListById(list.id)?.sharedWith).toEqual([]);
  });

  it("does not change the list when the target user is not found", () => {
    const list = createList("u-share-17", { title: "Owned", template: "work", deadline: null });

    shareList(list.id, "u-share-17", { userId: "does-not-exist", access: "read" });

    expect(findListById(list.id)?.sharedWith).toEqual([]);
  });
});
