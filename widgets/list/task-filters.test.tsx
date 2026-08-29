import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { TaskFilters } from "./task-filters";
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

  it("lists distinct categories derived from the visible tasks", () => {
    render(
      <TaskFilters tasks={TASKS} draft={EMPTY_TASK_FILTER_CRITERIA} onDraftChange={vi.fn()} onApply={vi.fn()} onClear={vi.fn()} />,
    );
    expect(screen.getByRole("option", { name: "Backend" })).toBeInTheDocument();
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
});
