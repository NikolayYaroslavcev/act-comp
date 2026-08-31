import { describe, expect, it } from "vitest";
import { getCrossedTimeThresholds } from "@/entities/notification/model";
import {
  applyTimerAction,
  elapsedMs,
  elapsedMinutes,
  estimateProgressPercent,
  formatElapsedClock,
  getTimerCountdownTier,
  getTimerState,
  remainingMs,
} from "@/entities/task/model";
import type { Task } from "@/entities/task/schema";

function makeTask(overrides: Partial<Task> = {}): Task {
  return {
    id: "t1",
    listId: "l1",
    code: "TEST-1",
    title: "Task",
    description: "",
    status: "new",
    priority: 3,
    category: null,
    tags: [],
    dependsOn: [],
    parentId: null,
    subtaskIds: [],
    deadline: null,
    createdAt: "2026-08-01T00:00:00.000Z",
    estimatedMin: 60,
    timeSpentMin: 0,
    timerStartedAt: null,
    timerPausedAt: null,
    extensions: [],
    history: [],
    deletedAt: null,
    ...overrides,
  };
}

const T0 = "2026-08-29T10:00:00.000Z";
const T0_PLUS_90S = new Date("2026-08-29T10:01:30.000Z");
const T0_PLUS_5M = new Date("2026-08-29T10:05:00.000Z");
const T0_PLUS_2S = new Date("2026-08-29T10:00:02.000Z");

describe("getTimerState", () => {
  it("is stopped when both timestamps are null", () => {
    expect(getTimerState(makeTask())).toBe("stopped");
  });

  it("is running when startedAt is set and pausedAt is null", () => {
    expect(getTimerState(makeTask({ timerStartedAt: T0 }))).toBe("running");
  });

  it("is paused when pausedAt is set", () => {
    expect(getTimerState(makeTask({ timerPausedAt: T0 }))).toBe("paused");
  });

  it("treats both timestamps set as paused so running elapsed is not double-counted", () => {
    expect(getTimerState(makeTask({ timerStartedAt: T0, timerPausedAt: T0_PLUS_5M.toISOString() }))).toBe("paused");
  });
});

describe("elapsedMs / elapsedMinutes", () => {
  it("uses committed timeSpentMin when the timer is stopped", () => {
    const task = makeTask({ timeSpentMin: 12 });
    expect(elapsedMinutes(task, new Date(T0))).toBe(12);
    expect(elapsedMs(task, new Date(T0))).toBe(12 * 60_000);
  });

  it("adds wall-clock time since timerStartedAt while running", () => {
    const task = makeTask({ timeSpentMin: 10, timerStartedAt: T0 });
    expect(elapsedMs(task, T0_PLUS_90S)).toBe(10 * 60_000 + 90_000);
    expect(elapsedMinutes(task, T0_PLUS_90S)).toBe(11);
  });

  it("does not add wall-clock time while paused — only committed minutes", () => {
    const task = makeTask({ timeSpentMin: 7, timerPausedAt: T0 });
    expect(elapsedMinutes(task, T0_PLUS_5M)).toBe(7);
  });

  it("does not go negative if startedAt is in the future", () => {
    const task = makeTask({ timerStartedAt: T0_PLUS_5M.toISOString() });
    expect(elapsedMs(task, new Date(T0))).toBe(0);
  });

  it("caps a running session at workDayHours on the same UTC day", () => {
    const task = makeTask({ timerStartedAt: T0 });
    const tenHoursLater = new Date("2026-08-29T20:00:00.000Z");
    expect(elapsedMinutes(task, tenHoursLater, 8)).toBe(8 * 60);
    expect(elapsedMs(task, tenHoursLater, 8)).toBe(8 * 60 * 60_000);
  });

  it("uses wall-clock elapsed when the running session is under workDayHours", () => {
    const task = makeTask({ timeSpentMin: 10, timerStartedAt: T0 });
    expect(elapsedMinutes(task, T0_PLUS_5M, 8)).toBe(15);
  });
});

describe("estimateProgressPercent", () => {
  it("returns null when estimatedMin is 0", () => {
    expect(estimateProgressPercent(30, 0)).toBeNull();
  });

  it("returns the floor percent of elapsed over estimate", () => {
    expect(estimateProgressPercent(45, 60)).toBe(75);
  });

  it("caps at 100 when spent exceeds estimate", () => {
    expect(estimateProgressPercent(90, 60)).toBe(100);
  });
});

describe("formatElapsedClock", () => {
  it("formats hours, minutes and seconds", () => {
    expect(formatElapsedClock(0)).toBe("0:00:00");
    expect(formatElapsedClock(1_000)).toBe("0:00:01");
    expect(formatElapsedClock(75 * 60_000 + 4_000)).toBe("1:15:04");
  });
});

describe("applyTimerAction start", () => {
  it("starts a stopped timer with a server-owned timestamp", () => {
    const result = applyTimerAction(makeTask(), "start", new Date(T0), "u1");
    expect(result.status).toBe("ok");
    if (result.status === "ok") {
      expect(result.task.timerStartedAt).toBe(T0);
      expect(result.task.timerPausedAt).toBeNull();
      expect(result.task.timeSpentMin).toBe(0);
    }
  });

  it("does not start a second parallel timer", () => {
    const running = makeTask({ timerStartedAt: T0 });
    const result = applyTimerAction(running, "start", T0_PLUS_5M, "u1");
    expect(result.status).toBe("invalid_transition");
    expect(running.timerStartedAt).toBe(T0);
  });

  it("does not treat start as resume", () => {
    const paused = makeTask({ timeSpentMin: 5, timerPausedAt: T0 });
    expect(applyTimerAction(paused, "start", T0_PLUS_5M, "u1").status).toBe("invalid_transition");
  });
});

describe("applyTimerAction pause", () => {
  it("commits floor(elapsed minutes) into timeSpentMin and marks paused", () => {
    const running = makeTask({ timeSpentMin: 3, timerStartedAt: T0 });
    const result = applyTimerAction(running, "pause", T0_PLUS_90S, "u1");
    expect(result.status).toBe("ok");
    if (result.status === "ok") {
      expect(result.task.timeSpentMin).toBe(4);
      expect(result.task.timerStartedAt).toBeNull();
      expect(result.task.timerPausedAt).toBe(T0_PLUS_90S.toISOString());
    }
  });

  it("is a no-op when already paused", () => {
    const paused = makeTask({ timeSpentMin: 4, timerPausedAt: T0 });
    const result = applyTimerAction(paused, "pause", T0_PLUS_5M, "u1");
    expect(result.status).toBe("ok");
    if (result.status === "ok") {
      expect(result.task.timeSpentMin).toBe(4);
      expect(result.task.timerPausedAt).toBe(T0);
    }
  });

  it("rejects pause on a stopped timer", () => {
    expect(applyTimerAction(makeTask(), "pause", new Date(T0), "u1").status).toBe("invalid_transition");
  });

  it("does not add a minute for a sub-minute start-pause", () => {
    const running = makeTask({ timerStartedAt: T0 });
    const result = applyTimerAction(running, "pause", T0_PLUS_2S, "u1");
    expect(result.status).toBe("ok");
    if (result.status === "ok") {
      expect(result.task.timeSpentMin).toBe(0);
    }
  });

  it("commits working elapsed capped by workDayHours, not wall-clock", () => {
    const running = makeTask({ timerStartedAt: T0 });
    const result = applyTimerAction(running, "pause", new Date("2026-08-29T20:00:00.000Z"), "u1", 8);
    expect(result.status).toBe("ok");
    if (result.status === "ok") {
      expect(result.task.timeSpentMin).toBe(8 * 60);
    }
  });
});

describe("applyTimerAction resume", () => {
  it("resumes from paused without resetting committed time", () => {
    const paused = makeTask({ timeSpentMin: 8, timerPausedAt: T0 });
    const result = applyTimerAction(paused, "resume", T0_PLUS_5M, "u1");
    expect(result.status).toBe("ok");
    if (result.status === "ok") {
      expect(result.task.timeSpentMin).toBe(8);
      expect(result.task.timerStartedAt).toBe(T0_PLUS_5M.toISOString());
      expect(result.task.timerPausedAt).toBeNull();
    }
  });

  it("rejects resume while running", () => {
    expect(applyTimerAction(makeTask({ timerStartedAt: T0 }), "resume", T0_PLUS_5M, "u1").status).toBe(
      "invalid_transition",
    );
  });

  it("rejects resume when stopped", () => {
    expect(applyTimerAction(makeTask(), "resume", new Date(T0), "u1").status).toBe("invalid_transition");
  });
});

describe("applyTimerAction stop", () => {
  it("flushes a running session and clears both timestamps", () => {
    const running = makeTask({ timeSpentMin: 2, timerStartedAt: T0 });
    const result = applyTimerAction(running, "stop", T0_PLUS_5M, "u1");
    expect(result.status).toBe("ok");
    if (result.status === "ok") {
      expect(result.task.timeSpentMin).toBe(7);
      expect(result.task.timerStartedAt).toBeNull();
      expect(result.task.timerPausedAt).toBeNull();
    }
  });

  it("clears paused state without adding time again", () => {
    const paused = makeTask({ timeSpentMin: 4, timerPausedAt: T0 });
    const result = applyTimerAction(paused, "stop", T0_PLUS_5M, "u1");
    expect(result.status).toBe("ok");
    if (result.status === "ok") {
      expect(result.task.timeSpentMin).toBe(4);
      expect(getTimerState(result.task)).toBe("stopped");
    }
  });

  it("is a no-op when already stopped", () => {
    const stopped = makeTask({ timeSpentMin: 9 });
    const result = applyTimerAction(stopped, "stop", new Date(T0), "u1");
    expect(result.status).toBe("ok");
    if (result.status === "ok") {
      expect(result.task.timeSpentMin).toBe(9);
    }
  });
});

describe("applyTimerAction sessions and restrictions", () => {
  it("accumulates across start-pause-resume-pause cycles", () => {
    const started = applyTimerAction(makeTask(), "start", new Date(T0), "u1");
    expect(started.status).toBe("ok");
    if (started.status !== "ok") {
      return;
    }

    const paused = applyTimerAction(started.task, "pause", T0_PLUS_5M, "u1");
    expect(paused.status).toBe("ok");
    if (paused.status !== "ok") {
      return;
    }
    expect(paused.task.timeSpentMin).toBe(5);

    const resumed = applyTimerAction(paused.task, "resume", new Date("2026-08-29T10:10:00.000Z"), "u1");
    expect(resumed.status).toBe("ok");
    if (resumed.status !== "ok") {
      return;
    }

    const pausedAgain = applyTimerAction(resumed.task, "pause", new Date("2026-08-29T10:12:00.000Z"), "u1");
    expect(pausedAgain.status).toBe("ok");
    if (pausedAgain.status === "ok") {
      expect(pausedAgain.task.timeSpentMin).toBe(7);
    }
  });

  it("adds only the second session's working minutes after resume", () => {
    const paused = makeTask({ timeSpentMin: 5, timerPausedAt: T0 });
    const resumed = applyTimerAction(paused, "resume", new Date("2026-08-29T12:00:00.000Z"), "u1", 8);
    expect(resumed.status).toBe("ok");
    if (resumed.status !== "ok") {
      return;
    }
    const stopped = applyTimerAction(resumed.task, "stop", new Date("2026-08-29T12:03:00.000Z"), "u1", 8);
    expect(stopped.status).toBe("ok");
    if (stopped.status === "ok") {
      expect(stopped.task.timeSpentMin).toBe(8);
      expect(stopped.task.timerStartedAt).toBeNull();
      expect(stopped.task.timerPausedAt).toBeNull();
    }
  });

  it("rejects timer actions on a completed task", () => {
    const done = makeTask({ status: "done" });
    expect(applyTimerAction(done, "start", new Date(T0), "u1").status).toBe("completed");
  });

  it("rejects timer actions on a soft-deleted task", () => {
    const deleted = makeTask({ deletedAt: T0 });
    expect(applyTimerAction(deleted, "start", new Date(T0), "u1").status).toBe("deleted");
  });

  it("records history with the acting user, not a client-supplied timestamp field", () => {
    const result = applyTimerAction(makeTask(), "start", new Date(T0), "u1");
    expect(result.status).toBe("ok");
    if (result.status === "ok") {
      expect(result.task.history).toEqual([
        expect.objectContaining({ field: "timerStartedAt", old: null, new: T0, at: T0, byUserId: "u1" }),
      ]);
    }
  });
});

describe("remainingMs", () => {
  it("is null when the task has no estimate", () => {
    const task = makeTask({ estimatedMin: 0 });
    expect(remainingMs(task, new Date(T0))).toBeNull();
  });

  it("is the full estimate before any time is spent", () => {
    const task = makeTask({ estimatedMin: 60, timeSpentMin: 0 });
    expect(remainingMs(task, new Date(T0))).toBe(60 * 60_000);
  });

  it("decreases as committed time is spent", () => {
    const task = makeTask({ estimatedMin: 60, timeSpentMin: 20 });
    expect(remainingMs(task, new Date(T0))).toBe(40 * 60_000);
  });

  it("decreases live while the timer is running", () => {
    const task = makeTask({ estimatedMin: 60, timeSpentMin: 0, timerStartedAt: T0 });
    expect(remainingMs(task, T0_PLUS_5M)).toBe(55 * 60_000);
  });

  it("is exactly 0 when spent time equals the estimate", () => {
    const task = makeTask({ estimatedMin: 60, timeSpentMin: 60 });
    expect(remainingMs(task, new Date(T0))).toBe(0);
  });

  it("goes negative once the estimate is exceeded (callers clamp for display)", () => {
    const task = makeTask({ estimatedMin: 60, timeSpentMin: 75 });
    expect(remainingMs(task, new Date(T0))).toBe(-15 * 60_000);
  });

  it("does not double-count time while paused (uses committed timeSpentMin only)", () => {
    const task = makeTask({ estimatedMin: 60, timeSpentMin: 20, timerPausedAt: T0 });
    expect(remainingMs(task, T0_PLUS_5M)).toBe(remainingMs(task, new Date(T0)));
  });
});

describe("getTimerCountdownTier", () => {
  it("is null when there is no estimate to count down from", () => {
    expect(getTimerCountdownTier(makeTask({ estimatedMin: 0 }), new Date(T0))).toBeNull();
  });

  it("is normal under the 75% threshold", () => {
    const task = makeTask({ estimatedMin: 100, timeSpentMin: 74 });
    expect(getTimerCountdownTier(task, new Date(T0))).toBe("normal");
  });

  it("is warning between the 75% and 100% thresholds", () => {
    const task = makeTask({ estimatedMin: 100, timeSpentMin: 75 });
    expect(getTimerCountdownTier(task, new Date(T0))).toBe("warning");
    expect(getTimerCountdownTier(makeTask({ estimatedMin: 100, timeSpentMin: 99 }), new Date(T0))).toBe("warning");
  });

  it("is urgent at and beyond the 100% threshold", () => {
    expect(getTimerCountdownTier(makeTask({ estimatedMin: 100, timeSpentMin: 100 }), new Date(T0))).toBe("urgent");
    expect(getTimerCountdownTier(makeTask({ estimatedMin: 100, timeSpentMin: 130 }), new Date(T0))).toBe("urgent");
  });
});

describe("timer vs time-threshold notifications", () => {
  it("does not cross 75% from a running tick that has not been paused yet", () => {
    const running = makeTask({ estimatedMin: 100, timeSpentMin: 74, timerStartedAt: T0 });
    expect(getCrossedTimeThresholds(running.timeSpentMin, running.estimatedMin)).toEqual([]);
    expect(getCrossedTimeThresholds(elapsedMinutes(running, T0_PLUS_5M), running.estimatedMin)).toEqual([75]);
  });

  it("crosses 75% once after pause commits timeSpentMin, not again from the same spent figure", () => {
    const running = makeTask({ estimatedMin: 100, timeSpentMin: 70, timerStartedAt: T0 });
    const paused = applyTimerAction(running, "pause", new Date("2026-08-29T10:05:00.000Z"), "u1");
    expect(paused.status).toBe("ok");
    if (paused.status !== "ok") {
      return;
    }

    expect(paused.task.timeSpentMin).toBe(75);
    expect(getCrossedTimeThresholds(paused.task.timeSpentMin, paused.task.estimatedMin)).toEqual([75]);
    const later = applyTimerAction(paused.task, "pause", new Date("2026-08-29T11:00:00.000Z"), "u1");
    expect(later.status).toBe("ok");
    if (later.status === "ok") {
      expect(later.task.timeSpentMin).toBe(75);
      expect(getCrossedTimeThresholds(later.task.timeSpentMin, later.task.estimatedMin)).toEqual([75]);
    }
  });
});
