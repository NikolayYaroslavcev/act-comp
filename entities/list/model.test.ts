import { describe, expect, it } from "vitest";
import {
  applyListShare,
  buildDuplicatedList,
  buildListDeletionHistoryEntry,
  buildListRestorationHistoryEntry,
  calculateListPriority,
  calculateListProgress,
  canDeleteList,
  canEditList,
  canManageListSharing,
  canRestoreList,
  canViewList,
  diffListChanges,
  findLatestListActivity,
  isListArchiveCandidate,
  isListDeadlineOverdue,
  selectVisibleLists,
  sortListsByPriority,
} from "@/entities/list/model";
import type { Task } from "@/entities/task/schema";
import type { TaskList } from "@/entities/list/schema";
import type { Activity } from "@/entities/activity/schema";

function makeTask(overrides: Partial<Task>): Task {
  return {
    id: "t1",
    listId: "l1",
    code: "TEST-1",
    title: "Task",
    description: "",
    status: "new",
    priority: 1,
    category: null,
    tags: [],
    dependsOn: [],
    parentId: null,
    subtaskIds: [],
    deadline: null,
    createdAt: "2026-08-01T00:00:00.000Z",
    estimatedMin: 0,
    timeSpentMin: 0,
    timerStartedAt: null,
    timerPausedAt: null,
    extensions: [],
    history: [],
    deletedAt: null,
    ...overrides,
  };
}

function makeList(overrides: Partial<TaskList>): TaskList {
  return {
    id: "l1",
    ownerId: "u1",
    title: "List",
    template: "work",
    taskIds: [],
    deadline: null,
    sharedWith: [],
    history: [],
    deletedAt: null,
    lastActivityAt: "2026-08-01T00:00:00.000Z",
    ...overrides,
  };
}

function makeActivity(overrides: Partial<Activity>): Activity {
  return {
    id: "a1",
    entityType: "list",
    entityId: "l1",
    action: "created",
    at: "2026-08-01T00:00:00.000Z",
    byUserId: "u1",
    ...overrides,
  };
}

describe("calculateListProgress", () => {
  it("is 0 for an empty list, without NaN or Infinity", () => {
    expect(calculateListProgress([])).toBe(0);
  });

  it("is 0 when a single task is not done", () => {
    expect(calculateListProgress([makeTask({ status: "new" })])).toBe(0);
  });

  it("is 100 when a single task is done", () => {
    expect(calculateListProgress([makeTask({ status: "done" })])).toBe(100);
  });

  it("is 0 when no tasks are done", () => {
    const tasks = [makeTask({ id: "t1", status: "new" }), makeTask({ id: "t2", status: "in_progress" })];
    expect(calculateListProgress(tasks)).toBe(0);
  });

  it("is 100 when every task is done", () => {
    const tasks = [makeTask({ id: "t1", status: "done" }), makeTask({ id: "t2", status: "done" })];
    expect(calculateListProgress(tasks)).toBe(100);
  });

  it("rounds the percentage for a mixed set of statuses", () => {
    const tasks = [
      makeTask({ id: "t1", status: "done" }),
      makeTask({ id: "t2", status: "in_progress" }),
      makeTask({ id: "t3", status: "new" }),
    ];
    expect(calculateListProgress(tasks)).toBe(33);
  });
});

describe("isListDeadlineOverdue", () => {
  const NOW = new Date("2026-08-27T12:00:00.000Z");

  it("returns false when the list has no deadline", () => {
    expect(isListDeadlineOverdue(makeList({ deadline: null }), NOW)).toBe(false);
  });

  it("returns false when the deadline is in the future", () => {
    expect(isListDeadlineOverdue(makeList({ deadline: "2026-08-28T00:00:00.000Z" }), NOW)).toBe(false);
  });

  it("returns true when the deadline has passed", () => {
    expect(isListDeadlineOverdue(makeList({ deadline: "2026-08-26T00:00:00.000Z" }), NOW)).toBe(true);
  });
});

describe("calculateListPriority", () => {
  const NOW = new Date("2026-08-27T12:00:00.000Z");

  it("is 0 for an empty task list", () => {
    expect(calculateListPriority([], NOW)).toBe(0);
  });

  it("is 0 when every task is done, regardless of their priority", () => {
    const tasks = [makeTask({ status: "done", priority: 5 }), makeTask({ id: "t2", status: "done", priority: 4 })];
    expect(calculateListPriority(tasks, NOW)).toBe(0);
  });

  it("uses the highest priority among open (non-done) tasks", () => {
    const tasks = [
      makeTask({ id: "t1", status: "new", priority: 2 }),
      makeTask({ id: "t2", status: "in_progress", priority: 4 }),
      makeTask({ id: "t3", status: "done", priority: 5 }),
    ];
    expect(calculateListPriority(tasks, NOW)).toBe(4);
  });

  it("boosts priority when an open task is overdue", () => {
    const tasks = [makeTask({ status: "in_progress", priority: 2, deadline: "2026-08-20T00:00:00.000Z" })];
    expect(calculateListPriority(tasks, NOW)).toBe(12);
  });

  it("does not boost priority for a task whose deadline is still in the future", () => {
    const tasks = [makeTask({ status: "in_progress", priority: 2, deadline: "2026-09-01T00:00:00.000Z" })];
    expect(calculateListPriority(tasks, NOW)).toBe(2);
  });

  it("does not treat a done task with a past deadline as overdue", () => {
    const tasks = [
      makeTask({ id: "t1", status: "done", priority: 5, deadline: "2026-08-01T00:00:00.000Z" }),
      makeTask({ id: "t2", status: "new", priority: 1 }),
    ];
    expect(calculateListPriority(tasks, NOW)).toBe(1);
  });

  it("boosts using the base priority even when the overdue task itself is low priority", () => {
    const tasks = [
      makeTask({ id: "t1", status: "new", priority: 5 }),
      makeTask({ id: "t2", status: "in_progress", priority: 1, deadline: "2026-08-01T00:00:00.000Z" }),
    ];
    expect(calculateListPriority(tasks, NOW)).toBe(15);
  });

  it("defaults `now` to the current time when not provided", () => {
    const tasks = [makeTask({ status: "new", priority: 3 })];
    expect(calculateListPriority(tasks)).toBe(3);
  });
});

describe("sortListsByPriority", () => {
  it("returns an empty array unchanged", () => {
    expect(sortListsByPriority([])).toEqual([]);
  });

  it("returns a single-item array unchanged", () => {
    const items = [{ id: "l1", priority: 3 }];
    expect(sortListsByPriority(items)).toEqual([{ id: "l1", priority: 3 }]);
  });

  it("sorts multiple items from highest to lowest priority", () => {
    const items = [
      { id: "l1", priority: 2 },
      { id: "l2", priority: 15 },
      { id: "l3", priority: 8 },
    ];
    expect(sortListsByPriority(items).map((item) => item.id)).toEqual(["l2", "l3", "l1"]);
  });

  it("keeps the original relative order for items with equal priority", () => {
    const items = [
      { id: "a", priority: 5 },
      { id: "b", priority: 5 },
      { id: "c", priority: 5 },
    ];
    expect(sortListsByPriority(items).map((item) => item.id)).toEqual(["a", "b", "c"]);
  });

  it("does not mutate the input array", () => {
    const items = [
      { id: "l1", priority: 1 },
      { id: "l2", priority: 9 },
    ];
    const original = [...items];

    sortListsByPriority(items);

    expect(items).toEqual(original);
  });
});

describe("selectVisibleLists", () => {
  it("includes lists owned by the user", () => {
    const owned = makeList({ id: "l1", ownerId: "u1" });
    expect(selectVisibleLists([owned], "u1")).toEqual([owned]);
  });

  it("excludes lists owned by another user", () => {
    const foreign = makeList({ id: "l1", ownerId: "u2" });
    expect(selectVisibleLists([foreign], "u1")).toEqual([]);
  });

  it("includes lists shared with the user", () => {
    const shared = makeList({
      id: "l1",
      ownerId: "u2",
      sharedWith: [{ userId: "u1", access: "read" }],
    });
    expect(selectVisibleLists([shared], "u1")).toEqual([shared]);
  });

  it("excludes soft-deleted lists even when owned by the user", () => {
    const deleted = makeList({ id: "l1", ownerId: "u1", deletedAt: "2026-08-10T00:00:00.000Z" });
    expect(selectVisibleLists([deleted], "u1")).toEqual([]);
  });

  it("excludes soft-deleted lists even when shared with the user", () => {
    const deleted = makeList({
      id: "l1",
      ownerId: "u2",
      sharedWith: [{ userId: "u1", access: "edit" }],
      deletedAt: "2026-08-10T00:00:00.000Z",
    });
    expect(selectVisibleLists([deleted], "u1")).toEqual([]);
  });
});

describe("findLatestListActivity", () => {
  it("returns null when there is no matching activity", () => {
    const list = makeList({ id: "l1", taskIds: [] });
    expect(findLatestListActivity(list, [])).toBeNull();
  });

  it("returns the only matching entry", () => {
    const list = makeList({ id: "l1" });
    const activity = makeActivity({ id: "a1", entityId: "l1" });
    expect(findLatestListActivity(list, [activity])).toEqual(activity);
  });

  it("picks the most recent entry among the list's own events", () => {
    const list = makeList({ id: "l1" });
    const older = makeActivity({ id: "a1", entityId: "l1", at: "2026-08-01T00:00:00.000Z" });
    const newer = makeActivity({ id: "a2", entityId: "l1", at: "2026-08-15T00:00:00.000Z" });
    expect(findLatestListActivity(list, [older, newer])).toEqual(newer);
  });

  it("includes activity for the list's tasks", () => {
    const list = makeList({ id: "l1", taskIds: ["t1"] });
    const taskActivity = makeActivity({
      id: "a1",
      entityType: "task",
      entityId: "t1",
      at: "2026-08-20T00:00:00.000Z",
    });
    expect(findLatestListActivity(list, [taskActivity])).toEqual(taskActivity);
  });

  it("ignores activity for unrelated entities", () => {
    const list = makeList({ id: "l1", taskIds: ["t1"] });
    const unrelated = makeActivity({ id: "a1", entityType: "task", entityId: "t99" });
    expect(findLatestListActivity(list, [unrelated])).toBeNull();
  });
});

describe("canEditList", () => {
  it("allows the owner to edit", () => {
    const list = makeList({ ownerId: "u1" });
    expect(canEditList(list, "u1")).toBe(true);
  });

  it("allows a user shared with edit access", () => {
    const list = makeList({ ownerId: "u1", sharedWith: [{ userId: "u2", access: "edit" }] });
    expect(canEditList(list, "u2")).toBe(true);
  });

  it("denies a user shared with only read access", () => {
    const list = makeList({ ownerId: "u1", sharedWith: [{ userId: "u2", access: "read" }] });
    expect(canEditList(list, "u2")).toBe(false);
  });

  it("denies a user with no relation to the list", () => {
    const list = makeList({ ownerId: "u1", sharedWith: [] });
    expect(canEditList(list, "u3")).toBe(false);
  });
});

describe("canDeleteList", () => {
  it("allows the owner to delete", () => {
    const list = makeList({ ownerId: "u1" });
    expect(canDeleteList(list, "u1")).toBe(true);
  });

  it("denies a user shared with edit access", () => {
    const list = makeList({ ownerId: "u1", sharedWith: [{ userId: "u2", access: "edit" }] });
    expect(canDeleteList(list, "u2")).toBe(false);
  });

  it("denies a user shared with only read access", () => {
    const list = makeList({ ownerId: "u1", sharedWith: [{ userId: "u2", access: "read" }] });
    expect(canDeleteList(list, "u2")).toBe(false);
  });

  it("denies a user with no relation to the list", () => {
    const list = makeList({ ownerId: "u1", sharedWith: [] });
    expect(canDeleteList(list, "u3")).toBe(false);
  });
});

describe("canManageListSharing", () => {
  it("allows the owner to manage sharing", () => {
    const list = makeList({ ownerId: "u1" });
    expect(canManageListSharing(list, "u1")).toBe(true);
  });

  it("denies a user shared with edit access", () => {
    const list = makeList({ ownerId: "u1", sharedWith: [{ userId: "u2", access: "edit" }] });
    expect(canManageListSharing(list, "u2")).toBe(false);
  });

  it("denies a user shared with only read access", () => {
    const list = makeList({ ownerId: "u1", sharedWith: [{ userId: "u2", access: "read" }] });
    expect(canManageListSharing(list, "u2")).toBe(false);
  });

  it("denies a user with no relation to the list", () => {
    const list = makeList({ ownerId: "u1" });
    expect(canManageListSharing(list, "u3")).toBe(false);
  });
});

describe("applyListShare", () => {
  it("adds a new share entry for a user with no existing access", () => {
    const result = applyListShare([], "u2", "read");
    expect(result).toEqual([{ userId: "u2", access: "read" }]);
  });

  it("appends alongside existing shares for other users", () => {
    const result = applyListShare([{ userId: "u2", access: "read" }], "u3", "edit");
    expect(result).toEqual([
      { userId: "u2", access: "read" },
      { userId: "u3", access: "edit" },
    ]);
  });

  it("updates the access level for a user who already has a share", () => {
    const result = applyListShare([{ userId: "u2", access: "read" }], "u2", "edit");
    expect(result).toEqual([{ userId: "u2", access: "edit" }]);
  });

  it("does not duplicate an entry when re-sharing with the same access level", () => {
    const result = applyListShare([{ userId: "u2", access: "read" }], "u2", "read");
    expect(result).toEqual([{ userId: "u2", access: "read" }]);
  });

  it("does not mutate the input array", () => {
    const input = [{ userId: "u2", access: "read" as const }];
    const snapshot = structuredClone(input);

    applyListShare(input, "u2", "edit");

    expect(input).toEqual(snapshot);
  });
});

describe("buildListDeletionHistoryEntry", () => {
  it("describes deletedAt moving from null to the given timestamp", () => {
    const list = makeList({ deletedAt: null });
    const at = "2026-08-27T12:00:00.000Z";

    const entry = buildListDeletionHistoryEntry(list, "u1", at);

    expect(entry).toEqual({ field: "deletedAt", old: null, new: at, at, byUserId: "u1" });
  });
});

describe("diffListChanges", () => {
  const AT = "2026-08-27T12:00:00.000Z";

  it("returns a history entry for a changed title", () => {
    const list = makeList({ title: "Old title" });
    const changes = diffListChanges(list, { title: "New title" }, "u1", AT);

    expect(changes).toEqual([{ field: "title", old: "Old title", new: "New title", at: AT, byUserId: "u1" }]);
  });

  it("returns a history entry for a changed template", () => {
    const list = makeList({ template: "work" });
    const changes = diffListChanges(list, { template: "personal" }, "u1", AT);

    expect(changes).toEqual([{ field: "template", old: "work", new: "personal", at: AT, byUserId: "u1" }]);
  });

  it("returns a history entry for a changed deadline", () => {
    const list = makeList({ deadline: "2026-09-01T00:00:00.000Z" });
    const changes = diffListChanges(list, { deadline: "2026-10-01T00:00:00.000Z" }, "u1", AT);

    expect(changes).toEqual([
      { field: "deadline", old: "2026-09-01T00:00:00.000Z", new: "2026-10-01T00:00:00.000Z", at: AT, byUserId: "u1" },
    ]);
  });

  it("returns a history entry when the deadline is explicitly cleared to null", () => {
    const list = makeList({ deadline: "2026-09-01T00:00:00.000Z" });
    const changes = diffListChanges(list, { deadline: null }, "u1", AT);

    expect(changes).toEqual([
      { field: "deadline", old: "2026-09-01T00:00:00.000Z", new: null, at: AT, byUserId: "u1" },
    ]);
  });

  it("returns multiple entries when several fields change at once", () => {
    const list = makeList({ title: "Old", template: "work" });
    const changes = diffListChanges(list, { title: "New", template: "project" }, "u1", AT);

    expect(changes).toHaveLength(2);
    expect(changes.map((c) => c.field).sort()).toEqual(["template", "title"]);
  });

  it("ignores a field that is absent from the patch", () => {
    const list = makeList({ title: "Old", template: "work" });
    const changes = diffListChanges(list, { title: "New" }, "u1", AT);

    expect(changes).toEqual([{ field: "title", old: "Old", new: "New", at: AT, byUserId: "u1" }]);
  });

  it("returns no entries for a no-op update where the value matches the current one", () => {
    const list = makeList({ title: "Same title" });
    const changes = diffListChanges(list, { title: "Same title" }, "u1", AT);

    expect(changes).toEqual([]);
  });

  it("returns no entries for an empty patch", () => {
    const list = makeList({ title: "Old" });
    const changes = diffListChanges(list, {}, "u1", AT);

    expect(changes).toEqual([]);
  });
});

describe("canRestoreList", () => {
  const NOW = new Date("2026-08-27T12:00:00.000Z");
  const MS_PER_DAY = 24 * 60 * 60 * 1000;

  function daysBefore(reference: Date, days: number): string {
    return new Date(reference.getTime() - days * MS_PER_DAY).toISOString();
  }

  it("allows restore after 29 days since deletion", () => {
    const list = makeList({ deletedAt: daysBefore(NOW, 29) });
    expect(canRestoreList(list, NOW)).toBe(true);
  });

  it("allows restore after exactly 30 days since deletion", () => {
    const list = makeList({ deletedAt: daysBefore(NOW, 30) });
    expect(canRestoreList(list, NOW)).toBe(true);
  });

  it("denies restore after 31 days since deletion", () => {
    const list = makeList({ deletedAt: daysBefore(NOW, 31) });
    expect(canRestoreList(list, NOW)).toBe(false);
  });

  it("denies restore a few hours past the 30-day window", () => {
    const deletedAt = new Date(NOW.getTime() - 30 * MS_PER_DAY - 60 * 60 * 1000).toISOString();
    const list = makeList({ deletedAt });
    expect(canRestoreList(list, NOW)).toBe(false);
  });

  it("denies restore when the list was never deleted", () => {
    const list = makeList({ deletedAt: null });
    expect(canRestoreList(list, NOW)).toBe(false);
  });

  it("uses the given `now` instead of the current time", () => {
    const deletedAt = daysBefore(NOW, 10);
    const list = makeList({ deletedAt });
    const farFuture = new Date(NOW.getTime() + 100 * MS_PER_DAY);
    expect(canRestoreList(list, farFuture)).toBe(false);
  });

  it("is deterministic for the same explicit `now`", () => {
    const list = makeList({ deletedAt: daysBefore(NOW, 30) });
    expect(canRestoreList(list, NOW)).toBe(canRestoreList(list, NOW));
  });
});

describe("buildListRestorationHistoryEntry", () => {
  it("describes deletedAt moving from the deleted timestamp back to null", () => {
    const deletedAt = "2026-08-01T00:00:00.000Z";
    const list = makeList({ deletedAt });
    const at = "2026-08-27T12:00:00.000Z";

    const entry = buildListRestorationHistoryEntry(list, "u1", at);

    expect(entry).toEqual({ field: "deletedAt", old: deletedAt, new: null, at, byUserId: "u1" });
  });
});

describe("canViewList", () => {
  it("allows the owner to view", () => {
    const list = makeList({ ownerId: "u1" });
    expect(canViewList(list, "u1")).toBe(true);
  });

  it("allows a user shared with edit access", () => {
    const list = makeList({ ownerId: "u1", sharedWith: [{ userId: "u2", access: "edit" }] });
    expect(canViewList(list, "u2")).toBe(true);
  });

  it("allows a user shared with only read access", () => {
    const list = makeList({ ownerId: "u1", sharedWith: [{ userId: "u2", access: "read" }] });
    expect(canViewList(list, "u2")).toBe(true);
  });

  it("denies a user with no relation to the list", () => {
    const list = makeList({ ownerId: "u1", sharedWith: [] });
    expect(canViewList(list, "u3")).toBe(false);
  });
});

describe("buildDuplicatedList", () => {
  const NOW = "2026-08-27T12:00:00.000Z";

  it("assigns the given new id and owner, ignoring the source's id and owner", () => {
    const source = makeList({ id: "l1", ownerId: "u1" });
    const duplicate = buildDuplicatedList(source, "l2", "u2", [], [], NOW);

    expect(duplicate.id).toBe("l2");
    expect(duplicate.ownerId).toBe("u2");
  });

  it("copies title, template and deadline from the source", () => {
    const source = makeList({ title: "Project", template: "project", deadline: "2026-09-01T00:00:00.000Z" });
    const duplicate = buildDuplicatedList(source, "l2", "u1", [], [], NOW);

    expect(duplicate.title).toBe("Project");
    expect(duplicate.template).toBe("project");
    expect(duplicate.deadline).toBe("2026-09-01T00:00:00.000Z");
  });

  it("uses the given taskIds and sharedWith rather than the source's", () => {
    const source = makeList({ taskIds: ["t1", "t2"], sharedWith: [{ userId: "u2", access: "edit" }] });
    const duplicate = buildDuplicatedList(source, "l2", "u1", ["t9"], [], NOW);

    expect(duplicate.taskIds).toEqual(["t9"]);
    expect(duplicate.sharedWith).toEqual([]);
  });

  it("passes through the given sharedWith when the caller opts in", () => {
    const source = makeList({ sharedWith: [{ userId: "u2", access: "read" }] });
    const duplicate = buildDuplicatedList(source, "l2", "u1", [], [{ userId: "u2", access: "read" }], NOW);

    expect(duplicate.sharedWith).toEqual([{ userId: "u2", access: "read" }]);
  });

  it("never copies history, deletedAt or lastActivityAt from the source", () => {
    const source = makeList({
      history: [{ field: "title", old: "a", new: "b", at: NOW, byUserId: "u1" }],
      deletedAt: null,
      lastActivityAt: "2026-01-01T00:00:00.000Z",
    });
    const duplicate = buildDuplicatedList(source, "l2", "u1", [], [], NOW);

    expect(duplicate.history).toEqual([]);
    expect(duplicate.deletedAt).toBeNull();
    expect(duplicate.lastActivityAt).toBe(NOW);
  });

  it("does not mutate the source list", () => {
    const source = makeList({ id: "l1", taskIds: ["t1"], sharedWith: [{ userId: "u2", access: "edit" }] });
    const snapshot = structuredClone(source);

    buildDuplicatedList(source, "l2", "u1", [], [], NOW);

    expect(source).toEqual(snapshot);
  });
});

describe("isListArchiveCandidate", () => {
  const NOW = new Date("2026-08-27T12:00:00.000Z");
  const MS_PER_DAY = 24 * 60 * 60 * 1000;

  function daysBefore(reference: Date, days: number): string {
    return new Date(reference.getTime() - days * MS_PER_DAY).toISOString();
  }

  it("is not a candidate after 29 days of inactivity", () => {
    expect(isListArchiveCandidate(daysBefore(NOW, 29), NOW)).toBe(false);
  });

  it("is a candidate after exactly 30 days of inactivity", () => {
    expect(isListArchiveCandidate(daysBefore(NOW, 30), NOW)).toBe(true);
  });

  it("is a candidate after 31 days of inactivity", () => {
    expect(isListArchiveCandidate(daysBefore(NOW, 31), NOW)).toBe(true);
  });

  it("is a candidate when activity is significantly older than 30 days", () => {
    expect(isListArchiveCandidate(daysBefore(NOW, 200), NOW)).toBe(true);
  });

  it("is not a candidate for recent activity", () => {
    expect(isListArchiveCandidate(daysBefore(NOW, 1), NOW)).toBe(false);
  });

  it("is not a candidate when there is no recorded activity at all", () => {
    expect(isListArchiveCandidate(null, NOW)).toBe(false);
  });

  it("is deterministic for the same explicit `now`", () => {
    const latestActivityAt = daysBefore(NOW, 30);
    expect(isListArchiveCandidate(latestActivityAt, NOW)).toBe(
      isListArchiveCandidate(latestActivityAt, NOW)
    );
  });
});
