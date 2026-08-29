import { describe, expect, it } from "vitest";
import { getDashboardLists } from "@/features/dashboard/dashboard-lists";

function findById(lists: ReturnType<typeof getDashboardLists>, id: string) {
  const list = lists.find((entry) => entry.id === id);
  if (!list) {
    throw new Error(`Expected list ${id} in dashboard lists`);
  }
  return list;
}

describe("getDashboardLists", () => {
  it("returns lists owned by the user and lists shared with them, excluding soft-deleted ones", () => {
    const lists = getDashboardLists("u1");
    const ids = lists.map((list) => list.id).sort();

    expect(ids).toEqual(["l1", "l2", "l3", "l5"]);
  });

  it("computes task count, status counts and progress from active (non-deleted) tasks", () => {
    const list = findById(getDashboardLists("u1"), "l1");

    expect(list.title).toBe("Спринт 34: Backend");
    expect(list.taskCount).toBe(6);
    expect(list.statusCounts).toEqual({ new: 3, in_progress: 1, done: 2 });
    expect(list.progress).toBe(33);
  });

  it("returns 0 progress for a list with no completed tasks", () => {
    const list = findById(getDashboardLists("u1"), "l2");

    expect(list.taskCount).toBe(2);
    expect(list.statusCounts).toEqual({ new: 1, in_progress: 1, done: 0 });
    expect(list.progress).toBe(0);
  });

  it("returns 100 progress for a fully completed list", () => {
    const list = findById(getDashboardLists("u1"), "l5");

    expect(list.taskCount).toBe(1);
    expect(list.progress).toBe(100);
  });

  it("includes a list the user has read access to via sharing", () => {
    const list = findById(getDashboardLists("u1"), "l3");

    expect(list.taskCount).toBe(2);
    expect(list.progress).toBe(50);
  });

  it("resolves last activity from the activity log, not from list.lastActivityAt", () => {
    const list = findById(getDashboardLists("u1"), "l1");

    expect(list.lastActivityAt).toBe("2026-08-19T14:00:00.000Z");
  });

  it("resolves last activity from an entry logged against one of the list's tasks", () => {
    const list = findById(getDashboardLists("u1"), "l2");

    expect(list.lastActivityAt).toBe("2026-08-22T09:30:00.000Z");
  });

  it("returns null last activity when nothing in the activity log matches the list or its tasks", () => {
    const list = findById(getDashboardLists("u1"), "l3");

    expect(list.lastActivityAt).toBeNull();
  });

  it("excludes lists owned by another user with no sharing", () => {
    const lists = getDashboardLists("u3");
    expect(lists).toEqual([]);
  });

  it("includes an owned list plus a list shared to that user for a different account", () => {
    const ids = getDashboardLists("u2")
      .map((list) => list.id)
      .sort();
    expect(ids).toEqual(["l1", "l3"]);
  });
});

describe("getDashboardLists priority sorting", () => {
  const NOW = new Date("2026-08-27T12:00:00.000Z");

  it("orders lists from highest to lowest priority (overdue tasks push a list to the top)", () => {
    const lists = getDashboardLists("u1", NOW);

    expect(lists.map((list) => list.id)).toEqual(["l1", "l2", "l3", "l5"]);
    expect(lists.map((list) => list.priority)).toEqual([15, 14, 4, 0]);
  });

  it("sorts a shared list using the same priority rule as an owned list", () => {
    const lists = getDashboardLists("u2", NOW);

    expect(lists.map((list) => list.id)).toEqual(["l1", "l3"]);
  });

  it("never surfaces a soft-deleted list, even after sorting", () => {
    const ids = getDashboardLists("u1", NOW).map((list) => list.id);
    expect(ids).not.toContain("l4");
  });

  it("returns an empty array for a user with no visible lists", () => {
    expect(getDashboardLists("u3", NOW)).toEqual([]);
  });
});
