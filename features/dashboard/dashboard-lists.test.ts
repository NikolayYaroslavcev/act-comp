import { describe, expect, it } from "vitest";
import { getDashboardLists, getDeletedDashboardLists } from "@/features/dashboard/dashboard-lists";
import { createList, findListById } from "@/entities/list/repository";

function findById(lists: Awaited<ReturnType<typeof getDashboardLists>>, id: string) {
  const list = lists.find((entry) => entry.id === id);
  if (!list) {
    throw new Error(`Expected list ${id} in dashboard lists`);
  }
  return list;
}

describe("getDashboardLists", () => {
  it("returns lists owned by the user and lists shared with them, excluding soft-deleted ones", async () => {
    const lists = await getDashboardLists("u1");
    const ids = lists.map((list) => list.id).sort();

    expect(ids).toEqual(["l1", "l2", "l3", "l5"]);
  });

  it("computes task count, status counts and progress from active (non-deleted) tasks", async () => {
    const list = findById(await getDashboardLists("u1"), "l1");

    expect(list.title).toBe("Спринт 34: Backend");
    expect(list.taskCount).toBe(6);
    expect(list.statusCounts).toEqual({ new: 3, in_progress: 1, done: 2 });
    expect(list.progress).toBe(33);
  });

  it("computes a separate overdue count on top of the status counts", async () => {
    const NOW = new Date("2026-08-27T12:00:00.000Z");
    const l1 = findById(await getDashboardLists("u1", NOW), "l1");
    const l3 = findById(await getDashboardLists("u1", NOW), "l3");

    expect(l1.overdueCount).toBe(1);
    expect(l3.overdueCount).toBe(0);
  });

  it("counts an in-progress overdue task in both its status count and the overdue count", async () => {
    const NOW = new Date("2026-08-27T12:00:00.000Z");
    const l1 = findById(await getDashboardLists("u1", NOW), "l1");

    expect(l1.statusCounts.in_progress).toBeGreaterThanOrEqual(l1.overdueCount);
    expect(l1.overdueCount).toBeGreaterThan(0);
  });

  it("flags a list whose latest activity is 30+ days old as an archive candidate", async () => {
    const STALE_NOW = new Date("2026-09-18T14:00:00.000Z");
    const l1 = findById(await getDashboardLists("u1", STALE_NOW), "l1");
    const l2 = findById(await getDashboardLists("u1", STALE_NOW), "l2");

    expect(l1.isArchiveCandidate).toBe(true);
    expect(l2.isArchiveCandidate).toBe(false);
  });

  it("does not flag a list as an archive candidate when its activity is recent relative to `now`", async () => {
    const RECENT_NOW = new Date("2026-08-27T12:00:00.000Z");
    const l1 = findById(await getDashboardLists("u1", RECENT_NOW), "l1");
    expect(l1.isArchiveCandidate).toBe(false);
  });

  it("computes urgency from the list's tasks and own deadline", async () => {
    const NOW = new Date("2026-08-27T12:00:00.000Z");
    const l1 = findById(await getDashboardLists("u1", NOW), "l1");
    const l5 = findById(await getDashboardLists("u1", NOW), "l5");

    expect(l1.urgency).toBe("urgent");
    expect(l5.urgency).toBe("normal");
  });

  it("returns 0 progress for a list with no completed tasks", async () => {
    const list = findById(await getDashboardLists("u1"), "l2");

    expect(list.taskCount).toBe(2);
    expect(list.statusCounts).toEqual({ new: 1, in_progress: 1, done: 0 });
    expect(list.progress).toBe(0);
  });

  it("returns 100 progress for a fully completed list", async () => {
    const list = findById(await getDashboardLists("u1"), "l5");

    expect(list.taskCount).toBe(1);
    expect(list.progress).toBe(100);
  });

  it("includes a list the user has read access to via sharing", async () => {
    const list = findById(await getDashboardLists("u1"), "l3");

    expect(list.taskCount).toBe(2);
    expect(list.progress).toBe(50);
  });

  it("resolves last activity from the activity log, not from list.lastActivityAt", async () => {
    const list = findById(await getDashboardLists("u1"), "l1");

    expect(list.lastActivityAt).toBe("2026-08-19T14:00:00.000Z");
  });

  it("resolves last activity from an entry logged against one of the list's tasks", async () => {
    const list = findById(await getDashboardLists("u1"), "l2");

    expect(list.lastActivityAt).toBe("2026-08-22T09:30:00.000Z");
  });

  it("returns null last activity when nothing in the activity log matches the list or its tasks", async () => {
    const list = findById(await getDashboardLists("u1"), "l3");

    expect(list.lastActivityAt).toBeNull();
  });

  it("excludes lists owned by another user with no sharing", async () => {
    const lists = await getDashboardLists("u3");
    expect(lists).toEqual([]);
  });

  it("includes an owned list plus a list shared to that user for a different account", async () => {
    const ids = await (await getDashboardLists("u2"))
      .map((list) => list.id)
      .sort();
    expect(ids).toEqual(["l1", "l3"]);
  });
});

describe("getDashboardLists priority sorting", () => {
  const NOW = new Date("2026-08-27T12:00:00.000Z");

  it("orders lists from highest to lowest priority (overdue tasks push a list to the top)", async () => {
    const lists = await getDashboardLists("u1", NOW);

    expect(lists.map((list) => list.id)).toEqual(["l1", "l2", "l3", "l5"]);
    expect(lists.map((list) => list.priority)).toEqual([15, 14, 4, 0]);
  });

  it("sorts a shared list using the same priority rule as an owned list", async () => {
    const lists = await getDashboardLists("u2", NOW);

    expect(lists.map((list) => list.id)).toEqual(["l1", "l3"]);
  });

  it("never surfaces a soft-deleted list, even after sorting", async () => {
    const ids = (await getDashboardLists("u1", NOW)).map((list) => list.id);
    expect(ids).not.toContain("l4");
  });

  it("returns an empty array for a user with no visible lists", async () => {
    expect(await getDashboardLists("u3", NOW)).toEqual([]);
  });
});

describe("getDashboardLists canDelete", () => {
  it("marks canDelete true for a list the user owns", async () => {
    const list = findById(await getDashboardLists("u1"), "l1");
    expect(list.canDelete).toBe(true);
  });

  it("marks canDelete false for a list only shared as read-only", async () => {
    const list = findById(await getDashboardLists("u1"), "l3");
    expect(list.canDelete).toBe(false);
  });

  it("marks canDelete false for a list shared with edit access", async () => {
    const list = findById(await getDashboardLists("u2"), "l1");
    expect(list.canDelete).toBe(false);
  });
});

describe("getDashboardLists canEdit", () => {
  it("marks canEdit true for a list the user owns", async () => {
    const list = findById(await getDashboardLists("u1"), "l1");
    expect(list.canEdit).toBe(true);
  });

  it("marks canEdit true for a list shared with edit access", async () => {
    const list = findById(await getDashboardLists("u2"), "l1");
    expect(list.canEdit).toBe(true);
  });

  it("marks canEdit false for a list only shared as read-only", async () => {
    const list = findById(await getDashboardLists("u1"), "l3");
    expect(list.canEdit).toBe(false);
  });
});

describe("getDashboardLists template and deadline", () => {
  it("includes the list's template and deadline for prefilling edit forms", async () => {
    const list = findById(await getDashboardLists("u1"), "l1");
    expect(list.template).toBe("work");
    expect(list.deadline).toBe("2026-09-10T18:00:00.000Z");
  });

  it("includes a null deadline for a list without one", async () => {
    const list = findById(await getDashboardLists("u1"), "l2");
    expect(list.deadline).toBeNull();
  });
});

describe("getDeletedDashboardLists", () => {
  const NOW = new Date("2026-08-27T12:00:00.000Z");

  it("returns the caller's own soft-deleted lists within the restore window", async () => {
    const ids = (await getDeletedDashboardLists("u1", NOW)).map((list) => list.id);
    expect(ids).toContain("l4");
  });

  it("includes the title and deletion timestamp", async () => {
    const list = (await getDeletedDashboardLists("u1", NOW)).find((entry) => entry.id === "l4");
    expect(list?.title).toBe("Старый список (удалён)");
    expect(list?.deletedAt).toBe("2026-08-10T09:00:00.000Z");
  });

  it("excludes active (non-deleted) lists", async () => {
    const ids = (await getDeletedDashboardLists("u1", NOW)).map((list) => list.id);
    expect(ids).not.toContain("l1");
  });

  it("excludes a soft-deleted list owned by someone else, even if shared with the caller", async () => {
    const list = await createList("u2", { title: "Shared then deleted", template: "work", deadline: null });
    (await findListById(list.id))!.sharedWith.push({ userId: "u1", access: "edit" });
    (await findListById(list.id))!.deletedAt = NOW.toISOString();

    const ids = (await getDeletedDashboardLists("u1", NOW)).map((entry) => entry.id);
    expect(ids).not.toContain(list.id);
  });

  it("excludes a soft-deleted list past the 30-day restore window", async () => {
    const list = await createList("u1", { title: "Long gone", template: "work", deadline: null });
    (await findListById(list.id))!.deletedAt = "2026-01-01T00:00:00.000Z";

    const ids = (await getDeletedDashboardLists("u1", NOW)).map((entry) => entry.id);
    expect(ids).not.toContain(list.id);
  });

  it("returns an empty array for a user with no deleted lists", async () => {
    expect(await getDeletedDashboardLists("u3", NOW)).toEqual([]);
  });
});
