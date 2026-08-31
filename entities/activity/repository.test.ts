import { describe, expect, it } from "vitest";
import { getDb } from "@/shared/lib/db";
import { appendActivity, listActivityForTask, recordActivity } from "@/entities/activity/repository";
import { activitySchema } from "@/entities/activity/schema";

const AT = "2026-08-30T10:00:00.000Z";
const EARLIER = "2026-08-30T09:00:00.000Z";

describe("recordActivity", () => {
  it("persists an activity with a generated unique id", () => {
    const first = recordActivity({
      entityType: "task",
      entityId: "t-act-1",
      action: "created",
      at: AT,
      byUserId: "u1",
    });
    const second = recordActivity({
      entityType: "task",
      entityId: "t-act-1",
      action: "updated",
      at: AT,
      byUserId: "u1",
      metadata: { field: "title", old: "A", new: "B" },
    });

    expect(first.id).toBeTruthy();
    expect(second.id).toBeTruthy();
    expect(first.id).not.toBe(second.id);
    expect(getDb().activityLog[first.id]).toEqual(first);
    expect(activitySchema.parse(first).id).toBe(first.id);
  });

  it("stores the acting userId and task entityId from the server, not a client field", () => {
    const activity = recordActivity({
      entityType: "task",
      entityId: "t-act-user",
      action: "created",
      at: AT,
      byUserId: "u2",
    });

    expect(activity.byUserId).toBe("u2");
    expect(activity.entityId).toBe("t-act-user");
    expect(activity.entityType).toBe("task");
  });

  it("stamps the given timestamp", () => {
    const activity = recordActivity({
      entityType: "task",
      entityId: "t-act-ts",
      action: "created",
      at: AT,
      byUserId: "u1",
    });

    expect(activity.at).toBe(AT);
  });

  it("persists structured metadata rather than a pre-rendered UI string", () => {
    const activity = recordActivity({
      entityType: "task",
      entityId: "t-act-meta",
      action: "updated",
      at: AT,
      byUserId: "u1",
      metadata: { field: "priority", old: 3, new: 5 },
    });

    expect(activity.metadata).toEqual({ field: "priority", old: 3, new: 5 });
    expect(getDb().activityLog[activity.id]?.metadata).toEqual({ field: "priority", old: 3, new: 5 });
  });
});

describe("listActivityForTask", () => {
  it("returns only task activities for the given task id", () => {
    recordActivity({
      entityType: "task",
      entityId: "t-list-own",
      action: "created",
      at: AT,
      byUserId: "u1",
    });
    recordActivity({
      entityType: "task",
      entityId: "t-list-other",
      action: "created",
      at: AT,
      byUserId: "u1",
    });
    recordActivity({
      entityType: "list",
      entityId: "t-list-own",
      action: "created",
      at: AT,
      byUserId: "u1",
    });

    const result = listActivityForTask("t-list-own");

    expect(result.every((item) => item.entityType === "task" && item.entityId === "t-list-own")).toBe(true);
    expect(result.length).toBeGreaterThanOrEqual(1);
  });

  it("orders newest first, and by id descending when timestamps match", () => {
    const older = recordActivity({
      entityType: "task",
      entityId: "t-order",
      action: "created",
      at: EARLIER,
      byUserId: "u1",
    });
    const newerB = appendActivity(getDb(), {
      id: "z-later-id",
      entityType: "task",
      entityId: "t-order",
      action: "updated",
      at: AT,
      byUserId: "u1",
    });
    const newerA = appendActivity(getDb(), {
      id: "a-later-id",
      entityType: "task",
      entityId: "t-order",
      action: "status_changed",
      at: AT,
      byUserId: "u1",
    });

    const ids = listActivityForTask("t-order").map((item) => item.id);

    expect(ids).toEqual([newerB.id, newerA.id, older.id]);
  });

  it("returns the same order on repeated calls", () => {
    recordActivity({
      entityType: "task",
      entityId: "t-stable",
      action: "created",
      at: AT,
      byUserId: "u1",
    });
    recordActivity({
      entityType: "task",
      entityId: "t-stable",
      action: "updated",
      at: AT,
      byUserId: "u1",
    });

    expect(listActivityForTask("t-stable").map((item) => item.id)).toEqual(
      listActivityForTask("t-stable").map((item) => item.id),
    );
  });
});
