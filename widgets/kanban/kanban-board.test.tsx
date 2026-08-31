import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";
import { KanbanBoard } from "./kanban-board";
import { chooseSelectOption } from "@/shared/test/ui";
import type { Task } from "@/entities/task/schema";

function jsonResponse(status: number, body: unknown) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json" },
  });
}

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

const NOW = new Date("2026-08-27T12:00:00.000Z");

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("KanbanBoard", () => {
  it("renders a column for every status, including empty ones", () => {
    render(
      <KanbanBoard
        tasks={[makeTask({ id: "t1", status: "new", title: "Only new" })]}
        lookupTasks={[makeTask({ id: "t1", status: "new", title: "Only new" })]}
        now={NOW}
      />,
    );

    expect(screen.getByTestId("kanban-column-new")).toBeInTheDocument();
    expect(screen.getByTestId("kanban-column-in_progress")).toBeInTheDocument();
    expect(screen.getByTestId("kanban-column-done")).toBeInTheDocument();
    expect(within(screen.getByTestId("kanban-column-in_progress")).queryByTestId("kanban-card")).not.toBeInTheDocument();
  });

  it("places cards into the column that matches their status", () => {
    const tasks = [
      makeTask({ id: "t1", code: "A-1", title: "Todo", status: "new" }),
      makeTask({ id: "t2", code: "A-2", title: "Doing", status: "in_progress" }),
      makeTask({ id: "t3", code: "A-3", title: "Finished", status: "done" }),
    ];
    render(<KanbanBoard tasks={tasks} lookupTasks={tasks} now={NOW} />);

    expect(within(screen.getByTestId("kanban-column-new")).getByText("Todo")).toBeInTheDocument();
    expect(within(screen.getByTestId("kanban-column-in_progress")).getByText("Doing")).toBeInTheDocument();
    expect(within(screen.getByTestId("kanban-column-done")).getByText("Finished")).toBeInTheDocument();
  });

  it("shows code, priority, deadline, and status on a card", () => {
    render(
      <KanbanBoard
        tasks={[
          makeTask({
            code: "TEST-9",
            title: "Ship it",
            priority: 5,
            deadline: "2026-09-01T00:00:00.000Z",
            status: "new",
          }),
        ]}
        lookupTasks={[
          makeTask({
            code: "TEST-9",
            title: "Ship it",
            priority: 5,
            deadline: "2026-09-01T00:00:00.000Z",
            status: "new",
          }),
        ]}
        now={NOW}
      />,
    );

    const card = screen.getByTestId("kanban-card");
    expect(card).toHaveTextContent("TEST-9");
    expect(card).toHaveTextContent("Ship it");
    expect(within(card).getByTestId("task-priority")).toHaveTextContent("5");
    expect(within(card).getByTestId("task-deadline")).not.toHaveTextContent("Без дедлайна");
    expect(within(card).getByTestId("task-status")).toHaveTextContent("Новая");
  });

  it("marks a blocked task when a live dependency is not done", () => {
    const blocker = makeTask({ id: "t1", code: "B-1", status: "new" });
    const blocked = makeTask({ id: "t2", code: "B-2", title: "Waiting", status: "new", dependsOn: ["t1"] });
    render(<KanbanBoard tasks={[blocker, blocked]} lookupTasks={[blocker, blocked]} now={NOW} />);

    const waitingCard = screen.getByText("Waiting").closest('[data-testid="kanban-card"]');
    expect(waitingCard).toBeInstanceOf(HTMLElement);
    expect(within(waitingCard as HTMLElement).getByTestId("kanban-card-blocked")).toBeInTheDocument();
  });

  it("does not mark a task as blocked once its dependency is done", () => {
    const blocker = makeTask({ id: "t1", code: "B-1", status: "done" });
    const waiting = makeTask({ id: "t2", code: "B-2", title: "Waiting", status: "new", dependsOn: ["t1"] });
    render(<KanbanBoard tasks={[blocker, waiting]} lookupTasks={[blocker, waiting]} now={NOW} />);

    const waitingCard = screen.getByText("Waiting").closest('[data-testid="kanban-card"]');
    expect(waitingCard).toBeInstanceOf(HTMLElement);
    expect(within(waitingCard as HTMLElement).queryByTestId("kanban-card-blocked")).not.toBeInTheDocument();
  });

  it("visually distinguishes a completed task", () => {
    render(
      <KanbanBoard
        tasks={[makeTask({ id: "t1", title: "Done item", status: "done" })]}
        lookupTasks={[makeTask({ id: "t1", title: "Done item", status: "done" })]}
        now={NOW}
      />,
    );

    expect(screen.getByTestId("kanban-card")).toHaveAttribute("data-completed", "true");
  });

  it("does not render a soft-deleted task even if it is passed in", () => {
    render(
      <KanbanBoard
        tasks={[
          makeTask({ id: "t1", title: "Alive" }),
          makeTask({ id: "t2", title: "Gone", deletedAt: "2026-08-01T00:00:00.000Z" }),
        ]}
        lookupTasks={[
          makeTask({ id: "t1", title: "Alive" }),
          makeTask({ id: "t2", title: "Gone", deletedAt: "2026-08-01T00:00:00.000Z" }),
        ]}
        now={NOW}
      />,
    );

    expect(screen.getByText("Alive")).toBeInTheDocument();
    expect(screen.queryByText("Gone")).not.toBeInTheDocument();
  });

  it("opens the task via onOpen when the card is activated", async () => {
    const user = userEvent.setup();
    const onOpen = vi.fn();
    const task = makeTask({ id: "t1", title: "Open me" });
    render(<KanbanBoard tasks={[task]} lookupTasks={[task]} now={NOW} onOpen={onOpen} />);

    await user.click(screen.getByTestId("kanban-card-open"));
    expect(onOpen).toHaveBeenCalledWith(task);
  });

  it("hides drag and status controls when the viewer cannot edit", () => {
    const task = makeTask({ id: "t1" });
    render(<KanbanBoard tasks={[task]} lookupTasks={[task]} now={NOW} canEdit={false} />);

    expect(screen.queryByTestId("kanban-drag-handle")).not.toBeInTheDocument();
    expect(screen.queryByTestId("kanban-status-select")).not.toBeInTheDocument();
  });

  it("PATCHes status from the alternative select control", async () => {
    const user = userEvent.setup();
    const updated = makeTask({ id: "t1", status: "in_progress", title: "Task" });
    const fetchMock = vi.fn().mockResolvedValue(jsonResponse(200, { data: { task: updated, cascade: [] } }));
    vi.stubGlobal("fetch", fetchMock);
    const onTaskUpdated = vi.fn();
    const task = makeTask({ id: "t1", status: "new" });

    render(
      <KanbanBoard
        tasks={[task]}
        lookupTasks={[task]}
        now={NOW}
        canEdit
        onTaskUpdated={onTaskUpdated}
      />,
    );

    await chooseSelectOption(user, screen.getByTestId("kanban-status-select"), "В работе");

    expect(fetchMock).toHaveBeenCalledWith(
      "/api/tasks/t1",
      expect.objectContaining({ method: "PATCH", body: JSON.stringify({ status: "in_progress" }) }),
    );
    await waitFor(() => expect(onTaskUpdated).toHaveBeenCalledWith(updated));
  });

  it("moves the card into the target column optimistically while the PATCH is in flight", async () => {
    const user = userEvent.setup();
    let resolveFetch: (value: Response) => void = () => {};
    vi.stubGlobal(
      "fetch",
      vi.fn().mockReturnValue(new Promise<Response>((resolve) => (resolveFetch = resolve))),
    );
    const task = makeTask({ id: "t1", title: "Moving", status: "new" });

    render(<KanbanBoard tasks={[task]} lookupTasks={[task]} now={NOW} canEdit />);

    await chooseSelectOption(user, screen.getByTestId("kanban-status-select"), "Готово");

    expect(within(screen.getByTestId("kanban-column-done")).getByText("Moving")).toBeInTheDocument();
    expect(within(screen.getByTestId("kanban-column-new")).queryByText("Moving")).not.toBeInTheDocument();

    resolveFetch(jsonResponse(200, { data: { task: { ...task, status: "done" }, cascade: [] } }));
  });

  it("rolls back only the failed card after a 403", async () => {
    const user = userEvent.setup();
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(jsonResponse(403, { error: { message: "Forbidden" } })));
    const task = makeTask({ id: "t1", title: "Stay", status: "new" });

    render(<KanbanBoard tasks={[task]} lookupTasks={[task]} now={NOW} canEdit />);

    await chooseSelectOption(user, screen.getByTestId("kanban-status-select"), "Готово");

    await waitFor(() => expect(screen.getByRole("alert")).toHaveTextContent("У вас нет прав на редактирование этой задачи"));
    expect(within(screen.getByTestId("kanban-column-new")).getByText("Stay")).toBeInTheDocument();
  });

  it("recomputes blocked state from lookup tasks when a dependency's status is overridden", async () => {
    const user = userEvent.setup();
    vi.stubGlobal(
      "fetch",
      vi.fn().mockReturnValue(new Promise<Response>(() => {})),
    );
    const blocker = makeTask({ id: "t1", code: "B-1", title: "Blocker", status: "new" });
    const waiting = makeTask({ id: "t2", code: "B-2", title: "Waiting", status: "new", dependsOn: ["t1"] });

    render(<KanbanBoard tasks={[blocker, waiting]} lookupTasks={[blocker, waiting]} now={NOW} canEdit />);

    expect(screen.getByTestId("kanban-card-blocked")).toBeInTheDocument();

    const blockerCard = screen.getByText("Blocker").closest('[data-testid="kanban-card"]');
    expect(blockerCard).toBeInstanceOf(HTMLElement);
    await chooseSelectOption(user, within(blockerCard as HTMLElement).getByTestId("kanban-status-select"), "Готово");

    expect(screen.queryByTestId("kanban-card-blocked")).not.toBeInTheDocument();
  });

  it("disables the drag handle for a task blocked by an unfinished dependency", () => {
    const blocker = makeTask({ id: "t1", code: "B-1", status: "new" });
    const blocked = makeTask({ id: "t2", code: "B-2", title: "Waiting", status: "new", dependsOn: ["t1"] });
    render(<KanbanBoard tasks={[blocker, blocked]} lookupTasks={[blocker, blocked]} now={NOW} canEdit />);

    const waitingCard = screen.getByText("Waiting").closest('[data-testid="kanban-card"]') as HTMLElement;
    expect(within(waitingCard).getByTestId("kanban-drag-handle")).toHaveAttribute("aria-disabled", "true");
  });

  it("keeps the drag handle enabled for an unblocked task", () => {
    const task = makeTask({ id: "t1", title: "Free" });
    render(<KanbanBoard tasks={[task]} lookupTasks={[task]} now={NOW} canEdit />);

    expect(screen.getByTestId("kanban-drag-handle")).toHaveAttribute("aria-disabled", "false");
  });

  it("re-enables the drag handle once the blocking dependency is completed", async () => {
    const user = userEvent.setup();
    vi.stubGlobal("fetch", vi.fn().mockReturnValue(new Promise<Response>(() => {})));
    const blocker = makeTask({ id: "t1", code: "B-1", title: "Blocker", status: "new" });
    const waiting = makeTask({ id: "t2", code: "B-2", title: "Waiting", status: "new", dependsOn: ["t1"] });

    render(<KanbanBoard tasks={[blocker, waiting]} lookupTasks={[blocker, waiting]} now={NOW} canEdit />);

    const waitingCard = screen.getByText("Waiting").closest('[data-testid="kanban-card"]') as HTMLElement;
    expect(within(waitingCard).getByTestId("kanban-drag-handle")).toHaveAttribute("aria-disabled", "true");

    const blockerCard = screen.getByText("Blocker").closest('[data-testid="kanban-card"]') as HTMLElement;
    await chooseSelectOption(user, within(blockerCard).getByTestId("kanban-status-select"), "Готово");

    expect(within(waitingCard).getByTestId("kanban-drag-handle")).toHaveAttribute("aria-disabled", "false");
  });

  it("keeps the drag handle disabled when at least one of several dependencies is unfinished", () => {
    const doneDep = makeTask({ id: "t1", code: "B-1", status: "done" });
    const openDep = makeTask({ id: "t2", code: "B-2", status: "in_progress" });
    const blocked = makeTask({
      id: "t3",
      code: "B-3",
      title: "Waiting on two",
      status: "new",
      dependsOn: ["t1", "t2"],
    });
    render(
      <KanbanBoard tasks={[doneDep, openDep, blocked]} lookupTasks={[doneDep, openDep, blocked]} now={NOW} canEdit />,
    );

    const waitingCard = screen.getByText("Waiting on two").closest('[data-testid="kanban-card"]') as HTMLElement;
    expect(within(waitingCard).getByTestId("kanban-drag-handle")).toHaveAttribute("aria-disabled", "true");
  });

  it("does not treat a soft-deleted dependency as blocking", () => {
    const deletedDep = makeTask({ id: "t1", code: "B-1", status: "new", deletedAt: "2026-08-01T00:00:00.000Z" });
    const task = makeTask({ id: "t2", code: "B-2", title: "Not blocked", status: "new", dependsOn: ["t1"] });
    render(<KanbanBoard tasks={[task]} lookupTasks={[deletedDep, task]} now={NOW} canEdit />);

    const card = screen.getByText("Not blocked").closest('[data-testid="kanban-card"]') as HTMLElement;
    expect(within(card).queryByTestId("kanban-card-blocked")).not.toBeInTheDocument();
    expect(within(card).getByTestId("kanban-drag-handle")).toHaveAttribute("aria-disabled", "false");
  });

  it("keeps an unblocked completed task's drag handle enabled as before", () => {
    const task = makeTask({ id: "t1", title: "Done item", status: "done" });
    render(<KanbanBoard tasks={[task]} lookupTasks={[task]} now={NOW} canEdit />);

    expect(screen.getByTestId("kanban-drag-handle")).toHaveAttribute("aria-disabled", "false");
  });

  it("highlights the applied search term on the card", () => {
    const task = makeTask({ title: "Написать тесты" });
    render(<KanbanBoard tasks={[task]} lookupTasks={[task]} now={NOW} searchQuery="тесты" />);

    expect(screen.getByText("тесты", { selector: "mark" })).toBeInTheDocument();
  });

  it("shows an empty-state placeholder in a column with no tasks", () => {
    const task = makeTask({ id: "t1", status: "new", title: "Only new" });
    render(<KanbanBoard tasks={[task]} lookupTasks={[task]} now={NOW} />);

    expect(within(screen.getByTestId("kanban-column-in_progress")).getByTestId("kanban-column-empty")).toBeInTheDocument();
    expect(within(screen.getByTestId("kanban-column-new")).queryByTestId("kanban-column-empty")).not.toBeInTheDocument();
  });

  it("shows a loading indicator while a status change is in flight", async () => {
    const user = userEvent.setup();
    vi.stubGlobal(
      "fetch",
      vi.fn().mockReturnValue(new Promise<Response>(() => {})),
    );
    const task = makeTask({ id: "t1", title: "Moving", status: "new" });
    render(<KanbanBoard tasks={[task]} lookupTasks={[task]} now={NOW} canEdit />);

    expect(screen.queryByTestId("kanban-board-loading")).not.toBeInTheDocument();

    await chooseSelectOption(user, screen.getByTestId("kanban-status-select"), "Готово");

    expect(screen.getByTestId("kanban-board-loading")).toBeInTheDocument();
  });

  it("shows an aggregate error indicator when a status update fails, without duplicating the card's own alert", async () => {
    const user = userEvent.setup();
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(jsonResponse(403, { error: { message: "Forbidden" } })));
    const task = makeTask({ id: "t1", title: "Stay", status: "new" });
    render(<KanbanBoard tasks={[task]} lookupTasks={[task]} now={NOW} canEdit />);

    await chooseSelectOption(user, screen.getByTestId("kanban-status-select"), "Готово");

    await waitFor(() => expect(screen.getByTestId("kanban-board-error")).toBeInTheDocument());
    expect(screen.getAllByRole("alert")).toHaveLength(1);
  });
});
