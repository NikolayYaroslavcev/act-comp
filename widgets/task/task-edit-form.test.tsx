import { fireEvent, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { TaskEditForm } from "./task-edit-form";
import type { Task } from "@/entities/task/schema";

function makeTask(overrides: Partial<Task>): Task {
  return {
    id: "t1",
    listId: "l1",
    code: "TEST-1",
    title: "Написать тесты",
    description: "Покрыть модель тестами",
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

describe("TaskEditForm initial values", () => {
  it("pre-fills fields with the current task's values", () => {
    render(
      <TaskEditForm
        task={makeTask({ title: "Заголовок", description: "Описание", priority: 4, category: "Backend", tags: ["a", "b"], estimatedMin: 90 })}
        listTasks={[]}
        isPending={false}
        onSubmit={vi.fn()}
        onCancel={vi.fn()}
      />,
    );

    expect(screen.getByLabelText("Название")).toHaveValue("Заголовок");
    expect(screen.getByLabelText("Описание")).toHaveValue("Описание");
    expect(screen.getByLabelText("Приоритет")).toHaveValue(4);
    expect(screen.getByLabelText("Категория")).toHaveValue("Backend");
    expect(screen.getByLabelText(/Теги/)).toHaveValue("a, b");
    expect(screen.getByLabelText(/Оценка времени/)).toHaveValue(90);
  });

  it("shows an empty category and tags field when the task has none", () => {
    render(
      <TaskEditForm task={makeTask({ category: null, tags: [] })} listTasks={[]} isPending={false} onSubmit={vi.fn()} onCancel={vi.fn()} />,
    );

    expect(screen.getByLabelText("Категория")).toHaveValue("");
    expect(screen.getByLabelText(/Теги/)).toHaveValue("");
  });

  it("does not offer the task itself as a dependency or parent option", () => {
    const self = makeTask({ id: "t1", code: "TEST-1" });
    const other = makeTask({ id: "t2", code: "TEST-2" });
    render(<TaskEditForm task={self} listTasks={[self, other]} isPending={false} onSubmit={vi.fn()} onCancel={vi.fn()} />);

    expect(screen.queryByRole("checkbox", { name: /TEST-1/ })).not.toBeInTheDocument();
    expect(screen.getByRole("checkbox", { name: /TEST-2/ })).toBeInTheDocument();
    expect(screen.getByLabelText("Родительская задача")).not.toHaveTextContent("TEST-1");
  });

  it("does not offer deleted tasks as a dependency or parent option", () => {
    const self = makeTask({ id: "t1", code: "TEST-1" });
    const deleted = makeTask({ id: "t3", code: "TEST-3", deletedAt: "2026-08-10T00:00:00.000Z" });
    render(<TaskEditForm task={self} listTasks={[self, deleted]} isPending={false} onSubmit={vi.fn()} onCancel={vi.fn()} />);

    expect(screen.queryByLabelText(/TEST-3/)).not.toBeInTheDocument();
  });
});

describe("TaskEditForm validation", () => {
  it("shows a required error for an empty title and does not submit", async () => {
    const user = userEvent.setup();
    const onSubmit = vi.fn();
    render(<TaskEditForm task={makeTask({})} listTasks={[]} isPending={false} onSubmit={onSubmit} onCancel={vi.fn()} />);

    await user.clear(screen.getByLabelText("Название"));
    await user.click(screen.getByTestId("task-edit-save"));

    expect(await screen.findAllByRole("alert")).not.toHaveLength(0);
    expect(onSubmit).not.toHaveBeenCalled();
  });

  it("shows an error for an out-of-range priority and does not submit", async () => {
    const user = userEvent.setup();
    const onSubmit = vi.fn();
    render(<TaskEditForm task={makeTask({})} listTasks={[]} isPending={false} onSubmit={onSubmit} onCancel={vi.fn()} />);

    const priorityInput = screen.getByLabelText("Приоритет");
    await user.clear(priorityInput);
    await user.type(priorityInput, "9");
    await user.click(screen.getByTestId("task-edit-save"));

    expect(await screen.findAllByRole("alert")).not.toHaveLength(0);
    expect(onSubmit).not.toHaveBeenCalled();
  });

  it("shows an error for a negative estimatedMin and does not submit", async () => {
    const user = userEvent.setup();
    const onSubmit = vi.fn();
    render(<TaskEditForm task={makeTask({})} listTasks={[]} isPending={false} onSubmit={onSubmit} onCancel={vi.fn()} />);

    const estimatedInput = screen.getByLabelText(/Оценка времени/);
    await user.clear(estimatedInput);
    await user.type(estimatedInput, "-5");
    await user.click(screen.getByTestId("task-edit-save"));

    expect(await screen.findAllByRole("alert")).not.toHaveLength(0);
    expect(onSubmit).not.toHaveBeenCalled();
  });

});

describe("TaskEditForm submit", () => {
  it("submits only the changed field when a single field is edited", async () => {
    const user = userEvent.setup();
    const onSubmit = vi.fn();
    render(<TaskEditForm task={makeTask({ title: "Старое название" })} listTasks={[]} isPending={false} onSubmit={onSubmit} onCancel={vi.fn()} />);

    await user.clear(screen.getByLabelText("Название"));
    await user.type(screen.getByLabelText("Название"), "Новое название");
    await user.click(screen.getByTestId("task-edit-save"));

    expect(onSubmit).toHaveBeenCalledWith({ title: "Новое название" });
  });

  it("converts the tags text into a trimmed array on submit", async () => {
    const user = userEvent.setup();
    const onSubmit = vi.fn();
    render(<TaskEditForm task={makeTask({ tags: ["a"] })} listTasks={[]} isPending={false} onSubmit={onSubmit} onCancel={vi.fn()} />);

    const tagsInput = screen.getByLabelText(/Теги/);
    await user.clear(tagsInput);
    await user.type(tagsInput, "urgent,  backend ,urgent");
    await user.click(screen.getByTestId("task-edit-save"));

    expect(onSubmit).toHaveBeenCalledWith({ tags: ["urgent", "backend", "urgent"] });
  });

  it("submits a null deadline when the date field is cleared", async () => {
    const user = userEvent.setup();
    const onSubmit = vi.fn();
    render(
      <TaskEditForm task={makeTask({ deadline: "2026-09-01T00:00:00.000Z" })} listTasks={[]} isPending={false} onSubmit={onSubmit} onCancel={vi.fn()} />,
    );

    fireEvent.change(screen.getByLabelText("Дедлайн"), { target: { value: "" } });
    await user.click(screen.getByTestId("task-edit-save"));

    expect(onSubmit).toHaveBeenCalledWith({ deadline: null });
  });

  it("submits null instead of calling the API when nothing changed", async () => {
    const user = userEvent.setup();
    const onSubmit = vi.fn();
    render(<TaskEditForm task={makeTask({})} listTasks={[]} isPending={false} onSubmit={onSubmit} onCancel={vi.fn()} />);

    await user.click(screen.getByTestId("task-edit-save"));

    expect(onSubmit).toHaveBeenCalledWith(null);
  });

  it("toggles a dependency checkbox and submits the updated dependsOn array", async () => {
    const user = userEvent.setup();
    const onSubmit = vi.fn();
    const self = makeTask({ id: "t1", code: "TEST-1" });
    const other = makeTask({ id: "t2", code: "TEST-2", title: "Other task" });
    render(<TaskEditForm task={self} listTasks={[self, other]} isPending={false} onSubmit={onSubmit} onCancel={vi.fn()} />);

    await user.click(screen.getByRole("checkbox", { name: /TEST-2/ }));
    await user.click(screen.getByTestId("task-edit-save"));

    expect(onSubmit).toHaveBeenCalledWith({ dependsOn: ["t2"] });
  });

  it("disables the save button while pending", () => {
    render(<TaskEditForm task={makeTask({})} listTasks={[]} isPending onSubmit={vi.fn()} onCancel={vi.fn()} />);

    expect(screen.getByTestId("task-edit-save")).toBeDisabled();
  });
});

describe("TaskEditForm cancel", () => {
  it("calls onCancel and does not submit when cancel is clicked", async () => {
    const user = userEvent.setup();
    const onSubmit = vi.fn();
    const onCancel = vi.fn();
    render(<TaskEditForm task={makeTask({})} listTasks={[]} isPending={false} onSubmit={onSubmit} onCancel={onCancel} />);

    await user.clear(screen.getByLabelText("Название"));
    await user.type(screen.getByLabelText("Название"), "Другое");
    await user.click(screen.getByTestId("task-edit-cancel"));

    expect(onCancel).toHaveBeenCalled();
    expect(onSubmit).not.toHaveBeenCalled();
  });
});
