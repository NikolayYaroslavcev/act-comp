import { act, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { TaskAgeCounter } from "./task-age-counter";
import type { Task } from "@/entities/task/schema";

function makeTask(overrides: Partial<Task>): Task {
  return {
    id: "t1",
    listId: "l1",
    code: "TEST-1",
    title: "Task",
    description: "",
    status: "in_progress",
    priority: 1,
    category: null,
    tags: [],
    dependsOn: [],
    parentId: null,
    subtaskIds: [],
    deadline: null,
    createdAt: "2026-08-27T10:00:00.000Z",
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

beforeEach(() => {
  vi.useFakeTimers();
});

afterEach(() => {
  vi.useRealTimers();
});

describe("TaskAgeCounter", () => {
  it("shows the elapsed time since createdAt", () => {
    vi.setSystemTime(new Date("2026-08-27T12:30:00.000Z"));
    render(<TaskAgeCounter task={makeTask({})} />);

    expect(screen.getByTestId("task-age-counter")).toHaveTextContent("2h 30m");
  });

  it("updates live as time passes, without a reload", () => {
    vi.setSystemTime(new Date("2026-08-27T10:00:00.000Z"));
    render(<TaskAgeCounter task={makeTask({})} />);

    expect(screen.getByTestId("task-age-counter")).toHaveTextContent("0m");

    act(() => {
      vi.setSystemTime(new Date("2026-08-27T10:05:00.000Z"));
      vi.advanceTimersByTime(30_000);
    });

    expect(screen.getByTestId("task-age-counter")).toHaveTextContent("5m");
  });

  it("ignores the Timer's pause state — it is driven purely by createdAt", () => {
    vi.setSystemTime(new Date("2026-08-27T12:00:00.000Z"));
    render(
      <TaskAgeCounter
        task={makeTask({ timerStartedAt: "2026-08-27T11:00:00.000Z", timerPausedAt: "2026-08-27T11:30:00.000Z" })}
      />,
    );

    expect(screen.getByTestId("task-age-counter")).toHaveTextContent("2h");
  });

  it("survives what looks like a reload (fresh mount) by recomputing from createdAt", () => {
    vi.setSystemTime(new Date("2026-08-28T10:00:00.000Z"));
    const { unmount } = render(<TaskAgeCounter task={makeTask({})} />);
    expect(screen.getByTestId("task-age-counter")).toHaveTextContent("1d");
    unmount();

    render(<TaskAgeCounter task={makeTask({})} />);
    expect(screen.getByTestId("task-age-counter")).toHaveTextContent("1d");
  });
});
