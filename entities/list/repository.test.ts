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
  it("creates a list owned by the given user with the given title and template", async () => {
    const list = await createList("u-create-1", { title: "New list", template: "work", deadline: null });

    expect(list.ownerId).toBe("u-create-1");
    expect(list.title).toBe("New list");
    expect(list.template).toBe("work");
  });

  it("initializes generated fields correctly", async () => {
    const list = await createList("u-create-2", { title: "Another list", template: "personal", deadline: null });

    expect(list.id).toBeTruthy();
    expect(list.taskIds).toEqual([]);
    expect(list.sharedWith).toEqual([]);
    expect(list.history).toEqual([]);
    expect(list.deletedAt).toBeNull();
    expect(list.lastActivityAt).toBeTruthy();
  });

  it("stores the given deadline", async () => {
    const deadline = "2026-09-01T00:00:00.000Z";
    const list = await createList("u-create-3", { title: "Deadline list", template: "project", deadline });

    expect(list.deadline).toBe(deadline);
  });

  it("assigns a unique id to each created list", async () => {
    const first = await createList("u-create-4", { title: "First", template: "work", deadline: null });
    const second = await createList("u-create-4", { title: "Second", template: "work", deadline: null });

    expect(first.id).not.toBe(second.id);
  });

  it("persists the list so it can be found by id", async () => {
    const list = await createList("u-create-5", { title: "Findable", template: "project", deadline: null });

    expect(await findListById(list.id)).toEqual(list);
  });

  it("does not remove or modify existing lists", async () => {
    const existing = await createList("u-create-6a", { title: "Pre-existing", template: "work", deadline: null });
    const beforeCount = (await listLists()).length;

    await createList("u-create-6b", { title: "New one", template: "work", deadline: null });

    expect((await listLists()).length).toBe(beforeCount + 1);
    expect(await findListById(existing.id)).toEqual(existing);
  });
});

describe("updateList", () => {
  it("returns not_found for an unknown list id", async () => {
    const result = await updateList("does-not-exist", "u1", { title: "New title" });
    expect(result).toEqual({ status: "not_found" });
  });

  it("updates an allowed field for the owner", async () => {
    const list = await createList("u-update-1", { title: "Old title", template: "work", deadline: null });

    const result = await updateList(list.id, "u-update-1", { title: "New title" });

    expect(result.status).toBe("ok");
    if (result.status === "ok") {
      expect(result.list.title).toBe("New title");
    }
  });

  it("returns not_found for a user with no relation to the list (cannot view it)", async () => {
    const list = await createList("u-update-2", { title: "Owned", template: "work", deadline: null });

    const result = await updateList(list.id, "someone-else", { title: "Hijacked" });

    expect(result).toEqual({ status: "not_found" });
  });

  it("does not change the list when the caller cannot view it", async () => {
    const list = await createList("u-update-3", { title: "Owned", template: "work", deadline: null });

    await updateList(list.id, "someone-else", { title: "Hijacked" });

    expect((await findListById(list.id))?.title).toBe("Owned");
  });

  it("returns not_found for a stranger targeting an already soft-deleted list", async () => {
    const list = await createList("u-update-15", { title: "Owned", template: "work", deadline: null });
    (await findListById(list.id) as { deletedAt: string | null }).deletedAt = "2026-08-10T00:00:00.000Z";

    const result = await updateList(list.id, "someone-else", { title: "Hijacked" });

    expect(result).toEqual({ status: "not_found" });
  });

  it("does not change ownerId", async () => {
    const list = await createList("u-update-4", { title: "Owned", template: "work", deadline: null });

    const result = await updateList(list.id, "u-update-4", { title: "Renamed" });

    expect(result.status).toBe("ok");
    if (result.status === "ok") {
      expect(result.list.ownerId).toBe("u-update-4");
    }
  });

  it("preserves taskIds across an update", async () => {
    const list = await createList("u-update-5", { title: "Owned", template: "work", deadline: null });
    (await findListById(list.id))!.taskIds.push("t1");

    const result = await updateList(list.id, "u-update-5", { title: "Renamed" });

    expect(result.status).toBe("ok");
    if (result.status === "ok") {
      expect(result.list.taskIds).toEqual(["t1"]);
    }
  });

  it("preserves sharedWith across an update", async () => {
    const list = await createList("u-update-6", { title: "Owned", template: "work", deadline: null });
    (await findListById(list.id))!.sharedWith.push({ userId: "u2", access: "read" });

    const result = await updateList(list.id, "u-update-6", { title: "Renamed" });

    expect(result.status).toBe("ok");
    if (result.status === "ok") {
      expect(result.list.sharedWith).toEqual([{ userId: "u2", access: "read" }]);
    }
  });

  it("appends a history entry describing the change", async () => {
    const list = await createList("u-update-7", { title: "Old title", template: "work", deadline: null });

    const result = await updateList(list.id, "u-update-7", { title: "New title" });

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

  it("bumps lastActivityAt when a real change is applied", async () => {
    const list = await createList("u-update-8", { title: "Old title", template: "work", deadline: null });
    const before = list.lastActivityAt;

    const result = await updateList(list.id, "u-update-8", { title: "New title" });

    expect(result.status).toBe("ok");
    if (result.status === "ok") {
      expect(new Date(result.list.lastActivityAt).getTime()).toBeGreaterThanOrEqual(new Date(before).getTime());
    }
  });

  it("does not add a history entry for a no-op update", async () => {
    const list = await createList("u-update-9", { title: "Same title", template: "work", deadline: null });

    const result = await updateList(list.id, "u-update-9", { title: "Same title" });

    expect(result.status).toBe("ok");
    if (result.status === "ok") {
      expect(result.list.history).toEqual([]);
    }
  });

  it("does not bump lastActivityAt for a no-op update", async () => {
    const list = await createList("u-update-10", { title: "Same title", template: "work", deadline: null });
    const before = list.lastActivityAt;

    const result = await updateList(list.id, "u-update-10", { title: "Same title" });

    expect(result.status).toBe("ok");
    if (result.status === "ok") {
      expect(result.list.lastActivityAt).toBe(before);
    }
  });

  it("does not modify other lists", async () => {
    const untouched = await createList("u-update-11a", { title: "Untouched", template: "work", deadline: null });
    const target = await createList("u-update-11b", { title: "Target", template: "work", deadline: null });

    await updateList(target.id, "u-update-11b", { title: "Renamed" });

    expect(await findListById(untouched.id)).toEqual(untouched);
  });

  it("returns forbidden for a read-only shared user", async () => {
    const list = await createList("u-update-12", { title: "Owned", template: "work", deadline: null });
    (await findListById(list.id))!.sharedWith.push({ userId: "u-viewer", access: "read" });

    const result = await updateList(list.id, "u-viewer", { title: "Hijacked" });

    expect(result).toEqual({ status: "forbidden" });
  });

  it("allows an edit-access shared user to update the list", async () => {
    const list = await createList("u-update-13", { title: "Owned", template: "work", deadline: null });
    (await findListById(list.id))!.sharedWith.push({ userId: "u-editor", access: "edit" });

    const result = await updateList(list.id, "u-editor", { title: "Edited by collaborator" });

    expect(result.status).toBe("ok");
    if (result.status === "ok") {
      expect(result.list.title).toBe("Edited by collaborator");
    }
  });

  it("returns deleted for a soft-deleted list owned by the caller", async () => {
    const list = await createList("u-update-14", { title: "Owned", template: "work", deadline: null });
    const db = (await findListById(list.id))!;
    (db as { deletedAt: string | null }).deletedAt = "2026-08-10T00:00:00.000Z";

    const result = await updateList(list.id, "u-update-14", { title: "Should not apply" });

    expect(result).toEqual({ status: "deleted" });
  });
});

describe("deleteList", () => {
  it("returns not_found for an unknown list id", async () => {
    const result = await deleteList("does-not-exist", "u1");
    expect(result).toEqual({ status: "not_found" });
  });

  it("returns not_found for a user with no relation to the list (cannot view it)", async () => {
    const list = await createList("u-delete-1", { title: "Owned", template: "work", deadline: null });

    const result = await deleteList(list.id, "someone-else");

    expect(result).toEqual({ status: "not_found" });
  });

  it("returns forbidden for an edit-access shared user", async () => {
    const list = await createList("u-delete-2", { title: "Owned", template: "work", deadline: null });
    (await findListById(list.id))!.sharedWith.push({ userId: "u-editor", access: "edit" });

    const result = await deleteList(list.id, "u-editor");

    expect(result).toEqual({ status: "forbidden" });
  });

  it("returns forbidden for a read-only shared user", async () => {
    const list = await createList("u-delete-2b", { title: "Owned", template: "work", deadline: null });
    (await findListById(list.id))!.sharedWith.push({ userId: "u-viewer", access: "read" });

    const result = await deleteList(list.id, "u-viewer");

    expect(result).toEqual({ status: "forbidden" });
  });

  it("returns not_found for a stranger targeting an already soft-deleted list", async () => {
    const list = await createList("u-delete-2c", { title: "Owned", template: "work", deadline: null });
    await deleteList(list.id, "u-delete-2c");

    const result = await deleteList(list.id, "someone-else");

    expect(result).toEqual({ status: "not_found" });
  });

  it("does not change the list when the caller cannot view it", async () => {
    const list = await createList("u-delete-3", { title: "Owned", template: "work", deadline: null });

    await deleteList(list.id, "someone-else");

    expect((await findListById(list.id))?.deletedAt).toBeNull();
  });

  it("sets deletedAt for the owner", async () => {
    const list = await createList("u-delete-4", { title: "Owned", template: "work", deadline: null });

    const result = await deleteList(list.id, "u-delete-4");

    expect(result.status).toBe("ok");
    if (result.status === "ok") {
      expect(result.list.deletedAt).not.toBeNull();
    }
  });

  it("does not remove the list from storage", async () => {
    const list = await createList("u-delete-5", { title: "Owned", template: "work", deadline: null });

    await deleteList(list.id, "u-delete-5");

    expect(await findListById(list.id)).toBeDefined();
    expect((await listLists()).some((l) => l.id === list.id)).toBe(true);
  });

  it("preserves taskIds after deletion", async () => {
    const list = await createList("u-delete-6", { title: "Owned", template: "work", deadline: null });
    (await findListById(list.id))!.taskIds.push("t1");

    const result = await deleteList(list.id, "u-delete-6");

    expect(result.status).toBe("ok");
    if (result.status === "ok") {
      expect(result.list.taskIds).toEqual(["t1"]);
    }
  });

  it("preserves sharedWith after deletion", async () => {
    const list = await createList("u-delete-7", { title: "Owned", template: "work", deadline: null });
    (await findListById(list.id))!.sharedWith.push({ userId: "u2", access: "read" });

    const result = await deleteList(list.id, "u-delete-7");

    expect(result.status).toBe("ok");
    if (result.status === "ok") {
      expect(result.list.sharedWith).toEqual([{ userId: "u2", access: "read" }]);
    }
  });

  it("appends a history entry describing the deletion", async () => {
    const list = await createList("u-delete-8", { title: "Owned", template: "work", deadline: null });

    const result = await deleteList(list.id, "u-delete-8");

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

  it("bumps lastActivityAt on deletion", async () => {
    const list = await createList("u-delete-9", { title: "Owned", template: "work", deadline: null });
    const before = list.lastActivityAt;

    const result = await deleteList(list.id, "u-delete-9");

    expect(result.status).toBe("ok");
    if (result.status === "ok") {
      expect(new Date(result.list.lastActivityAt).getTime()).toBeGreaterThanOrEqual(new Date(before).getTime());
    }
  });

  it("does not modify other lists", async () => {
    const untouched = await createList("u-delete-10a", { title: "Untouched", template: "work", deadline: null });
    const target = await createList("u-delete-10b", { title: "Target", template: "work", deadline: null });

    await deleteList(target.id, "u-delete-10b");

    expect(await findListById(untouched.id)).toEqual(untouched);
  });

  it("is idempotent for an already-deleted list: keeps the original deletedAt", async () => {
    const list = await createList("u-delete-11", { title: "Owned", template: "work", deadline: null });
    const first = await deleteList(list.id, "u-delete-11");
    expect(first.status).toBe("ok");
    const deletedAtAfterFirst = first.status === "ok" ? first.list.deletedAt : null;

    const second = await deleteList(list.id, "u-delete-11");

    expect(second.status).toBe("ok");
    if (second.status === "ok") {
      expect(second.list.deletedAt).toBe(deletedAtAfterFirst);
    }
  });

  it("is idempotent for an already-deleted list: does not add another history entry", async () => {
    const list = await createList("u-delete-12", { title: "Owned", template: "work", deadline: null });
    await deleteList(list.id, "u-delete-12");

    const second = await deleteList(list.id, "u-delete-12");

    expect(second.status).toBe("ok");
    if (second.status === "ok") {
      expect(second.list.history).toHaveLength(1);
    }
  });
});

describe("restoreList", () => {
  it("returns not_found for an unknown list id", async () => {
    const result = await restoreList("does-not-exist", "u1", new Date());
    expect(result).toEqual({ status: "not_found" });
  });

  it("returns not_found for a user who does not own the list", async () => {
    const list = await createList("u-restore-1", { title: "Owned", template: "work", deadline: null });
    await deleteList(list.id, "u-restore-1");

    const result = await restoreList(list.id, "someone-else", new Date());

    expect(result).toEqual({ status: "not_found" });
  });

  it("returns forbidden for an edit-access shared user", async () => {
    const list = await createList("u-restore-2", { title: "Owned", template: "work", deadline: null });
    (await findListById(list.id))!.sharedWith.push({ userId: "u-editor", access: "edit" });
    await deleteList(list.id, "u-restore-2");

    const result = await restoreList(list.id, "u-editor", new Date());

    expect(result).toEqual({ status: "forbidden" });
  });

  it("does not change the list when the restore is forbidden", async () => {
    const list = await createList("u-restore-3", { title: "Owned", template: "work", deadline: null });
    await deleteList(list.id, "u-restore-3");
    const deletedAt = (await findListById(list.id))!.deletedAt;

    await restoreList(list.id, "someone-else", new Date());

    expect((await findListById(list.id))?.deletedAt).toBe(deletedAt);
  });

  it("sets deletedAt to null for the owner within the restore window", async () => {
    const list = await createList("u-restore-4", { title: "Owned", template: "work", deadline: null });
    await deleteList(list.id, "u-restore-4");

    const result = await restoreList(list.id, "u-restore-4", new Date());

    expect(result.status).toBe("ok");
    if (result.status === "ok") {
      expect(result.list.deletedAt).toBeNull();
    }
  });

  it("preserves ownerId, title, template and deadline after restore", async () => {
    const deadline = "2026-10-01T00:00:00.000Z";
    const list = await createList("u-restore-5", { title: "Owned", template: "project", deadline });
    await deleteList(list.id, "u-restore-5");

    const result = await restoreList(list.id, "u-restore-5", new Date());

    expect(result.status).toBe("ok");
    if (result.status === "ok") {
      expect(result.list.ownerId).toBe("u-restore-5");
      expect(result.list.title).toBe("Owned");
      expect(result.list.template).toBe("project");
      expect(result.list.deadline).toBe(deadline);
    }
  });

  it("preserves taskIds after restore", async () => {
    const list = await createList("u-restore-6", { title: "Owned", template: "work", deadline: null });
    (await findListById(list.id))!.taskIds.push("t1");
    await deleteList(list.id, "u-restore-6");

    const result = await restoreList(list.id, "u-restore-6", new Date());

    expect(result.status).toBe("ok");
    if (result.status === "ok") {
      expect(result.list.taskIds).toEqual(["t1"]);
    }
  });

  it("preserves sharedWith after restore", async () => {
    const list = await createList("u-restore-7", { title: "Owned", template: "work", deadline: null });
    (await findListById(list.id))!.sharedWith.push({ userId: "u2", access: "read" });
    await deleteList(list.id, "u-restore-7");

    const result = await restoreList(list.id, "u-restore-7", new Date());

    expect(result.status).toBe("ok");
    if (result.status === "ok") {
      expect(result.list.sharedWith).toEqual([{ userId: "u2", access: "read" }]);
    }
  });

  it("appends a history entry describing the restoration", async () => {
    const list = await createList("u-restore-8", { title: "Owned", template: "work", deadline: null });
    await deleteList(list.id, "u-restore-8");
    const deletedAt = (await findListById(list.id))!.deletedAt;

    const result = await restoreList(list.id, "u-restore-8", new Date());

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

  it("bumps lastActivityAt on restore", async () => {
    const list = await createList("u-restore-9", { title: "Owned", template: "work", deadline: null });
    await deleteList(list.id, "u-restore-9");
    const beforeRestore = (await findListById(list.id))!.lastActivityAt;

    const result = await restoreList(list.id, "u-restore-9", new Date());

    expect(result.status).toBe("ok");
    if (result.status === "ok") {
      expect(new Date(result.list.lastActivityAt).getTime()).toBeGreaterThanOrEqual(
        new Date(beforeRestore).getTime(),
      );
    }
  });

  it("does not modify other lists", async () => {
    const untouched = await createList("u-restore-10a", { title: "Untouched", template: "work", deadline: null });
    const target = await createList("u-restore-10b", { title: "Target", template: "work", deadline: null });
    await deleteList(target.id, "u-restore-10b");

    await restoreList(target.id, "u-restore-10b", new Date());

    expect(await findListById(untouched.id)).toEqual(untouched);
  });

  it("returns expired when the 30-day restore window has passed", async () => {
    const now = new Date("2026-08-27T12:00:00.000Z");
    const list = await createList("u-restore-11", { title: "Owned", template: "work", deadline: null });
    (await findListById(list.id) as { deletedAt: string | null }).deletedAt = daysAgo(now, 31);

    const result = await restoreList(list.id, "u-restore-11", now);

    expect(result).toEqual({ status: "expired" });
  });

  it("does not change the list when the restore has expired", async () => {
    const now = new Date("2026-08-27T12:00:00.000Z");
    const list = await createList("u-restore-12", { title: "Owned", template: "work", deadline: null });
    const expiredDeletedAt = daysAgo(now, 31);
    (await findListById(list.id) as { deletedAt: string | null }).deletedAt = expiredDeletedAt;

    await restoreList(list.id, "u-restore-12", now);

    expect((await findListById(list.id))?.deletedAt).toBe(expiredDeletedAt);
    expect((await findListById(list.id))?.history).toEqual([]);
  });

  it("allows restore exactly at the 30-day boundary", async () => {
    const now = new Date("2026-08-27T12:00:00.000Z");
    const list = await createList("u-restore-13", { title: "Owned", template: "work", deadline: null });
    (await findListById(list.id) as { deletedAt: string | null }).deletedAt = daysAgo(now, 30);

    const result = await restoreList(list.id, "u-restore-13", now);

    expect(result.status).toBe("ok");
  });

  it("is idempotent for a list that is not deleted: returns ok without changes", async () => {
    const list = await createList("u-restore-14", { title: "Owned", template: "work", deadline: null });
    const before = (await findListById(list.id))!;

    const result = await restoreList(list.id, "u-restore-14", new Date());

    expect(result.status).toBe("ok");
    if (result.status === "ok") {
      expect(result.list).toEqual(before);
    }
  });

  it("is idempotent for a list that is not deleted: does not add a history entry", async () => {
    const list = await createList("u-restore-15", { title: "Owned", template: "work", deadline: null });

    const result = await restoreList(list.id, "u-restore-15", new Date());

    expect(result.status).toBe("ok");
    if (result.status === "ok") {
      expect(result.list.history).toEqual([]);
    }
  });

  it("is idempotent for a list that is not deleted: does not bump lastActivityAt", async () => {
    const list = await createList("u-restore-16", { title: "Owned", template: "work", deadline: null });
    const before = list.lastActivityAt;

    const result = await restoreList(list.id, "u-restore-16", new Date());

    expect(result.status).toBe("ok");
    if (result.status === "ok") {
      expect(result.list.lastActivityAt).toBe(before);
    }
  });
});

describe("duplicateList", () => {
  const NO_COPY = { copyTasks: false, copySharedWith: false };

  it("returns not_found for an unknown list id", async () => {
    const result = await duplicateList("does-not-exist", "u1", NO_COPY);
    expect(result).toEqual({ status: "not_found" });
  });

  it("returns not_found for a user with no relation to the list", async () => {
    const list = await createList("u-dup-1", { title: "Owned", template: "work", deadline: null });

    const result = await duplicateList(list.id, "someone-else", NO_COPY);

    expect(result).toEqual({ status: "not_found" });
  });

  it("allows the owner to duplicate", async () => {
    const list = await createList("u-dup-2", { title: "Owned", template: "work", deadline: null });

    const result = await duplicateList(list.id, "u-dup-2", NO_COPY);

    expect(result.status).toBe("ok");
  });

  it("allows an edit-access shared user to duplicate", async () => {
    const list = await createList("u-dup-3", { title: "Owned", template: "work", deadline: null });
    (await findListById(list.id))!.sharedWith.push({ userId: "u-editor", access: "edit" });

    const result = await duplicateList(list.id, "u-editor", NO_COPY);

    expect(result.status).toBe("ok");
  });

  it("allows a read-only shared user to duplicate", async () => {
    const list = await createList("u-dup-4", { title: "Owned", template: "work", deadline: null });
    (await findListById(list.id))!.sharedWith.push({ userId: "u-viewer", access: "read" });

    const result = await duplicateList(list.id, "u-viewer", NO_COPY);

    expect(result.status).toBe("ok");
  });

  it("returns deleted for a soft-deleted source list", async () => {
    const list = await createList("u-dup-5", { title: "Owned", template: "work", deadline: null });
    await deleteList(list.id, "u-dup-5");

    const result = await duplicateList(list.id, "u-dup-5", NO_COPY);

    expect(result).toEqual({ status: "deleted" });
  });

  it("assigns the calling user as owner, not the source owner", async () => {
    const list = await createList("u-dup-6", { title: "Owned", template: "work", deadline: null });
    (await findListById(list.id))!.sharedWith.push({ userId: "u-editor", access: "edit" });

    const result = await duplicateList(list.id, "u-editor", NO_COPY);

    expect(result.status).toBe("ok");
    if (result.status === "ok") {
      expect(result.list.ownerId).toBe("u-editor");
    }
  });

  it("creates a list with a new id distinct from the source", async () => {
    const list = await createList("u-dup-7", { title: "Owned", template: "work", deadline: null });

    const result = await duplicateList(list.id, "u-dup-7", NO_COPY);

    expect(result.status).toBe("ok");
    if (result.status === "ok") {
      expect(result.list.id).not.toBe(list.id);
    }
  });

  it("copies title, template and deadline", async () => {
    const deadline = "2026-09-01T00:00:00.000Z";
    const list = await createList("u-dup-8", { title: "Project X", template: "project", deadline });

    const result = await duplicateList(list.id, "u-dup-8", NO_COPY);

    expect(result.status).toBe("ok");
    if (result.status === "ok") {
      expect(result.list.title).toBe("Project X");
      expect(result.list.template).toBe("project");
      expect(result.list.deadline).toBe(deadline);
    }
  });

  it("does not modify the source list", async () => {
    const list = await createList("u-dup-9", { title: "Owned", template: "work", deadline: null });
    const snapshot = { ...(await findListById(list.id))! };

    await duplicateList(list.id, "u-dup-9", NO_COPY);

    expect(await findListById(list.id)).toEqual(snapshot);
  });

  it("does not modify other lists", async () => {
    const untouched = await createList("u-dup-10a", { title: "Untouched", template: "work", deadline: null });
    const target = await createList("u-dup-10b", { title: "Target", template: "work", deadline: null });

    await duplicateList(target.id, "u-dup-10b", NO_COPY);

    expect(await findListById(untouched.id)).toEqual(untouched);
  });

  it("gives the duplicate independent history, no deletedAt and a fresh lastActivityAt", async () => {
    const list = await createList("u-dup-11", { title: "Owned", template: "work", deadline: null });
    await updateList(list.id, "u-dup-11", { title: "Renamed" });

    const result = await duplicateList(list.id, "u-dup-11", NO_COPY);

    expect(result.status).toBe("ok");
    if (result.status === "ok") {
      expect(result.list.history).toEqual([]);
      expect(result.list.deletedAt).toBeNull();
      expect(result.list.lastActivityAt).toBeTruthy();
    }
  });

  it("does not copy taskIds when copyTasks is false", async () => {
    const list = await createList("u-dup-12", { title: "Owned", template: "work", deadline: null });
    await createTask({ listId: list.id, title: "Task A", description: "", priority: 3, category: null, tags: [], parentId: null, deadline: null, estimatedMin: 0 });

    const result = await duplicateList(list.id, "u-dup-12", NO_COPY);

    expect(result.status).toBe("ok");
    if (result.status === "ok") {
      expect(result.list.taskIds).toEqual([]);
    }
  });

  it("does not copy sharedWith when copySharedWith is false", async () => {
    const list = await createList("u-dup-13", { title: "Owned", template: "work", deadline: null });
    (await findListById(list.id))!.sharedWith.push({ userId: "u2", access: "read" });

    const result = await duplicateList(list.id, "u-dup-13", NO_COPY);

    expect(result.status).toBe("ok");
    if (result.status === "ok") {
      expect(result.list.sharedWith).toEqual([]);
    }
  });

  it("copies sharedWith when copySharedWith is true", async () => {
    const list = await createList("u-dup-14", { title: "Owned", template: "work", deadline: null });
    (await findListById(list.id))!.sharedWith.push({ userId: "u2", access: "read" });

    const result = await duplicateList(list.id, "u-dup-14", { copyTasks: false, copySharedWith: true });

    expect(result.status).toBe("ok");
    if (result.status === "ok") {
      expect(result.list.sharedWith).toEqual([{ userId: "u2", access: "read" }]);
    }
  });

  it("creates new tasks with new ids and the new listId when copyTasks is true", async () => {
    const list = await createList("u-dup-15", { title: "Owned", template: "work", deadline: null });
    const task = await createTask({
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

    const result = await duplicateList(list.id, "u-dup-15", { copyTasks: true, copySharedWith: false });

    expect(result.status).toBe("ok");
    if (result.status === "ok") {
      expect(result.list.taskIds).toHaveLength(1);
      const newTaskId = result.list.taskIds[0];
      expect(newTaskId).not.toBe(task.id);
      const newTask = await findTaskById(newTaskId);
      expect(newTask?.listId).toBe(result.list.id);
      expect(newTask?.title).toBe("Task A");
    }
  });

  it("does not modify the original tasks when copyTasks is true", async () => {
    const list = await createList("u-dup-16", { title: "Owned", template: "work", deadline: null });
    const task = await createTask({
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

    await duplicateList(list.id, "u-dup-16", { copyTasks: true, copySharedWith: false });

    expect(await findTaskById(task.id)).toEqual(task);
    expect((await findListById(list.id))!.taskIds).toEqual([task.id]);
  });

  it("does not create tasks when copyTasks is false even if the source has tasks", async () => {
    const list = await createList("u-dup-17", { title: "Owned", template: "work", deadline: null });
    await createTask({
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
    const before = await countTasks();

    await duplicateList(list.id, "u-dup-17", NO_COPY);

    expect(await countTasks()).toBe(before);
  });

  it("creates a further new list on a repeated duplicate call", async () => {
    const list = await createList("u-dup-18", { title: "Owned", template: "work", deadline: null });

    const first = await duplicateList(list.id, "u-dup-18", NO_COPY);
    const second = await duplicateList(list.id, "u-dup-18", NO_COPY);

    expect(first.status).toBe("ok");
    expect(second.status).toBe("ok");
    if (first.status === "ok" && second.status === "ok") {
      expect(first.list.id).not.toBe(second.list.id);
    }
  });
});

describe("shareList", () => {
  it("returns not_found for an unknown list id", async () => {
    const result = await shareList("does-not-exist", "u-share-1", { userId: "u2", access: "read" });
    expect(result).toEqual({ status: "not_found" });
  });

  it("returns not_found for a caller who does not own the list", async () => {
    const list = await createList("u-share-2", { title: "Owned", template: "work", deadline: null });

    const result = await shareList(list.id, "someone-else", { userId: "u2", access: "read" });

    expect(result).toEqual({ status: "not_found" });
  });

  it("returns forbidden for an edit-access shared user (only the owner may manage sharing)", async () => {
    const list = await createList("u-share-3", { title: "Owned", template: "work", deadline: null });
    (await findListById(list.id))!.sharedWith.push({ userId: "u-editor", access: "edit" });

    const result = await shareList(list.id, "u-editor", { userId: "u2", access: "read" });

    expect(result).toEqual({ status: "forbidden" });
  });

  it("returns deleted for a soft-deleted list", async () => {
    const list = await createList("u-share-4", { title: "Owned", template: "work", deadline: null });
    await deleteList(list.id, "u-share-4");

    const result = await shareList(list.id, "u-share-4", { userId: "u2", access: "read" });

    expect(result).toEqual({ status: "deleted" });
  });

  it("returns user_not_found for an unknown target userId", async () => {
    const list = await createList("u-share-5", { title: "Owned", template: "work", deadline: null });

    const result = await shareList(list.id, "u-share-5", { userId: "does-not-exist", access: "read" });

    expect(result).toEqual({ status: "user_not_found" });
  });

  it("returns user_not_found for an unknown target email", async () => {
    const list = await createList("u-share-6", { title: "Owned", template: "work", deadline: null });

    const result = await shareList(list.id, "u-share-6", { email: "nobody@example.com", access: "read" });

    expect(result).toEqual({ status: "user_not_found" });
  });

  it("returns self_share when the owner tries to share the list with themselves via userId", async () => {
    const list = await createList("u1", { title: "Owned", template: "work", deadline: null });

    const result = await shareList(list.id, "u1", { userId: "u1", access: "read" });

    expect(result).toEqual({ status: "self_share" });
  });

  it("returns self_share when the owner tries to share the list with themselves via email", async () => {
    const list = await createList("u1", { title: "Owned", template: "work", deadline: null });

    const result = await shareList(list.id, "u1", { email: "admin@example.com", access: "read" });

    expect(result).toEqual({ status: "self_share" });
  });

  it("adds a new read-access share resolved by userId", async () => {
    const list = await createList("u-share-7", { title: "Owned", template: "work", deadline: null });

    const result = await shareList(list.id, "u-share-7", { userId: "u2", access: "read" });

    expect(result.status).toBe("ok");
    if (result.status === "ok") {
      expect(result.list.sharedWith).toEqual([{ userId: "u2", access: "read" }]);
    }
  });

  it("adds a new edit-access share resolved by email", async () => {
    const list = await createList("u-share-8", { title: "Owned", template: "work", deadline: null });

    const result = await shareList(list.id, "u-share-8", { email: "user@example.com", access: "edit" });

    expect(result.status).toBe("ok");
    if (result.status === "ok") {
      expect(result.list.sharedWith).toEqual([{ userId: "u2", access: "edit" }]);
    }
  });

  it("email lookup is case-insensitive", async () => {
    const list = await createList("u-share-9", { title: "Owned", template: "work", deadline: null });

    const result = await shareList(list.id, "u-share-9", { email: "USER@EXAMPLE.COM", access: "read" });

    expect(result.status).toBe("ok");
    if (result.status === "ok") {
      expect(result.list.sharedWith).toEqual([{ userId: "u2", access: "read" }]);
    }
  });

  it("updates the access level when the target is already shared with", async () => {
    const list = await createList("u-share-10", { title: "Owned", template: "work", deadline: null });
    (await findListById(list.id))!.sharedWith.push({ userId: "u2", access: "read" });

    const result = await shareList(list.id, "u-share-10", { userId: "u2", access: "edit" });

    expect(result.status).toBe("ok");
    if (result.status === "ok") {
      expect(result.list.sharedWith).toEqual([{ userId: "u2", access: "edit" }]);
    }
  });

  it("does not duplicate an entry for a user already shared with", async () => {
    const list = await createList("u-share-11", { title: "Owned", template: "work", deadline: null });
    (await findListById(list.id))!.sharedWith.push({ userId: "u2", access: "read" });

    const result = await shareList(list.id, "u-share-11", { userId: "u2", access: "read" });

    expect(result.status).toBe("ok");
    if (result.status === "ok") {
      expect(result.list.sharedWith).toHaveLength(1);
    }
  });

  it("preserves existing shares for other users", async () => {
    const list = await createList("u-share-12", { title: "Owned", template: "work", deadline: null });
    (await findListById(list.id))!.sharedWith.push({ userId: "u2", access: "read" });

    const result = await shareList(list.id, "u-share-12", { userId: "u3", access: "edit" });

    expect(result.status).toBe("ok");
    if (result.status === "ok") {
      expect(result.list.sharedWith).toEqual([
        { userId: "u2", access: "read" },
        { userId: "u3", access: "edit" },
      ]);
    }
  });

  it("does not change ownerId, title, template or taskIds", async () => {
    const list = await createList("u-share-13", { title: "Owned", template: "project", deadline: null });
    (await findListById(list.id))!.taskIds.push("t1");

    const result = await shareList(list.id, "u-share-13", { userId: "u2", access: "read" });

    expect(result.status).toBe("ok");
    if (result.status === "ok") {
      expect(result.list.ownerId).toBe("u-share-13");
      expect(result.list.title).toBe("Owned");
      expect(result.list.template).toBe("project");
      expect(result.list.taskIds).toEqual(["t1"]);
    }
  });

  it("bumps lastActivityAt on a successful share", async () => {
    const list = await createList("u-share-14", { title: "Owned", template: "work", deadline: null });
    const before = list.lastActivityAt;

    const result = await shareList(list.id, "u-share-14", { userId: "u2", access: "read" });

    expect(result.status).toBe("ok");
    if (result.status === "ok") {
      expect(new Date(result.list.lastActivityAt).getTime()).toBeGreaterThanOrEqual(new Date(before).getTime());
    }
  });

  it("does not modify other lists", async () => {
    const untouched = await createList("u-share-15a", { title: "Untouched", template: "work", deadline: null });
    const target = await createList("u-share-15b", { title: "Target", template: "work", deadline: null });

    await shareList(target.id, "u-share-15b", { userId: "u2", access: "read" });

    expect(await findListById(untouched.id)).toEqual(untouched);
  });

  it("does not change the list when forbidden", async () => {
    const list = await createList("u-share-16", { title: "Owned", template: "work", deadline: null });

    await shareList(list.id, "someone-else", { userId: "u2", access: "read" });

    expect((await findListById(list.id))?.sharedWith).toEqual([]);
  });

  it("does not change the list when the target user is not found", async () => {
    const list = await createList("u-share-17", { title: "Owned", template: "work", deadline: null });

    await shareList(list.id, "u-share-17", { userId: "does-not-exist", access: "read" });

    expect((await findListById(list.id))?.sharedWith).toEqual([]);
  });
});
