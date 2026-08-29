import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { TaskRow } from "./task-row";
import type { Task } from "@/entities/task/schema";

function makeTask(overrides: Partial<Task>): Task {
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

const NOW = new Date("2026-08-27T12:00:00.000Z");

describe("TaskRow", () => {
  it("shows the task code and title", () => {
    render(<TaskRow task={makeTask({ code: "TEST-7", title: "Настроить CI" })} dependencyCodes={[]} now={NOW} />);

    expect(screen.getByText("TEST-7")).toBeInTheDocument();
    expect(screen.getByText("Настроить CI")).toBeInTheDocument();
  });

  it("shows the task status", () => {
    render(<TaskRow task={makeTask({ status: "in_progress" })} dependencyCodes={[]} now={NOW} />);
    expect(screen.getByTestId("task-status")).toHaveTextContent("В работе");
  });

  it("shows the task priority", () => {
    render(<TaskRow task={makeTask({ priority: 5 })} dependencyCodes={[]} now={NOW} />);
    expect(screen.getByTestId("task-priority")).toHaveTextContent("5");
  });

  it("shows the formatted deadline", () => {
    render(<TaskRow task={makeTask({ deadline: "2026-09-01T00:00:00.000Z" })} dependencyCodes={[]} now={NOW} />);
    expect(screen.getByTestId("task-deadline")).not.toHaveTextContent("Без дедлайна");
  });

  it("shows a placeholder when there is no deadline", () => {
    render(<TaskRow task={makeTask({ deadline: null })} dependencyCodes={[]} now={NOW} />);
    expect(screen.getByTestId("task-deadline")).toHaveTextContent("Без дедлайна");
  });

  it("shows the category when present", () => {
    render(<TaskRow task={makeTask({ category: "Backend" })} dependencyCodes={[]} now={NOW} />);
    expect(screen.getByText("Backend")).toBeInTheDocument();
  });

  it("renders no category badge when category is null", () => {
    render(<TaskRow task={makeTask({ category: null })} dependencyCodes={[]} now={NOW} />);
    expect(screen.queryByTestId("task-category")).not.toBeInTheDocument();
  });

  it("shows tags", () => {
    render(<TaskRow task={makeTask({ tags: ["urgent", "backend"] })} dependencyCodes={[]} now={NOW} />);
    expect(screen.getByText("#urgent")).toBeInTheDocument();
    expect(screen.getByText("#backend")).toBeInTheDocument();
  });

  it("indicates an overdue task", () => {
    const task = makeTask({ deadline: "2026-08-01T00:00:00.000Z", status: "in_progress" });
    render(<TaskRow task={task} dependencyCodes={[]} now={NOW} />);
    expect(screen.getByTestId("task-overdue-badge")).toBeInTheDocument();
  });

  it("does not indicate overdue for a done task past its deadline", () => {
    const task = makeTask({ deadline: "2026-08-01T00:00:00.000Z", status: "done" });
    render(<TaskRow task={task} dependencyCodes={[]} now={NOW} />);
    expect(screen.queryByTestId("task-overdue-badge")).not.toBeInTheDocument();
  });

  it("does not indicate overdue for a task with a future deadline", () => {
    const task = makeTask({ deadline: "2026-09-01T00:00:00.000Z", status: "in_progress" });
    render(<TaskRow task={task} dependencyCodes={[]} now={NOW} />);
    expect(screen.queryByTestId("task-overdue-badge")).not.toBeInTheDocument();
  });

  it("visually indicates a completed task", () => {
    render(<TaskRow task={makeTask({ status: "done", title: "Готовая задача" })} dependencyCodes={[]} now={NOW} />);
    expect(screen.getByText("Готовая задача")).toHaveClass("line-through");
  });

  it("shows resolved dependency codes when the task depends on others", () => {
    const task = makeTask({ dependsOn: ["t2", "t3"] });
    render(<TaskRow task={task} dependencyCodes={["TEST-2", "TEST-3"]} now={NOW} />);
    expect(screen.getByTestId("task-dependencies")).toHaveTextContent("TEST-2");
    expect(screen.getByTestId("task-dependencies")).toHaveTextContent("TEST-3");
  });

  it("shows no dependency indication when the task has no dependencies", () => {
    render(<TaskRow task={makeTask({ dependsOn: [] })} dependencyCodes={[]} now={NOW} />);
    expect(screen.queryByTestId("task-dependencies")).not.toBeInTheDocument();
  });

  it("calls onOpen with the task when clicked", async () => {
    const user = userEvent.setup();
    const onOpen = vi.fn();
    const task = makeTask({ id: "t9" });
    render(<TaskRow task={task} dependencyCodes={[]} now={NOW} onOpen={onOpen} />);

    await user.click(screen.getByTestId("task-row"));

    expect(onOpen).toHaveBeenCalledWith(task);
  });

  it("does not render a clickable trigger when onOpen is not provided", () => {
    render(<TaskRow task={makeTask({})} dependencyCodes={[]} now={NOW} />);
    expect(screen.queryByRole("button")).not.toBeInTheDocument();
  });
});

describe("TaskRow highlighting", () => {
  it("highlights a matching substring in the title when searchQuery is set", () => {
    render(
      <TaskRow
        task={makeTask({ title: "Написать тесты" })}
        dependencyCodes={[]}
        now={NOW}
        searchQuery="тесты"
      />,
    );
    expect(screen.getByText("тесты", { selector: "mark" })).toBeInTheDocument();
  });

  it("does not render a mark element when searchQuery is not set", () => {
    render(<TaskRow task={makeTask({ title: "Написать тесты" })} dependencyCodes={[]} now={NOW} />);
    expect(document.querySelector("mark")).not.toBeInTheDocument();
  });

  it("highlights a matching tag", () => {
    render(<TaskRow task={makeTask({ tags: ["urgent"] })} dependencyCodes={[]} now={NOW} searchQuery="urg" />);
    expect(screen.getByText("urg", { selector: "mark" })).toBeInTheDocument();
  });
});
