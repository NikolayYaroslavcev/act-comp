import { describe, expect, it } from "vitest";
import { getDb, saveDb } from "@/shared/lib/db";
import { notificationKey } from "@/entities/notification/model";
import { updateUserSettings } from "@/entities/user/repository";
import { ackNotificationsForUser } from "./ack-notifications";
import { listDueNotificationsForUser } from "./list-due-notifications";

const NOW = new Date("2026-08-29T11:45:00.000Z");

describe("listDueNotificationsForUser", () => {
  it("returns not_found for an unknown user", async () => {
    expect(await listDueNotificationsForUser("nobody", NOW)).toEqual({ status: "not_found" });
  });

  it("emits a threshold for an open task at 75% and does not duplicate after ack", async () => {
    const db = await getDb();
    db.tasks.t11 = { ...db.tasks.t11, timeSpentMin: 135 };
    await saveDb(db);

    const first = await listDueNotificationsForUser("u2", NOW);
    expect(first.status).toBe("ok");
    if (first.status !== "ok") {
      return;
    }

    const key = notificationKey("time_threshold", "t11", 75);
    expect(first.notifications.some((item) => item.key === key)).toBe(false);

    const asOwner = await listDueNotificationsForUser("u1", NOW);
    expect(asOwner.status).toBe("ok");
    if (asOwner.status !== "ok") {
      return;
    }
    expect(asOwner.notifications.some((item) => item.key === key)).toBe(true);

    await ackNotificationsForUser("u1", [key], NOW);
    const afterAck = await listDueNotificationsForUser("u1", NOW);
    expect(afterAck.status).toBe("ok");
    if (afterAck.status !== "ok") {
      return;
    }
    expect(afterAck.notifications.some((item) => item.key === key)).toBe(false);
  });

  it("emits 90% from a running timer using the same elapsed as the timer", async () => {
    const db = await getDb();
    db.tasks.t11 = {
      ...db.tasks.t11,
      estimatedMin: 180,
      timeSpentMin: 157,
      timerStartedAt: "2026-08-29T11:40:00.000Z",
      timerPausedAt: null,
      status: "in_progress",
      deletedAt: null,
    };
    await saveDb(db);

    const result = await listDueNotificationsForUser("u1", NOW);
    expect(result.status).toBe("ok");
    if (result.status !== "ok") {
      return;
    }
    expect(result.notifications.some((item) => item.key === notificationKey("time_threshold", "t11", 90))).toBe(
      true,
    );
  });

  it("respects u2 timeThresholdAlerts=false even when a shared task crosses 75%", async () => {
    const db = await getDb();
    db.tasks.t1 = { ...db.tasks.t1, timeSpentMin: 360 };
    await saveDb(db);

    const result = await listDueNotificationsForUser("u2", NOW);
    expect(result.status).toBe("ok");
    if (result.status !== "ok") {
      return;
    }
    expect(result.notifications.some((item) => item.kind === "time_threshold")).toBe(false);
  });

  it("does not emit deadline reminders for a deleted list", async () => {
    const db = await getDb();
    db.lists.l4 = { ...db.lists.l4, deadline: NOW.toISOString() };
    await saveDb(db);

    const result = await listDueNotificationsForUser("u1", new Date(NOW.getTime() - 15 * 60_000));
    expect(result.status).toBe("ok");
    if (result.status !== "ok") {
      return;
    }
    expect(result.notifications.some((item) => item.entityId === "l4")).toBe(false);
  });

  it("emits list deadline reminders at 15, 10 and 5 minutes without duplicates", async () => {
    const deadline = new Date("2026-08-29T18:00:00.000Z");
    const db = await getDb();
    db.lists.l2 = { ...db.lists.l2, deadline: deadline.toISOString() };
    await saveDb(db);

    const at15 = await listDueNotificationsForUser("u1", new Date(deadline.getTime() - 15 * 60_000));
    expect(at15.status).toBe("ok");
    if (at15.status !== "ok") {
      return;
    }
    const key15 = notificationKey("deadline_reminder", "l2", 15);
    const key10 = notificationKey("deadline_reminder", "l2", 10);
    const key5 = notificationKey("deadline_reminder", "l2", 5);
    expect(at15.notifications.map((item) => item.key)).toContain(key15);
    expect(at15.notifications.map((item) => item.key)).not.toContain(key10);

    await ackNotificationsForUser("u1", [key15], new Date(deadline.getTime() - 15 * 60_000));
    const at10 = await listDueNotificationsForUser("u1", new Date(deadline.getTime() - 10 * 60_000));
    expect(at10.status).toBe("ok");
    if (at10.status !== "ok") {
      return;
    }
    expect(at10.notifications.map((item) => item.key)).toContain(key10);
    expect(at10.notifications.map((item) => item.key)).not.toContain(key15);

    await ackNotificationsForUser("u1", [key10], new Date(deadline.getTime() - 10 * 60_000));
    const at5 = await listDueNotificationsForUser("u1", new Date(deadline.getTime() - 5 * 60_000));
    expect(at5.status).toBe("ok");
    if (at5.status !== "ok") {
      return;
    }
    expect(at5.notifications.map((item) => item.key)).toContain(key5);

    await ackNotificationsForUser("u1", [key5], new Date(deadline.getTime() - 5 * 60_000));
    const overdue = await listDueNotificationsForUser("u1", new Date(deadline.getTime() + 1));
    expect(overdue.status).toBe("ok");
    if (overdue.status !== "ok") {
      return;
    }
    expect(overdue.notifications.some((item) => item.entityId === "l2" && item.kind === "deadline_reminder")).toBe(
      false,
    );
  });

  it("does not emit a workDayHours notification just from loading with the currently saved value", async () => {
    const before = await listDueNotificationsForUser("u1", NOW);
    expect(before.status).toBe("ok");
    if (before.status !== "ok") {
      return;
    }
    expect(before.notifications.some((item) => item.kind === "work_day_hours_changed")).toBe(false);
  });

  it("emits a workDayHours notification after a real settings change and not again after ack", async () => {
    const result = await updateUserSettings("u1", { workDayHours: 5 }, NOW);
    expect(result.status).toBe("ok");
    if (result.status !== "ok") {
      return;
    }

    const first = await listDueNotificationsForUser("u1", NOW);
    expect(first.status).toBe("ok");
    if (first.status !== "ok") {
      return;
    }
    const notification = first.notifications.find((item) => item.kind === "work_day_hours_changed");
    expect(notification).toBeDefined();
    expect(notification?.body).toContain("5");

    await ackNotificationsForUser("u1", [notification!.key], NOW);
    const afterAck = await listDueNotificationsForUser("u1", NOW);
    expect(afterAck.status).toBe("ok");
    if (afterAck.status !== "ok") {
      return;
    }
    expect(afterAck.notifications.some((item) => item.kind === "work_day_hours_changed")).toBe(false);
  });

  it("does not emit a workDayHours notification for another user's change", async () => {
    await updateUserSettings("u1", { workDayHours: 5 }, NOW);

    const result = await listDueNotificationsForUser("u2", NOW);
    expect(result.status).toBe("ok");
    if (result.status !== "ok") {
      return;
    }
    expect(result.notifications.some((item) => item.kind === "work_day_hours_changed")).toBe(false);
  });

  it("does not emit a workDayHours notification when workHoursRecalculation is disabled", async () => {
    await updateUserSettings("u1", { notifications: { workHoursRecalculation: false } }, NOW);
    await updateUserSettings("u1", { workDayHours: 5 }, NOW);

    const result = await listDueNotificationsForUser("u1", NOW);
    expect(result.status).toBe("ok");
    if (result.status !== "ok") {
      return;
    }
    expect(result.notifications.some((item) => item.kind === "work_day_hours_changed")).toBe(false);
  });
});

describe("ackNotificationsForUser", () => {
  it("returns not_found for an unknown user", async () => {
    expect(await ackNotificationsForUser("nobody", ["time_threshold:t1:75"])).toEqual({ status: "not_found" });
  });
});
