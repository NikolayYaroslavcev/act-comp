import { describe, expect, it } from "vitest";
import { DEFAULT_SETTINGS } from "@/entities/user/schema";
import type { TaskList } from "@/entities/list/schema";
import type { Task } from "@/entities/task/schema";
import {
  DEADLINE_REMINDER_MINUTES,
  TIME_THRESHOLDS,
  evaluateNotifications,
  getCrossedDeadlineReminders,
  getCrossedTimeThresholds,
  notificationKey,
  selectUnseenNotifications,
  type DueNotification,
} from "./model";

const MIN = 60_000;

describe("getCrossedTimeThresholds", () => {
  it("returns nothing below 75%", () => {
    expect(getCrossedTimeThresholds(74, 100)).toEqual([]);
  });

  it("returns 75 at exactly 75%", () => {
    expect(getCrossedTimeThresholds(75, 100)).toEqual([75]);
  });

  it("stays at 75 between 75 and 90", () => {
    expect(getCrossedTimeThresholds(76, 100)).toEqual([75]);
    expect(getCrossedTimeThresholds(89, 100)).toEqual([75]);
  });

  it("returns 75 and 90 at exactly 90%", () => {
    expect(getCrossedTimeThresholds(90, 100)).toEqual([75, 90]);
  });

  it("stays at 75 and 90 between 90 and 100", () => {
    expect(getCrossedTimeThresholds(91, 100)).toEqual([75, 90]);
    expect(getCrossedTimeThresholds(99, 100)).toEqual([75, 90]);
  });

  it("returns 75, 90 and 100 at exactly 100%", () => {
    expect(getCrossedTimeThresholds(100, 100)).toEqual([75, 90, 100]);
  });

  it("keeps 100 after the estimate is exceeded", () => {
    expect(getCrossedTimeThresholds(101, 100)).toEqual([75, 90, 100]);
  });

  it("uses integer arithmetic so 3/4 is exactly 75%", () => {
    expect(getCrossedTimeThresholds(3, 4)).toEqual([75]);
  });

  it("returns nothing when estimatedMin is 0", () => {
    expect(getCrossedTimeThresholds(10, 0)).toEqual([]);
  });

  it("returns nothing for negative or non-finite values", () => {
    expect(getCrossedTimeThresholds(-1, 100)).toEqual([]);
    expect(getCrossedTimeThresholds(50, -10)).toEqual([]);
    expect(getCrossedTimeThresholds(Number.NaN, 100)).toEqual([]);
    expect(getCrossedTimeThresholds(50, Number.POSITIVE_INFINITY)).toEqual([]);
  });
});

describe("getCrossedDeadlineReminders", () => {
  const deadline = Date.parse("2026-08-29T12:00:00.000Z");

  it("returns nothing when more than 15 minutes remain", () => {
    expect(getCrossedDeadlineReminders(deadline - 15 * MIN - 1, deadline)).toEqual([]);
  });

  it("returns 15 at exactly 15 minutes", () => {
    expect(getCrossedDeadlineReminders(deadline - 15 * MIN, deadline)).toEqual([15]);
  });

  it("stays at 15 between 15 and 10 minutes", () => {
    expect(getCrossedDeadlineReminders(deadline - 12 * MIN, deadline)).toEqual([15]);
  });

  it("returns 15 and 10 at exactly 10 minutes", () => {
    expect(getCrossedDeadlineReminders(deadline - 10 * MIN, deadline)).toEqual([15, 10]);
  });

  it("stays at 15 and 10 between 10 and 5 minutes", () => {
    expect(getCrossedDeadlineReminders(deadline - 7 * MIN, deadline)).toEqual([15, 10]);
  });

  it("returns 15, 10 and 5 at exactly 5 minutes", () => {
    expect(getCrossedDeadlineReminders(deadline - 5 * MIN, deadline)).toEqual([15, 10, 5]);
  });

  it("keeps 15, 10 and 5 when less than 5 minutes remain", () => {
    expect(getCrossedDeadlineReminders(deadline - 1, deadline)).toEqual([15, 10, 5]);
  });

  it("returns nothing once the deadline has passed", () => {
    expect(getCrossedDeadlineReminders(deadline, deadline)).toEqual([]);
    expect(getCrossedDeadlineReminders(deadline + 1, deadline)).toEqual([]);
  });

  it("compares instants, not local datetime strings", () => {
    const now = Date.parse("2026-08-29T07:50:00.000-04:00");
    const due = Date.parse("2026-08-29T12:00:00.000Z");
    expect(due - now).toBe(10 * MIN);
    expect(getCrossedDeadlineReminders(now, due)).toEqual([15, 10]);
  });
});

describe("selectUnseenNotifications", () => {
  const seventyFive: DueNotification = {
    key: notificationKey("time_threshold", "t1", 75),
    kind: "time_threshold",
    entityType: "task",
    entityId: "t1",
    threshold: 75,
    title: "a",
    body: "b",
  };
  const ninety: DueNotification = {
    ...seventyFive,
    key: notificationKey("time_threshold", "t1", 90),
    threshold: 90,
  };

  it("emits a threshold only once for repeated recalculation", () => {
    const first = selectUnseenNotifications([seventyFive], new Set());
    expect(first).toEqual([seventyFive]);
    const seen = new Set(first.map((item) => item.key));
    expect(selectUnseenNotifications([seventyFive, seventyFive], seen)).toEqual([]);
  });

  it("emits 90 as a second notification after 75", () => {
    const seen = new Set([seventyFive.key]);
    expect(selectUnseenNotifications([seventyFive, ninety], seen)).toEqual([ninety]);
  });

  it("emits 75 then 90 then 100 as three distinct keys", () => {
    const hundred: DueNotification = {
      ...seventyFive,
      key: notificationKey("time_threshold", "t1", 100),
      threshold: 100,
    };
    const all = [seventyFive, ninety, hundred];
    const first = selectUnseenNotifications(all, new Set());
    expect(first.map((item) => item.threshold)).toEqual([75, 90, 100]);
    expect(selectUnseenNotifications(all, new Set(first.map((item) => item.key)))).toEqual([]);
  });
});

function makeList(overrides: Partial<TaskList> = {}): TaskList {
  return {
    id: "l-open",
    ownerId: "u1",
    title: "Sprint",
    template: "work",
    taskIds: ["t-open"],
    deadline: "2026-08-29T12:00:00.000Z",
    sharedWith: [],
    history: [],
    deletedAt: null,
    lastActivityAt: "2026-08-29T10:00:00.000Z",
    ...overrides,
  };
}

function makeTask(overrides: Partial<Task> = {}): Task {
  return {
    id: "t-open",
    listId: "l-open",
    code: "TEST-1",
    title: "Ship API",
    description: "",
    status: "in_progress",
    priority: 3,
    category: null,
    tags: [],
    dependsOn: [],
    parentId: null,
    subtaskIds: [],
    deadline: null,
    createdAt: "2026-08-20T09:00:00.000Z",
    estimatedMin: 100,
    timeSpentMin: 75,
    timerStartedAt: null,
    timerPausedAt: null,
    extensions: [],
    history: [],
    deletedAt: null,
    ...overrides,
  };
}

describe("evaluateNotifications", () => {
  const now = new Date("2026-08-29T11:45:00.000Z");

  it("creates a 75% alert from timeSpentMin / estimatedMin", () => {
    const result = evaluateNotifications({
      lists: [makeList({ deadline: null })],
      tasks: [makeTask()],
      settings: DEFAULT_SETTINGS.notifications,
      now,
      seenKeys: new Set(),
    });
    expect(result.map((item) => item.key)).toEqual([notificationKey("time_threshold", "t-open", 75)]);
  });

  it("does not notify for a completed task", () => {
    const result = evaluateNotifications({
      lists: [makeList({ deadline: null })],
      tasks: [makeTask({ status: "done" })],
      settings: DEFAULT_SETTINGS.notifications,
      now,
      seenKeys: new Set(),
    });
    expect(result).toEqual([]);
  });

  it("does not notify for a soft-deleted task", () => {
    const result = evaluateNotifications({
      lists: [makeList({ deadline: null })],
      tasks: [makeTask({ deletedAt: "2026-08-28T00:00:00.000Z" })],
      settings: DEFAULT_SETTINGS.notifications,
      now,
      seenKeys: new Set(),
    });
    expect(result).toEqual([]);
  });

  it("does not create threshold alerts when the setting is off", () => {
    const result = evaluateNotifications({
      lists: [makeList({ deadline: null })],
      tasks: [makeTask()],
      settings: { ...DEFAULT_SETTINGS.notifications, timeThresholdAlerts: false },
      now,
      seenKeys: new Set(),
    });
    expect(result).toEqual([]);
  });

  it("creates a 15-minute list deadline reminder", () => {
    const result = evaluateNotifications({
      lists: [makeList()],
      tasks: [makeTask({ timeSpentMin: 0 })],
      settings: DEFAULT_SETTINGS.notifications,
      now,
      seenKeys: new Set(),
    });
    expect(result.map((item) => item.key)).toEqual([notificationKey("deadline_reminder", "l-open", 15)]);
  });

  it("does not remind when the setting is off", () => {
    const result = evaluateNotifications({
      lists: [makeList()],
      tasks: [makeTask({ timeSpentMin: 0 })],
      settings: { ...DEFAULT_SETTINGS.notifications, deadlineReminders: false },
      now,
      seenKeys: new Set(),
    });
    expect(result).toEqual([]);
  });

  it("does not remind for a null deadline", () => {
    const result = evaluateNotifications({
      lists: [makeList({ deadline: null })],
      tasks: [makeTask({ timeSpentMin: 0 })],
      settings: DEFAULT_SETTINGS.notifications,
      now,
      seenKeys: new Set(),
    });
    expect(result).toEqual([]);
  });

  it("does not remind for a deleted list", () => {
    const result = evaluateNotifications({
      lists: [makeList({ deletedAt: "2026-08-28T00:00:00.000Z" })],
      tasks: [makeTask({ timeSpentMin: 0 })],
      settings: DEFAULT_SETTINGS.notifications,
      now,
      seenKeys: new Set(),
    });
    expect(result).toEqual([]);
  });

  it("does not remind for a list whose remaining tasks are all done", () => {
    const result = evaluateNotifications({
      lists: [makeList()],
      tasks: [makeTask({ status: "done", timeSpentMin: 0 })],
      settings: DEFAULT_SETTINGS.notifications,
      now,
      seenKeys: new Set(),
    });
    expect(result).toEqual([]);
  });

  it("skips keys that were already seen", () => {
    const result = evaluateNotifications({
      lists: [makeList({ deadline: null })],
      tasks: [makeTask()],
      settings: DEFAULT_SETTINGS.notifications,
      now,
      seenKeys: new Set([notificationKey("time_threshold", "t-open", 75)]),
    });
    expect(result).toEqual([]);
  });
});

describe("constants", () => {
  it("uses the TZ thresholds and reminder offsets", () => {
    expect(TIME_THRESHOLDS).toEqual([75, 90, 100]);
    expect(DEADLINE_REMINDER_MINUTES).toEqual([15, 10, 5]);
  });
});
