import { describe, expect, it } from "vitest";
import { listActivityForUser } from "@/entities/activity/repository";
import { countUsers, findUserByEmail, findUserById, updateUserSettings } from "@/entities/user/repository";
import { getDb } from "@/shared/lib/db";

describe("findUserByEmail", () => {
  it("finds the seeded admin account", async () => {
    const user = await findUserByEmail("admin@example.com");
    expect(user?.email).toBe("admin@example.com");
  });

  it("is case-insensitive", async () => {
    const user = await findUserByEmail("Admin@Example.com");
    expect(user?.email).toBe("admin@example.com");
  });

  it("returns undefined for an unknown email", async () => {
    expect(await findUserByEmail("nobody@example.com")).toBeUndefined();
  });
});

describe("findUserById", () => {
  it("finds a user by id", async () => {
    const user = await findUserByEmail("admin@example.com");
    expect(user).toBeDefined();
    expect((await findUserById(user!.id))?.email).toBe("admin@example.com");
  });

  it("returns undefined for an unknown id", async () => {
    expect(await findUserById("does-not-exist")).toBeUndefined();
  });
});

describe("countUsers", () => {
  it("counts every user in the store", async () => {
    expect(await countUsers()).toBe(Object.keys((await getDb()).users).length);
  });
});

describe("updateUserSettings", () => {
  it("returns not_found for an unknown user", async () => {
    expect(await updateUserSettings("does-not-exist", { theme: "dark" })).toEqual({ status: "not_found" });
  });

  it("updates only the current user's settings", async () => {
    const beforeU2 = (await findUserById("u2"))!.settings;

    const result = await updateUserSettings("u1", { theme: "dark" });

    expect(result.status).toBe("ok");
    if (result.status === "ok") {
      expect(result.settings.theme).toBe("dark");
    }
    expect((await findUserById("u1"))!.settings.theme).toBe("dark");
    expect((await findUserById("u2"))!.settings).toEqual(beforeU2);
  });

  it("applies a nested patch without dropping sibling preferences", async () => {
    const before = (await findUserById("u1"))!.settings;

    const result = await updateUserSettings("u1", {
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

  it("does not rewrite storage on a no-op patch", async () => {
    const first = await updateUserSettings("u1", { theme: (await findUserById("u1"))!.settings.theme });
    const after = (await findUserById("u1"))!.settings;

    expect(first.status).toBe("ok");
    if (first.status === "ok") {
      expect(first.settings).toBe(after);
    }
  });

  describe("workDayHours change tracking", () => {
    const now = new Date("2026-08-31T09:00:00.000Z");

    async function countWorkDayHoursEvents(userId: string): Promise<number> {
      return (await listActivityForUser(userId)).filter((entry) => entry.action === "work_day_hours_changed").length;
    }

    it("records a work_day_hours_changed activity entry when the value actually changes", async () => {
      const before = (await findUserById("u1"))!.settings.workDayHours;
      const next = before === 6 ? 7 : 6;
      const countBefore = await countWorkDayHoursEvents("u1");

      await updateUserSettings("u1", { workDayHours: next }, now);

      const entries = (await listActivityForUser("u1")).filter((entry) => entry.action === "work_day_hours_changed");
      expect(entries).toHaveLength(countBefore + 1);
      expect(entries.at(-1)).toMatchObject({
        entityType: "user",
        entityId: "u1",
        byUserId: "u1",
        at: now.toISOString(),
        metadata: { field: "workDayHours", old: before, new: next },
      });
    });

    it("does not record an activity entry when workDayHours is saved with the same value", async () => {
      const current = (await findUserById("u1"))!.settings.workDayHours;
      const countBefore = await countWorkDayHoursEvents("u1");

      await updateUserSettings("u1", { workDayHours: current }, now);

      expect(await countWorkDayHoursEvents("u1")).toBe(countBefore);
    });

    it("does not record an activity entry when an unrelated field changes", async () => {
      const countBefore = await countWorkDayHoursEvents("u1");

      await updateUserSettings("u1", { theme: "dark" }, now);

      expect(await countWorkDayHoursEvents("u1")).toBe(countBefore);
    });

    it("records a new entry for each subsequent real change", async () => {
      const countBefore = await countWorkDayHoursEvents("u1");

      await updateUserSettings("u1", { workDayHours: 5 }, now);
      await updateUserSettings("u1", { workDayHours: 6 }, now);

      expect(await countWorkDayHoursEvents("u1")).toBe(countBefore + 2);
    });

    it("does not leak an activity entry to another user", async () => {
      const countBeforeU2 = await countWorkDayHoursEvents("u2");

      await updateUserSettings("u1", { workDayHours: 5 }, now);

      expect(await countWorkDayHoursEvents("u2")).toBe(countBeforeU2);
    });
  });
});
