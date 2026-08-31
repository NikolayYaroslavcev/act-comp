import { describe, expect, it } from "vitest";
import { findLatestActivityAmong, describeTaskActivity } from "@/entities/activity/model";
import type { Activity } from "@/entities/activity/schema";

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

describe("findLatestActivityAmong", () => {
  it("returns null when there is no matching activity", () => {
    expect(findLatestActivityAmong(new Set(["l1"]), [])).toBeNull();
  });

  it("returns the only matching entry", () => {
    const activity = makeActivity({ id: "a1", entityId: "l1" });
    expect(findLatestActivityAmong(new Set(["l1"]), [activity])).toEqual(activity);
  });

  it("picks the most recent entry among matching ids", () => {
    const older = makeActivity({ id: "a1", entityId: "l1", at: "2026-08-01T00:00:00.000Z" });
    const newer = makeActivity({ id: "a2", entityId: "l1", at: "2026-08-15T00:00:00.000Z" });
    expect(findLatestActivityAmong(new Set(["l1"]), [older, newer])).toEqual(newer);
  });

  it("matches an activity against any id in the set", () => {
    const taskActivity = makeActivity({
      id: "a1",
      entityType: "task",
      entityId: "t1",
      at: "2026-08-20T00:00:00.000Z",
    });
    expect(findLatestActivityAmong(new Set(["l1", "t1"]), [taskActivity])).toEqual(taskActivity);
  });

  it("ignores activity for ids outside the set", () => {
    const unrelated = makeActivity({ id: "a1", entityType: "task", entityId: "t99" });
    expect(findLatestActivityAmong(new Set(["l1", "t1"]), [unrelated])).toBeNull();
  });
});

describe("describeTaskActivity", () => {
  it("describes a priority change with actor, old and new values", () => {
    expect(
      describeTaskActivity(
        {
          id: "a1",
          entityType: "task",
          entityId: "t1",
          action: "updated",
          at: "2026-08-30T10:00:00.000Z",
          byUserId: "u1",
          metadata: { field: "priority", old: 3, new: 5 },
        },
        "Николай",
      ).summary,
    ).toBe("Николай изменил приоритет: 3 → 5");
  });

  it("describes a rollback without treating it as a field update", () => {
    expect(
      describeTaskActivity(
        {
          id: "a2",
          entityType: "task",
          entityId: "t1",
          action: "rolled_back",
          at: "2026-08-30T10:00:00.000Z",
          byUserId: "u1",
          metadata: { historyIndex: 0 },
        },
        "Николай",
      ).summary,
    ).toBe("Николай откатил задачу к предыдущей версии");
  });
});
