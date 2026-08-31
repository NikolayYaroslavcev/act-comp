import { act, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";
import { TaskTimer } from "./task-timer";
import type { Task } from "@/entities/task/schema";

function jsonResponse(status: number, body: unknown) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json" },
  });
}

function makeTask(overrides: Partial<Task> = {}): Task {
  return {
    id: "t1",
    listId: "l1",
    code: "TEST-1",
    title: "Написать тесты",
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

afterEach(() => {
  vi.unstubAllGlobals();
  vi.useRealTimers();
});

describe("TaskTimer", () => {
  it("shows a stopped timer with start enabled for editors", () => {
    render(<TaskTimer task={makeTask()} canEdit onTaskUpdated={vi.fn()} />);

    expect(screen.getByTestId("task-timer-state")).toHaveTextContent("Остановлен");
    expect(screen.getByTestId("task-timer-elapsed")).toHaveTextContent("0:00:00");
    expect(screen.getByRole("button", { name: "Запустить таймер" })).toBeEnabled();
    expect(screen.getByRole("button", { name: "Пауза" })).toBeDisabled();
    expect(screen.getByRole("button", { name: "Продолжить таймер" })).toBeDisabled();
    expect(screen.getByRole("button", { name: "Остановить таймер" })).toBeDisabled();
  });

  it("ticks elapsed time while running without sending requests", async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-08-29T12:00:00.000Z"));
    vi.stubGlobal("fetch", vi.fn());

    render(
      <TaskTimer
        task={makeTask({ timerStartedAt: "2026-08-29T12:00:00.000Z" })}
        canEdit
        onTaskUpdated={vi.fn()}
      />,
    );

    expect(screen.getByTestId("task-timer-state")).toHaveTextContent("Идёт");
    expect(screen.getByTestId("task-timer-elapsed")).toHaveTextContent("0:00:00");

    await act(() => {
      vi.advanceTimersByTime(1000);
    });

    expect(screen.getByTestId("task-timer-elapsed")).toHaveTextContent("0:00:01");
    expect(fetch).not.toHaveBeenCalled();
  });

  it("starts the timer via POST and reports the updated task", async () => {
    const user = userEvent.setup();
    const updated = makeTask({ timerStartedAt: "2026-08-29T12:00:00.000Z" });
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(jsonResponse(200, { data: updated })));
    const onTaskUpdated = vi.fn();

    render(<TaskTimer task={makeTask()} canEdit onTaskUpdated={onTaskUpdated} />);
    await user.click(screen.getByRole("button", { name: "Запустить таймер" }));

    expect(fetch).toHaveBeenCalledWith(
      "/api/tasks/t1/timer",
      expect.objectContaining({ method: "POST", body: JSON.stringify({ action: "start" }) }),
    );
    expect(onTaskUpdated).toHaveBeenCalledWith(updated);
  });

  it("pauses a running timer", async () => {
    const user = userEvent.setup();
    const updated = makeTask({ timeSpentMin: 5, timerPausedAt: "2026-08-29T12:05:00.000Z" });
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(jsonResponse(200, { data: updated })));

    render(
      <TaskTimer
        task={makeTask({ timerStartedAt: "2026-08-29T12:00:00.000Z" })}
        canEdit
        onTaskUpdated={vi.fn()}
      />,
    );
    await user.click(screen.getByRole("button", { name: "Пауза" }));

    expect(fetch).toHaveBeenCalledWith(
      "/api/tasks/t1/timer",
      expect.objectContaining({ body: JSON.stringify({ action: "pause" }) }),
    );
  });

  it("resumes a paused timer", async () => {
    const user = userEvent.setup();
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(jsonResponse(200, { data: makeTask({ timerStartedAt: "2026-08-29T12:10:00.000Z" }) })),
    );

    render(
      <TaskTimer
        task={makeTask({ timeSpentMin: 5, timerPausedAt: "2026-08-29T12:05:00.000Z" })}
        canEdit
        onTaskUpdated={vi.fn()}
      />,
    );

    expect(screen.getByTestId("task-timer-state")).toHaveTextContent("На паузе");
    await user.click(screen.getByRole("button", { name: "Продолжить таймер" }));
    expect(fetch).toHaveBeenCalledWith(
      "/api/tasks/t1/timer",
      expect.objectContaining({ body: JSON.stringify({ action: "resume" }) }),
    );
  });

  it("restores elapsed from persisted running timestamps", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-08-29T12:00:10.000Z"));

    render(
      <TaskTimer
        task={makeTask({ timeSpentMin: 1, timerStartedAt: "2026-08-29T12:00:00.000Z" })}
        canEdit
        onTaskUpdated={vi.fn()}
      />,
    );

    expect(screen.getByTestId("task-timer-elapsed")).toHaveTextContent("0:01:10");
  });

  it("disables controls on a completed task", () => {
    render(<TaskTimer task={makeTask({ status: "done" })} canEdit onTaskUpdated={vi.fn()} />);

    expect(screen.getByRole("button", { name: "Запустить таймер" })).toBeDisabled();
    expect(screen.getByTestId("task-timer-unavailable")).toHaveTextContent("Таймер недоступен для завершённой задачи");
  });

  it("disables controls on a soft-deleted task", () => {
    render(
      <TaskTimer
        task={makeTask({ deletedAt: "2026-08-29T09:00:00.000Z" })}
        canEdit
        onTaskUpdated={vi.fn()}
      />,
    );

    expect(screen.getByRole("button", { name: "Запустить таймер" })).toBeDisabled();
    expect(screen.getByTestId("task-timer-unavailable")).toHaveTextContent("Таймер недоступен для удалённой задачи");
  });

  it("disables controls without edit permission", () => {
    render(<TaskTimer task={makeTask()} canEdit={false} onTaskUpdated={vi.fn()} />);

    expect(screen.getByRole("button", { name: "Запустить таймер" })).toBeDisabled();
  });

  it("shows an error from a failed request", async () => {
    const user = userEvent.setup();
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(jsonResponse(403, { error: { message: "x" } })));

    render(<TaskTimer task={makeTask()} canEdit onTaskUpdated={vi.fn()} />);
    await user.click(screen.getByRole("button", { name: "Запустить таймер" }));

    expect(screen.getByRole("alert")).toHaveTextContent("У вас нет прав на управление таймером этой задачи");
  });

  it("shows estimate progress when estimatedMin is set", () => {
    render(
      <TaskTimer task={makeTask({ estimatedMin: 60, timeSpentMin: 30 })} canEdit onTaskUpdated={vi.fn()} />,
    );

    expect(screen.getByTestId("task-timer-estimate")).toHaveTextContent("1h");
    expect(screen.getByTestId("task-timer-progress")).toHaveTextContent("50%");
  });

  it("hides progress when estimatedMin is 0", () => {
    render(<TaskTimer task={makeTask({ estimatedMin: 0 })} canEdit onTaskUpdated={vi.fn()} />);

    expect(screen.queryByTestId("task-timer-progress")).not.toBeInTheDocument();
  });

  it("shows a countdown (remaining time) instead of elapsed when an estimate is set", () => {
    render(<TaskTimer task={makeTask({ estimatedMin: 60, timeSpentMin: 10 })} canEdit onTaskUpdated={vi.fn()} />);

    expect(screen.getByTestId("task-timer-remaining")).toHaveTextContent("0:50:00");
    expect(screen.queryByTestId("task-timer-elapsed")).not.toBeInTheDocument();
  });

  it("shows plain count-up elapsed when there is no estimate", () => {
    render(<TaskTimer task={makeTask({ estimatedMin: 0, timeSpentMin: 10 })} canEdit onTaskUpdated={vi.fn()} />);

    expect(screen.getByTestId("task-timer-elapsed")).toHaveTextContent("0:10:00");
    expect(screen.queryByTestId("task-timer-remaining")).not.toBeInTheDocument();
  });

  it("counts the countdown down live while the timer is running", async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-08-29T12:00:00.000Z"));

    render(
      <TaskTimer
        task={makeTask({ estimatedMin: 60, timerStartedAt: "2026-08-29T12:00:00.000Z" })}
        canEdit
        onTaskUpdated={vi.fn()}
      />,
    );

    expect(screen.getByTestId("task-timer-remaining")).toHaveTextContent("1:00:00");

    await act(() => {
      vi.advanceTimersByTime(60_000);
    });

    expect(screen.getByTestId("task-timer-remaining")).toHaveTextContent("0:59:00");
  });

  it("colours the countdown normally under 75% of the estimate spent", () => {
    render(<TaskTimer task={makeTask({ estimatedMin: 100, timeSpentMin: 50 })} canEdit onTaskUpdated={vi.fn()} />);

    const remaining = screen.getByTestId("task-timer-remaining");
    expect(remaining.className).not.toMatch(/warning|destructive/);
  });

  it("colours the countdown as a warning between 75% and 100% of the estimate spent", () => {
    render(<TaskTimer task={makeTask({ estimatedMin: 100, timeSpentMin: 80 })} canEdit onTaskUpdated={vi.fn()} />);

    expect(screen.getByTestId("task-timer-remaining").className).toContain("warning");
  });

  it("shows an overrun (not a negative countdown) and urgent colour once the estimate is exceeded", () => {
    render(<TaskTimer task={makeTask({ estimatedMin: 60, timeSpentMin: 75 })} canEdit onTaskUpdated={vi.fn()} />);

    const remaining = screen.getByTestId("task-timer-remaining");
    expect(remaining.className).toContain("destructive");
    expect(remaining).toHaveTextContent("0:15:00");
    expect(remaining).not.toHaveTextContent("-");
    expect(screen.getByText(/просрочен/i)).toBeInTheDocument();
  });

  it("shows exactly 0:00:00 (not negative, not overrun-labelled) right when the estimate is fully spent", () => {
    render(<TaskTimer task={makeTask({ estimatedMin: 60, timeSpentMin: 60 })} canEdit onTaskUpdated={vi.fn()} />);

    const remaining = screen.getByTestId("task-timer-remaining");
    expect(remaining).toHaveTextContent("0:00:00");
    expect(remaining).not.toHaveTextContent("-");
  });

  it("accounts for workDayHours when computing the countdown", () => {
    vi.setSystemTime(new Date("2026-08-29T12:00:00.000Z"));

    render(
      <TaskTimer
        task={makeTask({ estimatedMin: 240, timerStartedAt: "2026-08-29T04:00:00.000Z" })}
        canEdit
        onTaskUpdated={vi.fn()}
        workDayHours={4}
      />,
    );

    // 8 calendar hours elapsed, but capped at a 4h workday, so only 4 hours
    // count as "spent" — same calendar-aware engine the Timer's elapsed
    // already uses (entities/task/working-elapsed.ts), just fed into the
    // countdown. A 240-minute (4h) estimate is therefore exactly used up.
    expect(screen.getByTestId("task-timer-remaining")).toHaveTextContent("0:00:00");
  });

  it("does not keep ticking state after switching to another task", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-08-29T12:00:00.000Z"));
    const onTaskUpdated = vi.fn();
    const { rerender } = render(
      <TaskTimer
        task={makeTask({ id: "t1", timerStartedAt: "2026-08-29T12:00:00.000Z" })}
        canEdit
        onTaskUpdated={onTaskUpdated}
      />,
    );

    rerender(
      <TaskTimer task={makeTask({ id: "t2", timeSpentMin: 4 })} canEdit onTaskUpdated={onTaskUpdated} />,
    );

    expect(screen.getByTestId("task-timer-state")).toHaveTextContent("Остановлен");
    expect(screen.getByTestId("task-timer-elapsed")).toHaveTextContent("0:04:00");
  });
});
