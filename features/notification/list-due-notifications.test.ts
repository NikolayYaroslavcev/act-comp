import { describe, expect, it } from "vitest";
import { getDb, saveDb } from "@/shared/lib/db";
import { notificationKey } from "@/entities/notification/model";
import { ackNotificationsForUser } from "./ack-notifications";
import { listDueNotificationsForUser } from "./list-due-notifications";

const NOW = new Date("2026-08-29T11:45:00.000Z");

describe("listDueNotificationsForUser", () => {
  it("returns not_found for an unknown user", () => {
    expect(listDueNotificationsForUser("nobody", NOW)).toEqual({ status: "not_found" });
  });

  it("emits a threshold for an open task at 75% and does not duplicate after ack", () => {
    const db = getDb();
    db.tasks.t11 = { ...db.tasks.t11, timeSpentMin: 135 };
    saveDb(db);

    const first = listDueNotificationsForUser("u2", NOW);
    expect(first.status).toBe("ok");
    if (first.status !== "ok") {
      return;
    }

    const key = notificationKey("time_threshold", "t11", 75);
    expect(first.notifications.some((item) => item.key === key)).toBe(false);

    const asOwner = listDueNotificationsForUser("u1", NOW);
    expect(asOwner.status).toBe("ok");
    if (asOwner.status !== "ok") {
      return;
    }
    expect(asOwner.notifications.some((item) => item.key === key)).toBe(true);

    ackNotificationsForUser("u1", [key]);
    const afterAck = listDueNotificationsForUser("u1", NOW);
    expect(afterAck.status).toBe("ok");
    if (afterAck.status !== "ok") {
      return;
    }
    expect(afterAck.notifications.some((item) => item.key === key)).toBe(false);
  });

  it("respects u2 timeThresholdAlerts=false even when a shared task crosses 75%", () => {
    const db = getDb();
    db.tasks.t1 = { ...db.tasks.t1, timeSpentMin: 360 };
    saveDb(db);

    const result = listDueNotificationsForUser("u2", NOW);
    expect(result.status).toBe("ok");
    if (result.status !== "ok") {
      return;
    }
    expect(result.notifications.some((item) => item.kind === "time_threshold")).toBe(false);
  });

  it("does not emit deadline reminders for a deleted list", () => {
    const db = getDb();
    db.lists.l4 = { ...db.lists.l4, deadline: NOW.toISOString() };
    saveDb(db);

    const result = listDueNotificationsForUser("u1", new Date(NOW.getTime() - 15 * 60_000));
    expect(result.status).toBe("ok");
    if (result.status !== "ok") {
      return;
    }
    expect(result.notifications.some((item) => item.entityId === "l4")).toBe(false);
  });

  it("emits list deadline reminders at 15, 10 and 5 minutes without duplicates", () => {
    const deadline = new Date("2026-08-29T18:00:00.000Z");
    const db = getDb();
    db.lists.l2 = { ...db.lists.l2, deadline: deadline.toISOString() };
    saveDb(db);

    const at15 = listDueNotificationsForUser("u1", new Date(deadline.getTime() - 15 * 60_000));
    expect(at15.status).toBe("ok");
    if (at15.status !== "ok") {
      return;
    }
    const key15 = notificationKey("deadline_reminder", "l2", 15);
    const key10 = notificationKey("deadline_reminder", "l2", 10);
    const key5 = notificationKey("deadline_reminder", "l2", 5);
    expect(at15.notifications.map((item) => item.key)).toContain(key15);
    expect(at15.notifications.map((item) => item.key)).not.toContain(key10);

    ackNotificationsForUser("u1", [key15]);
    const at10 = listDueNotificationsForUser("u1", new Date(deadline.getTime() - 10 * 60_000));
    expect(at10.status).toBe("ok");
    if (at10.status !== "ok") {
      return;
    }
    expect(at10.notifications.map((item) => item.key)).toContain(key10);
    expect(at10.notifications.map((item) => item.key)).not.toContain(key15);

    ackNotificationsForUser("u1", [key10]);
    const at5 = listDueNotificationsForUser("u1", new Date(deadline.getTime() - 5 * 60_000));
    expect(at5.status).toBe("ok");
    if (at5.status !== "ok") {
      return;
    }
    expect(at5.notifications.map((item) => item.key)).toContain(key5);

    ackNotificationsForUser("u1", [key5]);
    const overdue = listDueNotificationsForUser("u1", new Date(deadline.getTime() + 1));
    expect(overdue.status).toBe("ok");
    if (overdue.status !== "ok") {
      return;
    }
    expect(overdue.notifications.some((item) => item.entityId === "l2" && item.kind === "deadline_reminder")).toBe(
      false,
    );
  });
});

describe("ackNotificationsForUser", () => {
  it("returns not_found for an unknown user", () => {
    expect(ackNotificationsForUser("nobody", ["time_threshold:t1:75"])).toEqual({ status: "not_found" });
  });
});
