import { describe, expect, it } from "vitest";
import { listActivityForUser } from "@/entities/activity/repository";
import { countUsers, findUserByEmail, findUserById, updateUserSettings } from "@/entities/user/repository";
import { getDb } from "@/shared/lib/db";

describe("findUserByEmail", () => {
  it("finds the seeded admin account", () => {
    const user = findUserByEmail("admin@example.com");
    expect(user?.email).toBe("admin@example.com");
  });

  it("is case-insensitive", () => {
    const user = findUserByEmail("Admin@Example.com");
    expect(user?.email).toBe("admin@example.com");
  });

  it("returns undefined for an unknown email", () => {
    expect(findUserByEmail("nobody@example.com")).toBeUndefined();
  });
});

describe("findUserById", () => {
  it("finds a user by id", () => {
    const user = findUserByEmail("admin@example.com");
    expect(user).toBeDefined();
    expect(findUserById(user!.id)?.email).toBe("admin@example.com");
  });

  it("returns undefined for an unknown id", () => {
    expect(findUserById("does-not-exist")).toBeUndefined();
  });
});

describe("countUsers", () => {
  it("counts every user in the store", () => {
    expect(countUsers()).toBe(Object.keys(getDb().users).length);
  });
});

describe("updateUserSettings", () => {
  it("returns not_found for an unknown user", () => {
    expect(updateUserSettings("does-not-exist", { theme: "dark" })).toEqual({ status: "not_found" });
  });

  it("updates only the current user's settings", () => {
    const beforeU2 = findUserById("u2")!.settings;

    const result = updateUserSettings("u1", { theme: "dark" });

    expect(result.status).toBe("ok");
    if (result.status === "ok") {
      expect(result.settings.theme).toBe("dark");
    }
    expect(findUserById("u1")!.settings.theme).toBe("dark");
    expect(findUserById("u2")!.settings).toEqual(beforeU2);
  });

  it("applies a nested patch without dropping sibling preferences", () => {
    const before = findUserById("u1")!.settings;

    const result = updateUserSettings("u1", {
      notifications: { deadlineReminders: false },
    });

    expect(result.status).toBe("ok");
    if (result.status === "ok") {
      expect(result.settings.notifications.deadlineReminders).toBe(false);
      expect(result.settings.notifications.timeThresholdAlerts).toBe(before.notifications.timeThresholdAlerts);
      expect(result.settings.workDayHours).toBe(before.workDayHours);
      expect(result.settings.taskDefaults).toEqual(before.taskDefaults);
    }
  });

  it("does not rewrite storage on a no-op patch", () => {
    const first = updateUserSettings("u1", { theme: findUserById("u1")!.settings.theme });
    const after = findUserById("u1")!.settings;

    expect(first.status).toBe("ok");
    if (first.status === "ok") {
      expect(first.settings).toBe(after);
    }
  });

  describe("workDayHours change tracking", () => {
    const now = new Date("2026-08-31T09:00:00.000Z");

    function countWorkDayHoursEvents(userId: string): number {
      return listActivityForUser(userId).filter((entry) => entry.action === "work_day_hours_changed").length;
    }

    it("records a work_day_hours_changed activity entry when the value actually changes", () => {
      const before = findUserById("u1")!.settings.workDayHours;
      const next = before === 6 ? 7 : 6;
      const countBefore = countWorkDayHoursEvents("u1");

      updateUserSettings("u1", { workDayHours: next }, now);

      const entries = listActivityForUser("u1").filter((entry) => entry.action === "work_day_hours_changed");
      expect(entries).toHaveLength(countBefore + 1);
      expect(entries.at(-1)).toMatchObject({
        entityType: "user",
        entityId: "u1",
        byUserId: "u1",
        at: now.toISOString(),
        metadata: { field: "workDayHours", old: before, new: next },
      });
    });

    it("does not record an activity entry when workDayHours is saved with the same value", () => {
      const current = findUserById("u1")!.settings.workDayHours;
      const countBefore = countWorkDayHoursEvents("u1");

      updateUserSettings("u1", { workDayHours: current }, now);

      expect(countWorkDayHoursEvents("u1")).toBe(countBefore);
    });

    it("does not record an activity entry when an unrelated field changes", () => {
      const countBefore = countWorkDayHoursEvents("u1");

      updateUserSettings("u1", { theme: "dark" }, now);

      expect(countWorkDayHoursEvents("u1")).toBe(countBefore);
    });

    it("records a new entry for each subsequent real change", () => {
      const countBefore = countWorkDayHoursEvents("u1");

      updateUserSettings("u1", { workDayHours: 5 }, now);
      updateUserSettings("u1", { workDayHours: 6 }, now);

      expect(countWorkDayHoursEvents("u1")).toBe(countBefore + 2);
    });

    it("does not leak an activity entry to another user", () => {
      const countBeforeU2 = countWorkDayHoursEvents("u2");

      updateUserSettings("u1", { workDayHours: 5 }, now);

      expect(countWorkDayHoursEvents("u2")).toBe(countBeforeU2);
    });
  });
});
