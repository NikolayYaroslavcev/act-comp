import { screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { TaskList } from "./task-list";
import { EMPTY_TASK_FILTER_CRITERIA } from "@/entities/saved-filter/query-schema";
import type { Task } from "@/entities/task/schema";
import { chooseSelectOption } from "@/shared/test/ui";
import { renderWithStore as render } from "@/shared/store/test-utils";

function jsonResponse(status: number, body: unknown) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json" },
  });
}

// The detail dialog's TaskComments section fetches `/api/tasks/:id/comments`
// on its own as soon as it opens. A Response body can only be read once, so
// routing that unrelated background request to its own fresh response (
// rather than the single canned Response these tests stub for the task
// mutation under test) keeps it from starving the mutation's own read.
//
// TaskComments and the task PATCH mutation call fetchFn(request) with a
// single Request object rather than fetch(url, init) — normalize both
// shapes to a URL string before routing.
function urlOf(arg: unknown): string {
  return arg instanceof Request ? arg.url : String(arg);
}

function stubFetchForTaskAction(handler: (url: string, init?: RequestInit) => Promise<Response> | Response) {
  const fetchMock = vi.fn((input: string | Request, init?: RequestInit) => {
    const url = urlOf(input);
    if (url.endsWith("/comments") || url.endsWith("/activity")) {
      return Promise.resolve(jsonResponse(200, { data: [] }));
    }
    if (url.startsWith("/api/saved-filters")) {
      return Promise.resolve(jsonResponse(200, { data: { recent: [], saved: [] } }));
    }
    return handler(url, init);
  });
  vi.stubGlobal("fetch", fetchMock);
  return fetchMock;
}

afterEach(() => {
  vi.unstubAllGlobals();
});

beforeEach(() => {
  stubFetchForTaskAction(() => jsonResponse(200, { data: { recent: [], saved: [] } }));
});

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

describe("TaskList", () => {
  it("renders one row per task", () => {
    render(
      <TaskList
        tasks={[
          makeTask({ id: "t1", code: "TEST-1", title: "First" }),
          makeTask({ id: "t2", code: "TEST-2", title: "Second" }),
        ]}
        now={NOW}
      />,
    );

    expect(screen.getAllByTestId("task-row")).toHaveLength(2);
    expect(screen.getByText("First")).toBeInTheDocument();
    expect(screen.getByText("Second")).toBeInTheDocument();
    expect(screen.queryByTestId("task-list-pagination")).not.toBeInTheDocument();
  });

  it("paginates long lists and moves to the next page", async () => {
    const user = userEvent.setup();
    const tasks = Array.from({ length: 11 }, (_, index) =>
      makeTask({ id: `t${index + 1}`, code: `TEST-${index + 1}`, title: `Task ${index + 1}` }),
    );
    render(<TaskList tasks={tasks} now={NOW} />);

    expect(screen.getAllByTestId("task-row")).toHaveLength(10);
    expect(screen.queryByText("Task 11", { exact: true })).not.toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "Следующая страница" }));

    expect(screen.getAllByTestId("task-row")).toHaveLength(1);
    expect(screen.getByText("Task 11", { exact: true })).toBeInTheDocument();
  });

  it("returns to the first page when filters are applied", async () => {
    const user = userEvent.setup();
    const tasks = Array.from({ length: 11 }, (_, index) =>
      makeTask({ id: `t${index + 1}`, code: `TEST-${index + 1}`, title: `Task ${index + 1}` }),
    );
    render(<TaskList tasks={tasks} now={NOW} />);

    await user.click(screen.getByRole("button", { name: "Следующая страница" }));
    await user.type(screen.getByTestId("task-filters-search"), "Task");
    await user.click(screen.getByTestId("task-filters-apply"));

    const rows = screen.getAllByTestId("task-row");
    expect(rows).toHaveLength(10);
    expect(rows[0]).toHaveTextContent("TEST-1");
    expect(screen.queryByText("TEST-11")).not.toBeInTheDocument();
  });

  it("shows an empty state when there are no tasks", () => {
    render(<TaskList tasks={[]} now={NOW} />);

    expect(screen.queryByTestId("task-row")).not.toBeInTheDocument();
    expect(screen.getByTestId("task-list-empty-state")).toBeInTheDocument();
  });

  it("resolves dependency ids to task codes from the same list", () => {
    render(
      <TaskList
        tasks={[
          makeTask({ id: "t1", code: "TEST-1", title: "Blocker" }),
          makeTask({ id: "t2", code: "TEST-2", title: "Blocked", dependsOn: ["t1"] }),
        ]}
        now={NOW}
      />,
    );

    expect(screen.getByTestId("task-dependencies")).toHaveTextContent("TEST-1");
  });

  it("silently drops dependency ids that don't resolve to a visible task", () => {
    render(
      <TaskList
        tasks={[makeTask({ id: "t2", code: "TEST-2", title: "Blocked", dependsOn: ["missing"] })]}
        now={NOW}
      />,
    );

    expect(screen.queryByTestId("task-dependencies")).not.toBeInTheDocument();
  });

  it("opens the task detail dialog for the clicked task", async () => {
    const user = userEvent.setup();
    render(
      <TaskList
        tasks={[
          makeTask({ id: "t1", code: "TEST-1", title: "First" }),
          makeTask({ id: "t2", code: "TEST-2", title: "Second" }),
        ]}
        now={NOW}
      />,
    );

    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();

    await user.click(screen.getAllByTestId("task-row")[1]);

    const dialog = screen.getByRole("dialog");
    expect(dialog).toHaveTextContent("TEST-2");
    expect(dialog).toHaveTextContent("Second");
    expect(dialog).not.toHaveTextContent("First");
  });

  it("closes the task detail dialog when close is clicked", async () => {
    const user = userEvent.setup();
    render(<TaskList tasks={[makeTask({ id: "t1", code: "TEST-1", title: "First" })]} now={NOW} />);

    await user.click(screen.getByTestId("task-row"));
    expect(screen.getByRole("dialog")).toBeInTheDocument();

    await user.click(screen.getByTestId("dialog-close"));
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  });

  it("shows the resolved parent task code in the detail dialog", async () => {
    const user = userEvent.setup();
    render(
      <TaskList
        tasks={[
          makeTask({ id: "t1", code: "TEST-1", title: "Parent" }),
          makeTask({ id: "t2", code: "TEST-2", title: "Child", parentId: "t1" }),
        ]}
        now={NOW}
      />,
    );

    await user.click(screen.getAllByTestId("task-row")[1]);

    expect(screen.getByTestId("task-detail-parent")).toHaveTextContent("TEST-1");
  });

  it("shows the parent's title alongside its code in the detail dialog", async () => {
    const user = userEvent.setup();
    render(
      <TaskList
        tasks={[
          makeTask({ id: "t1", code: "TEST-1", title: "Родитель" }),
          makeTask({ id: "t2", code: "TEST-2", title: "Child", parentId: "t1" }),
        ]}
        now={NOW}
      />,
    );

    await user.click(screen.getAllByTestId("task-row")[1]);

    expect(screen.getByTestId("task-detail-parent")).toHaveTextContent("Родитель");
  });

  it("shows the active subtask list and progress for a parent task opened from the list", async () => {
    const user = userEvent.setup();
    render(
      <TaskList
        tasks={[
          makeTask({ id: "t1", code: "TEST-1", title: "Parent", subtaskIds: ["t2", "t3"] }),
          makeTask({ id: "t2", code: "TEST-2", title: "Sub A", parentId: "t1", status: "done" }),
          makeTask({ id: "t3", code: "TEST-3", title: "Sub B", parentId: "t1", status: "new" }),
        ]}
        now={NOW}
      />,
    );

    await user.click(screen.getAllByTestId("task-row")[0]);

    expect(screen.getByTestId("task-detail-subtask-progress")).toHaveTextContent("1 / 2");
    const rows = screen.getAllByTestId("task-detail-subtask-row");
    expect(rows).toHaveLength(2);
    expect(rows[0]).toHaveTextContent("TEST-2");
    expect(rows[1]).toHaveTextContent("TEST-3");
  });
});

describe("TaskList edit permissions", () => {
  it("does not show the Edit button in the detail dialog when canEdit is not provided", async () => {
    const user = userEvent.setup();
    render(<TaskList tasks={[makeTask({ id: "t1" })]} now={NOW} />);

    await user.click(screen.getByTestId("task-row"));

    expect(screen.queryByTestId("task-detail-edit")).not.toBeInTheDocument();
  });

  it("shows the Edit button in the detail dialog when canEdit is true", async () => {
    const user = userEvent.setup();
    render(<TaskList tasks={[makeTask({ id: "t1" })]} now={NOW} canEdit />);

    await user.click(screen.getByTestId("task-row"));

    expect(screen.getByTestId("task-detail-edit")).toBeInTheDocument();
  });

  it("lets an editor inline-edit the task title from the list detail dialog", async () => {
    const user = userEvent.setup();
    render(<TaskList tasks={[makeTask({ id: "t1", title: "Из списка" })]} now={NOW} canEdit />);

    await user.click(screen.getByTestId("task-row"));

    expect(screen.getByRole("textbox", { name: "Название" })).toHaveValue("Из списка");
  });

  it("does not show inline editors in the list detail dialog for shared-read", async () => {
    const user = userEvent.setup();
    render(<TaskList tasks={[makeTask({ id: "t1", title: "Из списка" })]} now={NOW} />);

    await user.click(screen.getByTestId("task-row"));

    expect(screen.queryByRole("textbox", { name: "Название" })).not.toBeInTheDocument();
    expect(screen.getByRole("dialog")).toHaveTextContent("Из списка");
  });

  it("offers other tasks in the same list as dependency options in edit mode", async () => {
    const user = userEvent.setup();
    render(
      <TaskList
        tasks={[makeTask({ id: "t1", code: "TEST-1" }), makeTask({ id: "t2", code: "TEST-2", title: "Other" })]}
        now={NOW}
        canEdit
      />,
    );

    await user.click(screen.getAllByTestId("task-row")[0]);
    await user.click(screen.getByTestId("task-detail-edit"));

    expect(screen.getByRole("checkbox", { name: /TEST-2/ })).toBeInTheDocument();
  });
});

describe("TaskList reflecting a saved edit", () => {
  it("updates the task row and the reopened detail dialog after a successful save", async () => {
    const user = userEvent.setup();
    const updatedTask = makeTask({ id: "t1", code: "TEST-1", title: "Новое имя" });
    stubFetchForTaskAction(() => jsonResponse(200, { data: { task: updatedTask, cascade: [] } }));
    render(<TaskList tasks={[makeTask({ id: "t1", code: "TEST-1", title: "Старое имя" })]} now={NOW} canEdit />);

    await user.click(screen.getByTestId("task-row"));
    await user.click(screen.getByTestId("task-detail-edit"));
    await user.clear(screen.getByLabelText("Название"));
    await user.type(screen.getByLabelText("Название"), "Новое имя");
    await user.click(screen.getByTestId("task-edit-save"));

    await waitFor(() => expect(screen.queryByTestId("task-edit-form")).not.toBeInTheDocument());
    await user.click(screen.getByTestId("dialog-close"));

    expect(screen.getByText("Новое имя")).toBeInTheDocument();
    expect(screen.queryByText("Старое имя")).not.toBeInTheDocument();
  });
});

describe("TaskList reflecting a clone", () => {
  it("adds the cloned task to the list without removing the original", async () => {
    const user = userEvent.setup();
    const clonedTask = makeTask({ id: "t2", code: "TEST-2", title: "Написать тесты (копия)" });
    stubFetchForTaskAction(() => jsonResponse(201, { data: clonedTask }));
    render(
      <TaskList
        tasks={[makeTask({ id: "t1", code: "TEST-1", title: "Написать тесты" })]}
        now={NOW}
        canEdit
      />,
    );

    await user.click(screen.getByTestId("task-row"));
    await user.click(screen.getByTestId("task-detail-clone"));

    await waitFor(() => expect(screen.queryByRole("dialog")).not.toBeInTheDocument());

    const rows = screen.getAllByTestId("task-row");
    expect(rows).toHaveLength(2);
    expect(screen.getByText("Написать тесты")).toBeInTheDocument();
    expect(screen.getByText("Написать тесты (копия)")).toBeInTheDocument();
  });

  it("keeps dependency codes resolvable after a clone adds a new task", async () => {
    const user = userEvent.setup();
    const clonedTask = makeTask({ id: "t3", code: "TEST-3", title: "Clone" });
    stubFetchForTaskAction(() => jsonResponse(201, { data: clonedTask }));
    render(
      <TaskList
        tasks={[
          makeTask({ id: "t1", code: "TEST-1", title: "Blocker" }),
          makeTask({ id: "t2", code: "TEST-2", title: "Blocked", dependsOn: ["t1"] }),
        ]}
        now={NOW}
        canEdit
      />,
    );

    await user.click(screen.getAllByTestId("task-row")[0]);
    await user.click(screen.getByTestId("task-detail-clone"));
    await waitFor(() => expect(screen.queryByRole("dialog")).not.toBeInTheDocument());

    expect(screen.getByTestId("task-dependencies")).toHaveTextContent("TEST-1");
  });

  it("does not show the Clone button for a read-only user", async () => {
    const user = userEvent.setup();
    render(<TaskList tasks={[makeTask({ id: "t1" })]} now={NOW} />);

    await user.click(screen.getByTestId("task-row"));

    expect(screen.queryByTestId("task-detail-clone")).not.toBeInTheDocument();
  });
});

describe("TaskList search and filters", () => {
  it("filters visible rows by search text after Apply", async () => {
    const user = userEvent.setup();
    render(
      <TaskList
        tasks={[
          makeTask({ id: "t1", code: "TEST-1", title: "Deploy service" }),
          makeTask({ id: "t2", code: "TEST-2", title: "Write docs" }),
        ]}
        now={NOW}
      />,
    );

    await user.type(screen.getByTestId("task-filters-search"), "deploy");
    await user.click(screen.getByTestId("task-filters-apply"));

    expect(screen.getAllByTestId("task-row")).toHaveLength(1);
    expect(screen.queryByText("Write docs")).not.toBeInTheDocument();
  });

  it("highlights the applied search term in the visible rows", async () => {
    const user = userEvent.setup();
    render(<TaskList tasks={[makeTask({ id: "t1", title: "Написать тесты" })]} now={NOW} />);

    await user.type(screen.getByTestId("task-filters-search"), "тесты");
    await user.click(screen.getByTestId("task-filters-apply"));

    expect(screen.getByText("тесты", { selector: "mark" })).toBeInTheDocument();
  });

  it("shows a dedicated empty state when filters match nothing, distinct from the no-tasks state", async () => {
    const user = userEvent.setup();
    render(<TaskList tasks={[makeTask({ id: "t1", title: "Alpha" })]} now={NOW} />);

    await user.type(screen.getByTestId("task-filters-search"), "zzz");
    await user.click(screen.getByTestId("task-filters-apply"));

    expect(screen.getByTestId("task-list-no-results")).toBeInTheDocument();
    expect(screen.queryByTestId("task-list-empty-state")).not.toBeInTheDocument();
  });

  it("clear restores every task and resets the search input", async () => {
    const user = userEvent.setup();
    render(
      <TaskList
        tasks={[makeTask({ id: "t1", title: "Alpha" }), makeTask({ id: "t2", title: "Beta" })]}
        now={NOW}
      />,
    );

    await user.type(screen.getByTestId("task-filters-search"), "alpha");
    await user.click(screen.getByTestId("task-filters-apply"));
    expect(screen.getAllByTestId("task-row")).toHaveLength(1);

    await user.click(screen.getByTestId("task-filters-clear"));

    expect(screen.getAllByTestId("task-row")).toHaveLength(2);
    expect(screen.getByTestId("task-filters-search")).toHaveValue("");
  });

  it("applies a saved filter from the saved list and updates the visible rows", async () => {
    const savedFilter = {
      id: "s1",
      userId: "u1",
      scope: "tasks" as const,
      usedAt: "2026-08-01T00:00:00.000Z",
      query: { ...EMPTY_TASK_FILTER_CRITERIA, search: "deploy", saved: true, label: "Deploys" },
    };
    vi.stubGlobal(
      "fetch",
      vi.fn(async (input: string | Request, init?: RequestInit) => {
        const url = urlOf(input);
        if (url.startsWith("/api/saved-filters") && init?.method === "POST") {
          return jsonResponse(200, { data: savedFilter });
        }
        if (url.startsWith("/api/saved-filters")) {
          return jsonResponse(200, { data: { recent: [], saved: [savedFilter] } });
        }
        return jsonResponse(404, {});
      }),
    );
    const user = userEvent.setup();
    render(
      <TaskList
        tasks={[
          makeTask({ id: "t1", code: "TEST-1", title: "Deploy service" }),
          makeTask({ id: "t2", code: "TEST-2", title: "Write docs" }),
        ]}
        now={NOW}
      />,
    );

    await user.click(await screen.findByTestId("saved-filter-apply-s1"));

    expect(screen.getAllByTestId("task-row")).toHaveLength(1);
    expect(screen.queryByText("Write docs")).not.toBeInTheDocument();
    expect(screen.getByTestId("task-filters-search")).toHaveValue("deploy");
    expect(screen.getByTestId("saved-filters-saved")).toBeInTheDocument();
  });

  it("shows the no-results state when a saved status filter matches nothing", async () => {
    const savedFilter = {
      id: "s-new",
      userId: "u1",
      scope: "tasks" as const,
      usedAt: "2026-08-01T00:00:00.000Z",
      query: { ...EMPTY_TASK_FILTER_CRITERIA, status: ["new"], saved: true, label: "Новые" },
    };
    vi.stubGlobal(
      "fetch",
      vi.fn(async (input: string | Request, init?: RequestInit) => {
        const url = urlOf(input);
        if (url.startsWith("/api/saved-filters") && init?.method === "POST") {
          return jsonResponse(200, { data: savedFilter });
        }
        if (url.startsWith("/api/saved-filters")) {
          return jsonResponse(200, { data: { recent: [], saved: [savedFilter] } });
        }
        return jsonResponse(404, {});
      }),
    );
    const user = userEvent.setup();
    render(
      <TaskList
        tasks={[
          makeTask({ id: "t10", title: "Собрать команду", status: "done" }),
          makeTask({ id: "t11", title: "Подготовить бюджет", status: "in_progress" }),
        ]}
        now={NOW}
      />,
    );

    await user.click(await screen.findByTestId("saved-filter-apply-s-new"));

    expect(screen.getByTestId("task-list-no-results")).toBeInTheDocument();
    expect(screen.getByTestId("task-filters-status-new")).toBeChecked();
  });

  it("still opens the correct task detail after filtering", async () => {
    const user = userEvent.setup();
    render(
      <TaskList
        tasks={[
          makeTask({ id: "t1", code: "TEST-1", title: "Deploy service" }),
          makeTask({ id: "t2", code: "TEST-2", title: "Write docs" }),
        ]}
        now={NOW}
      />,
    );

    await user.type(screen.getByTestId("task-filters-search"), "deploy");
    await user.click(screen.getByTestId("task-filters-apply"));
    await user.click(screen.getByTestId("task-row"));

    const dialog = screen.getByRole("dialog");
    expect(dialog).toHaveTextContent("TEST-1");
    expect(dialog).toHaveTextContent("Deploy service");
  });
});

describe("TaskList Kanban view", () => {
  it("keeps the list view by default and switches to Kanban on demand", async () => {
    const user = userEvent.setup();
    render(<TaskList tasks={[makeTask({ id: "t1", title: "First" })]} now={NOW} />);

    expect(screen.getByTestId("task-list")).toBeInTheDocument();
    expect(screen.queryByTestId("kanban-board")).not.toBeInTheDocument();

    await user.click(screen.getByTestId("task-view-kanban"));

    expect(await screen.findByTestId("kanban-board")).toBeInTheDocument();
    expect(screen.queryByTestId("task-list")).not.toBeInTheDocument();
    expect(screen.getByText("First")).toBeInTheDocument();
  });

  it("applies search filters to Kanban cards", async () => {
    const user = userEvent.setup();
    render(
      <TaskList
        tasks={[
          makeTask({ id: "t1", title: "Deploy service" }),
          makeTask({ id: "t2", title: "Write docs" }),
        ]}
        now={NOW}
      />,
    );

    await user.click(screen.getByTestId("task-view-kanban"));
    await user.type(screen.getByTestId("task-filters-search"), "deploy");
    await user.click(screen.getByTestId("task-filters-apply"));

    expect(await screen.findByTestId("kanban-card")).toHaveTextContent("Deploy service");
    expect(screen.queryByText("Write docs")).not.toBeInTheDocument();
  });

  it("opens the existing task detail from a Kanban card", async () => {
    const user = userEvent.setup();
    render(<TaskList tasks={[makeTask({ id: "t1", code: "TEST-1", title: "First" })]} now={NOW} />);

    await user.click(screen.getByTestId("task-view-kanban"));
    await user.click(await screen.findByTestId("kanban-card-open"));

    const dialog = screen.getByRole("dialog");
    expect(dialog).toHaveTextContent("TEST-1");
    expect(dialog).toHaveTextContent("First");
  });

  it("reflects a Kanban status change in the list view without reload", async () => {
    const user = userEvent.setup();
    const updated = makeTask({ id: "t1", code: "TEST-1", title: "Task", status: "in_progress" });
    stubFetchForTaskAction(() => jsonResponse(200, { data: { task: updated, cascade: [] } }));
    render(<TaskList tasks={[makeTask({ id: "t1", code: "TEST-1", title: "Task", status: "new" })]} now={NOW} canEdit />);

    await user.click(screen.getByTestId("task-view-kanban"));
    expect(await screen.findByTestId("kanban-status-select")).toBeInTheDocument();
    await chooseSelectOption(user, screen.getByTestId("kanban-status-select"), "В работе");
    await waitFor(() => expect(screen.getByTestId("task-status")).toHaveTextContent("В работе"));

    await user.click(screen.getByTestId("task-view-list"));
    expect(screen.getByTestId("task-status")).toHaveTextContent("В работе");
  });
});
