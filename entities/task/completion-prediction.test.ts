import { describe, expect, it } from "vitest";
import { predictTaskCompletion } from "@/entities/task/completion-prediction";
import type { TaskHistoryProvider } from "@/entities/task/model";
import type { Task } from "@/entities/task/schema";

function makeTask(overrides: Partial<Task> = {}): Task {
  return {
    id: "t1",
    listId: "l1",
    code: "TEST-1",
    title: "Task",
    description: "",
    status: "in_progress",
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
const NOW = new Date(T0);

const noHistory: TaskHistoryProvider = () => null;

describe("predictTaskCompletion — done / deleted", () => {
  it("returns status done for a completed task without computing a projection", () => {
    const task = makeTask({ status: "done", timeSpentMin: 42, estimatedMin: 60 });
    const prediction = predictTaskCompletion(task, noHistory, NOW);

    expect(prediction.status).toBe("done");
    expect(prediction.elapsedMin).toBe(42);
    expect(prediction.remainingMin).toBe(0);
    expect(prediction.predictedDurationMin).toBeNull();
    expect(prediction.predictedCompletionAt).toBeNull();
    expect(prediction.basis).toBeNull();
    expect(prediction.isPastDeadline).toBe(false);
  });

  it("returns status deleted for a soft-deleted task, even if not done", () => {
    const task = makeTask({ deletedAt: "2026-08-28T00:00:00.000Z", estimatedMin: 60 });
    const prediction = predictTaskCompletion(task, noHistory, NOW);

    expect(prediction.status).toBe("deleted");
    expect(prediction.remainingMin).toBeNull();
    expect(prediction.predictedDurationMin).toBeNull();
    expect(prediction.predictedCompletionAt).toBeNull();
  });

  it("prioritizes deleted over done when both apply", () => {
    const task = makeTask({ status: "done", deletedAt: "2026-08-28T00:00:00.000Z" });
    expect(predictTaskCompletion(task, noHistory, NOW).status).toBe("deleted");
  });
});

describe("predictTaskCompletion — no usable data", () => {
  it("returns no_data when there is no estimate and no history", () => {
    const task = makeTask({ estimatedMin: 0, category: null });
    const prediction = predictTaskCompletion(task, noHistory, NOW);

    expect(prediction.status).toBe("no_data");
    expect(prediction.elapsedMin).toBe(0);
    expect(prediction.remainingMin).toBeNull();
    expect(prediction.predictedDurationMin).toBeNull();
    expect(prediction.predictedCompletionAt).toBeNull();
    expect(prediction.basis).toBeNull();
  });

  it("treats estimatedMin of exactly 0 the same as no estimate", () => {
    const task = makeTask({ estimatedMin: 0, timeSpentMin: 10 });
    const prediction = predictTaskCompletion(task, noHistory, NOW);
    expect(prediction.status).toBe("no_data");
  });
});

describe("predictTaskCompletion — estimate-based prediction", () => {
  it("uses estimatedMin as the basis when there is no history signal", () => {
    const task = makeTask({ estimatedMin: 120, timeSpentMin: 30 });
    const prediction = predictTaskCompletion(task, noHistory, NOW);

    expect(prediction.status).toBe("predicted");
    expect(prediction.basis).toBe("estimate");
    expect(prediction.predictedDurationMin).toBe(120);
    expect(prediction.elapsedMin).toBe(30);
    expect(prediction.remainingMin).toBe(90);
  });

  it("uses estimatedMin when history does not signal an overrun", () => {
    const historyAtOrBelowEstimate: TaskHistoryProvider = () => ({ averageActualMinutes: 100 });
    const task = makeTask({ estimatedMin: 120, timeSpentMin: 30 });
    const prediction = predictTaskCompletion(task, historyAtOrBelowEstimate, NOW);

    expect(prediction.basis).toBe("estimate");
    expect(prediction.predictedDurationMin).toBe(120);
  });

  it("clamps remainingMin at 0 once elapsed exceeds the estimate, never negative", () => {
    const task = makeTask({ estimatedMin: 60, timeSpentMin: 90 });
    const prediction = predictTaskCompletion(task, noHistory, NOW);

    expect(prediction.remainingMin).toBe(0);
    expect(prediction.predictedCompletionAt).toBe(NOW.toISOString());
  });
});

describe("predictTaskCompletion — history-based prediction", () => {
  it("falls back to history average when there is no estimate", () => {
    const history: TaskHistoryProvider = () => ({ averageActualMinutes: 150 });
    const task = makeTask({ estimatedMin: 0, timeSpentMin: 20, category: "Backend" });
    const prediction = predictTaskCompletion(task, history, NOW);

    expect(prediction.status).toBe("predicted");
    expect(prediction.basis).toBe("history");
    expect(prediction.predictedDurationMin).toBe(150);
    expect(prediction.remainingMin).toBe(130);
  });

  it("prefers history over estimate when history signals an overrun", () => {
    const history: TaskHistoryProvider = () => ({ averageActualMinutes: 200 });
    const task = makeTask({ estimatedMin: 120, timeSpentMin: 30, category: "Backend" });
    const prediction = predictTaskCompletion(task, history, NOW);

    expect(prediction.basis).toBe("history");
    expect(prediction.predictedDurationMin).toBe(200);
    expect(prediction.remainingMin).toBe(170);
  });

  it("rounds a fractional history average to whole minutes", () => {
    const history: TaskHistoryProvider = () => ({ averageActualMinutes: 100.6 });
    const task = makeTask({ estimatedMin: 0, timeSpentMin: 0, category: "Backend" });
    const prediction = predictTaskCompletion(task, history, NOW);

    expect(prediction.predictedDurationMin).toBe(101);
  });
});

describe("predictTaskCompletion — timer state", () => {
  it("uses committed timeSpentMin when stopped", () => {
    const task = makeTask({ estimatedMin: 100, timeSpentMin: 40 });
    expect(predictTaskCompletion(task, noHistory, NOW).elapsedMin).toBe(40);
  });

  it("uses committed timeSpentMin when paused, ignoring wall-clock time since pause", () => {
    const task = makeTask({ estimatedMin: 100, timeSpentMin: 40, timerPausedAt: T0 });
    const later = new Date("2026-08-29T12:00:00.000Z");
    expect(predictTaskCompletion(task, noHistory, later).elapsedMin).toBe(40);
  });

  it("adds calendar-aware running time when the timer is running", () => {
    const task = makeTask({ estimatedMin: 200, timeSpentMin: 40, timerStartedAt: T0 });
    const ninetySecondsLater = new Date("2026-08-29T10:01:30.000Z");
    const prediction = predictTaskCompletion(task, noHistory, ninetySecondsLater);

    expect(prediction.elapsedMin).toBe(41);
    expect(prediction.remainingMin).toBe(159);
  });

  it("caps a running session's contribution at workDayHours, the same engine Timer/Notifications use", () => {
    const task = makeTask({ estimatedMin: 1000, timeSpentMin: 0, timerStartedAt: T0 });
    const tenHoursLater = new Date("2026-08-29T20:00:00.000Z");
    const prediction = predictTaskCompletion(task, noHistory, tenHoursLater, 8);

    expect(prediction.elapsedMin).toBe(8 * 60);
  });
});

describe("predictTaskCompletion — predictedCompletionAt / workDayHours", () => {
  it("projects the completion date forward respecting workDayHours", () => {
    const task = makeTask({ estimatedMin: 100, timeSpentMin: 0 });
    const prediction = predictTaskCompletion(task, noHistory, NOW, 8);

    expect(prediction.remainingMin).toBe(100);
    expect(prediction.predictedCompletionAt).toBe(new Date("2026-08-29T11:40:00.000Z").toISOString());
  });

  it("predicts a later completion date for a shorter workDayHours with the same remaining work", () => {
    const task = makeTask({ estimatedMin: 600, timeSpentMin: 0 });
    const withEightHourDay = predictTaskCompletion(task, noHistory, NOW, 8).predictedCompletionAt;
    const withFourHourDay = predictTaskCompletion(task, noHistory, NOW, 4).predictedCompletionAt;

    expect(withEightHourDay).not.toBeNull();
    expect(withFourHourDay).not.toBeNull();
    expect(new Date(withFourHourDay!).getTime()).toBeGreaterThan(new Date(withEightHourDay!).getTime());
  });

  it("defaults workDayHours to the app default (8) when not provided", () => {
    const task = makeTask({ estimatedMin: 100, timeSpentMin: 0 });
    expect(predictTaskCompletion(task, noHistory, NOW).predictedCompletionAt).toBe(
      predictTaskCompletion(task, noHistory, NOW, 8).predictedCompletionAt,
    );
  });
});

describe("predictTaskCompletion — deadline", () => {
  it("is not past deadline when there is no deadline", () => {
    const task = makeTask({ estimatedMin: 60, timeSpentMin: 0, deadline: null });
    expect(predictTaskCompletion(task, noHistory, NOW).isPastDeadline).toBe(false);
  });

  it("flags isPastDeadline when the projected completion lands after the deadline", () => {
    const task = makeTask({ estimatedMin: 600, timeSpentMin: 0, deadline: "2026-08-29T12:00:00.000Z" });
    expect(predictTaskCompletion(task, noHistory, NOW, 8).isPastDeadline).toBe(true);
  });

  it("does not flag isPastDeadline when the projected completion lands before the deadline", () => {
    const task = makeTask({ estimatedMin: 30, timeSpentMin: 0, deadline: "2026-09-01T00:00:00.000Z" });
    expect(predictTaskCompletion(task, noHistory, NOW).isPastDeadline).toBe(false);
  });

  it("flags isPastDeadline when the deadline has already passed and the task is still open", () => {
    const task = makeTask({ estimatedMin: 30, timeSpentMin: 0, deadline: "2026-08-01T00:00:00.000Z" });
    expect(predictTaskCompletion(task, noHistory, NOW).isPastDeadline).toBe(true);
  });
});

describe("predictTaskCompletion — robustness", () => {
  it("never returns NaN or Infinity, even with a pathological history signal", () => {
    const poisoned: TaskHistoryProvider = () => ({ averageActualMinutes: Number.POSITIVE_INFINITY });
    const task = makeTask({ estimatedMin: 60, timeSpentMin: 10 });
    const prediction = predictTaskCompletion(task, poisoned, NOW);

    for (const value of [prediction.elapsedMin, prediction.predictedDurationMin, prediction.remainingMin]) {
      if (value !== null) {
        expect(Number.isFinite(value)).toBe(true);
      }
    }
  });

  it("falls back to the estimate when the history signal is NaN", () => {
    const poisoned: TaskHistoryProvider = () => ({ averageActualMinutes: Number.NaN });
    const task = makeTask({ estimatedMin: 60, timeSpentMin: 10 });
    const prediction = predictTaskCompletion(task, poisoned, NOW);

    expect(prediction.basis).toBe("estimate");
    expect(prediction.predictedDurationMin).toBe(60);
  });

  it("is deterministic for identical inputs", () => {
    const history: TaskHistoryProvider = () => ({ averageActualMinutes: 90 });
    const task = makeTask({ estimatedMin: 60, timeSpentMin: 10, deadline: "2026-09-01T00:00:00.000Z" });

    const first = predictTaskCompletion(task, history, NOW, 6);
    const second = predictTaskCompletion(task, history, new Date(T0), 6);
    expect(first).toEqual(second);
  });
});
