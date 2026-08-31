import { fireEvent, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { format } from "date-fns";
import { ru } from "date-fns/locale";
import { describe, expect, it, vi } from "vitest";
import { fromDatetimeLocalValue, TaskFilters, toDatetimeLocalValue } from "./task-filters";
import { EMPTY_TASK_FILTER_CRITERIA } from "@/entities/saved-filter/query-schema";
import type { Task } from "@/entities/task/schema";

function makeTask(overrides: Partial<Task>): Task {
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

const TASKS = [
  makeTask({ id: "t1", category: "Backend", tags: ["urgent"] }),
  makeTask({ id: "t2", category: "Frontend", tags: ["docs"] }),
];

describe("TaskFilters", () => {
  it("shows the search input with the current draft value", () => {
    render(
      <TaskFilters
        tasks={TASKS}
        draft={{ ...EMPTY_TASK_FILTER_CRITERIA, search: "deploy" }}
        onDraftChange={vi.fn()}
        onApply={vi.fn()}
        onClear={vi.fn()}
      />,
    );
    expect(screen.getByTestId("task-filters-search")).toHaveValue("deploy");
  });

  it("calls onDraftChange with the updated search term while typing", async () => {
    const user = userEvent.setup();
    const onDraftChange = vi.fn();
    render(
      <TaskFilters tasks={TASKS} draft={EMPTY_TASK_FILTER_CRITERIA} onDraftChange={onDraftChange} onApply={vi.fn()} onClear={vi.fn()} />,
    );

    await user.type(screen.getByTestId("task-filters-search"), "x");
    expect(onDraftChange).toHaveBeenCalledWith({ ...EMPTY_TASK_FILTER_CRITERIA, search: "x" });
  });

  it("lists distinct categories derived from the visible tasks", async () => {
    const user = userEvent.setup();
    render(
      <TaskFilters tasks={TASKS} draft={EMPTY_TASK_FILTER_CRITERIA} onDraftChange={vi.fn()} onApply={vi.fn()} onClear={vi.fn()} />,
    );
    await user.click(screen.getByTestId("task-filters-category"));
    expect(await screen.findByRole("option", { name: "Backend" })).toBeInTheDocument();
    expect(screen.getByRole("option", { name: "Frontend" })).toBeInTheDocument();
  });

  it("toggles a status checkbox", async () => {
    const user = userEvent.setup();
    const onDraftChange = vi.fn();
    render(
      <TaskFilters tasks={TASKS} draft={EMPTY_TASK_FILTER_CRITERIA} onDraftChange={onDraftChange} onApply={vi.fn()} onClear={vi.fn()} />,
    );

    await user.click(screen.getByTestId("task-filters-status-done"));
    expect(onDraftChange).toHaveBeenCalledWith({ ...EMPTY_TASK_FILTER_CRITERIA, status: ["done"] });
  });

  it("toggles a tag checkbox derived from visible tasks", async () => {
    const user = userEvent.setup();
    const onDraftChange = vi.fn();
    render(
      <TaskFilters tasks={TASKS} draft={EMPTY_TASK_FILTER_CRITERIA} onDraftChange={onDraftChange} onApply={vi.fn()} onClear={vi.fn()} />,
    );

    await user.click(screen.getByTestId("task-filters-tag-urgent"));
    expect(onDraftChange).toHaveBeenCalledWith({ ...EMPTY_TASK_FILTER_CRITERIA, tags: ["urgent"] });
  });

  it("updates priorityMin from the min input", async () => {
    const user = userEvent.setup();
    const onDraftChange = vi.fn();
    render(
      <TaskFilters tasks={TASKS} draft={EMPTY_TASK_FILTER_CRITERIA} onDraftChange={onDraftChange} onApply={vi.fn()} onClear={vi.fn()} />,
    );

    await user.type(screen.getByTestId("task-filters-priority-min"), "3");
    expect(onDraftChange).toHaveBeenLastCalledWith({ ...EMPTY_TASK_FILTER_CRITERIA, priorityMin: 3 });
  });

  it("clamps an out-of-range priorityMin value to the valid 1-5 bound", async () => {
    const user = userEvent.setup();
    const onDraftChange = vi.fn();
    render(
      <TaskFilters tasks={TASKS} draft={EMPTY_TASK_FILTER_CRITERIA} onDraftChange={onDraftChange} onApply={vi.fn()} onClear={vi.fn()} />,
    );

    await user.type(screen.getByTestId("task-filters-priority-min"), "9");
    expect(onDraftChange).toHaveBeenLastCalledWith({ ...EMPTY_TASK_FILTER_CRITERIA, priorityMin: 5 });
  });

  it("clamps an out-of-range priorityMax value to the valid 1-5 bound", async () => {
    const user = userEvent.setup();
    const onDraftChange = vi.fn();
    render(
      <TaskFilters tasks={TASKS} draft={EMPTY_TASK_FILTER_CRITERIA} onDraftChange={onDraftChange} onApply={vi.fn()} onClear={vi.fn()} />,
    );

    await user.type(screen.getByTestId("task-filters-priority-max"), "0");
    expect(onDraftChange).toHaveBeenLastCalledWith({ ...EMPTY_TASK_FILTER_CRITERIA, priorityMax: 1 });
  });

  it("calls onApply when the Apply button is clicked", async () => {
    const user = userEvent.setup();
    const onApply = vi.fn();
    render(
      <TaskFilters tasks={TASKS} draft={EMPTY_TASK_FILTER_CRITERIA} onDraftChange={vi.fn()} onApply={onApply} onClear={vi.fn()} />,
    );

    await user.click(screen.getByTestId("task-filters-apply"));
    expect(onApply).toHaveBeenCalled();
  });

  it("calls onClear when the Clear button is clicked", async () => {
    const user = userEvent.setup();
    const onClear = vi.fn();
    render(
      <TaskFilters tasks={TASKS} draft={EMPTY_TASK_FILTER_CRITERIA} onDraftChange={vi.fn()} onApply={vi.fn()} onClear={onClear} />,
    );

    await user.click(screen.getByTestId("task-filters-clear"));
    expect(onClear).toHaveBeenCalled();
  });

  describe("deadline datetime-local round-trip (timezone regression)", () => {
    it("round-trips a datetime-local value through fromDatetimeLocalValue -> toDatetimeLocalValue unchanged, regardless of the runner's timezone", () => {
      // Whatever offset fromDatetimeLocalValue applies converting local -> UTC,
      // toDatetimeLocalValue must apply the exact inverse converting UTC -> local,
      // so this composition is timezone-independent by construction.
      const typed = "2026-09-15T14:30";
      const iso = fromDatetimeLocalValue(typed);
      expect(iso).not.toBeNull();
      expect(toDatetimeLocalValue(iso)).toBe(typed);
    });

    it("keeps the displayed deadlineFrom value stable across repeated round-trips (no drift on re-render)", () => {
      const typed = "2026-01-01T00:05";
      const firstIso = fromDatetimeLocalValue(typed);
      const firstDisplay = toDatetimeLocalValue(firstIso);
      const secondIso = fromDatetimeLocalValue(firstDisplay);
      const secondDisplay = toDatetimeLocalValue(secondIso);
      expect(secondDisplay).toBe(firstDisplay);
      expect(secondIso).toBe(firstIso);
    });

    it("renders the deadlineFrom input with the round-tripped value after setting it via the draft", async () => {
      const user = userEvent.setup();
      const onDraftChange = vi.fn();
      const { rerender } = render(
        <TaskFilters tasks={TASKS} draft={EMPTY_TASK_FILTER_CRITERIA} onDraftChange={onDraftChange} onApply={vi.fn()} onClear={vi.fn()} />,
      );

      await user.click(screen.getByTestId("task-filters-deadline-from"));
      const day = new Date();
      day.setDate(15);
      day.setHours(0, 0, 0, 0);
      const dayButton = document.querySelector(`[data-day="${day.toLocaleDateString("ru")}"]`);
      expect(dayButton).toBeTruthy();
      await user.click(dayButton as HTMLElement);

      const afterDaySelect = onDraftChange.mock.calls[onDraftChange.mock.calls.length - 1][0];
      expect(afterDaySelect.deadlineFrom).not.toBeNull();

      rerender(
        <TaskFilters
          tasks={TASKS}
          draft={{ ...EMPTY_TASK_FILTER_CRITERIA, deadlineFrom: afterDaySelect.deadlineFrom }}
          onDraftChange={onDraftChange}
          onApply={vi.fn()}
          onClear={vi.fn()}
        />,
      );

      fireEvent.change(screen.getByLabelText("Время"), { target: { value: "14:30" } });

      const lastCall = onDraftChange.mock.calls[onDraftChange.mock.calls.length - 1][0];
      expect(lastCall.deadlineFrom).not.toBeNull();

      rerender(
        <TaskFilters
          tasks={TASKS}
          draft={{ ...EMPTY_TASK_FILTER_CRITERIA, deadlineFrom: lastCall.deadlineFrom }}
          onDraftChange={onDraftChange}
          onApply={vi.fn()}
          onClear={vi.fn()}
        />,
      );

      const expected = new Date(day);
      expected.setHours(14, 30, 0, 0);
      expect(screen.getByTestId("task-filters-deadline-from")).toHaveTextContent(
        format(expected, "d MMM yyyy, HH:mm", { locale: ru }),
      );
    });
  });
});
