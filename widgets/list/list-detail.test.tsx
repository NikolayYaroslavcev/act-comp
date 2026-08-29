import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";
import { ListDetail } from "./list-detail";
import { downloadBlob } from "@/shared/lib/export/download";
import type { TaskList } from "@/entities/list/schema";
import type { Task } from "@/entities/task/schema";

vi.mock("@/shared/lib/export/download", () => ({
  downloadBlob: vi.fn(),
}));

function makeList(overrides: Partial<TaskList>): TaskList {
  return {
    id: "l1",
    ownerId: "u1",
    title: "Спринт 34",
    template: "work",
    taskIds: [],
    deadline: null,
    sharedWith: [],
    history: [],
    deletedAt: null,
    lastActivityAt: "2026-08-01T00:00:00.000Z",
    ...overrides,
  };
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

describe("ListDetail", () => {
  it("shows the list title and template", () => {
    render(<ListDetail list={makeList({ title: "Личные дела", template: "personal" })} tasks={[]} currentUserId="u1" now={NOW} />);

    expect(screen.getByRole("heading", { name: "Личные дела" })).toBeInTheDocument();
    expect(screen.getByText("Личное")).toBeInTheDocument();
  });

  it("shows the task count and progress", () => {
    const tasks = [makeTask({ id: "t1", status: "done" }), makeTask({ id: "t2", status: "new" })];
    render(<ListDetail list={makeList({})} tasks={tasks} currentUserId="u1" now={NOW} />);

    expect(screen.getByTestId("list-task-count")).toHaveTextContent("2");
    expect(screen.getByText("50%")).toBeInTheDocument();
  });

  it("renders the task list for the list's tasks", () => {
    const tasks = [makeTask({ id: "t1", title: "First task" })];
    render(<ListDetail list={makeList({})} tasks={tasks} currentUserId="u1" now={NOW} />);

    expect(screen.getByText("First task")).toBeInTheDocument();
  });

  it("shows the empty state when the list has no active tasks", () => {
    render(<ListDetail list={makeList({})} tasks={[]} currentUserId="u1" now={NOW} />);
    expect(screen.getByTestId("task-list-empty-state")).toBeInTheDocument();
  });

  it("labels the owner as owner", () => {
    render(<ListDetail list={makeList({ ownerId: "u1" })} tasks={[]} currentUserId="u1" now={NOW} />);
    expect(screen.getByTestId("list-access-badge")).toHaveTextContent("Владелец");
  });

  it("labels a shared read-only viewer accordingly", () => {
    const list = makeList({ ownerId: "u1", sharedWith: [{ userId: "u2", access: "read" }] });
    render(<ListDetail list={list} tasks={[]} currentUserId="u2" now={NOW} />);
    expect(screen.getByTestId("list-access-badge")).toHaveTextContent("Только чтение");
  });

  it("labels a shared editor accordingly", () => {
    const list = makeList({ ownerId: "u1", sharedWith: [{ userId: "u2", access: "edit" }] });
    render(<ListDetail list={list} tasks={[]} currentUserId="u2" now={NOW} />);
    expect(screen.getByTestId("list-access-badge")).toHaveTextContent("Редактирование");
  });

  it("shows the list deadline when set", () => {
    render(<ListDetail list={makeList({ deadline: "2026-09-01T00:00:00.000Z" })} tasks={[]} currentUserId="u1" now={NOW} />);
    expect(screen.queryByText("Без дедлайна")).not.toBeInTheDocument();
  });

  it("shows a placeholder when the list has no deadline", () => {
    render(<ListDetail list={makeList({ deadline: null })} tasks={[]} currentUserId="u1" now={NOW} />);
    expect(screen.getByText("Без дедлайна")).toBeInTheDocument();
  });

  it("shows export actions for the current list", () => {
    render(<ListDetail list={makeList({})} tasks={[]} currentUserId="u1" now={NOW} />);
    expect(screen.getByTestId("list-export-csv")).toBeInTheDocument();
    expect(screen.getByTestId("list-export-pdf")).toBeInTheDocument();
  });
});

describe("ListDetail task edit permissions", () => {
  it("lets the owner edit a task", async () => {
    const user = userEvent.setup();
    const tasks = [makeTask({ id: "t1" })];
    render(<ListDetail list={makeList({ ownerId: "u1" })} tasks={tasks} currentUserId="u1" now={NOW} />);

    await user.click(screen.getByTestId("task-row"));

    expect(screen.getByTestId("task-detail-edit")).toBeInTheDocument();
  });

  it("lets a shared editor edit a task", async () => {
    const user = userEvent.setup();
    const tasks = [makeTask({ id: "t1" })];
    const list = makeList({ ownerId: "u1", sharedWith: [{ userId: "u2", access: "edit" }] });
    render(<ListDetail list={list} tasks={tasks} currentUserId="u2" now={NOW} />);

    await user.click(screen.getByTestId("task-row"));

    expect(screen.getByTestId("task-detail-edit")).toBeInTheDocument();
  });

  it("does not let a shared read-only viewer edit a task", async () => {
    const user = userEvent.setup();
    const tasks = [makeTask({ id: "t1" })];
    const list = makeList({ ownerId: "u1", sharedWith: [{ userId: "u2", access: "read" }] });
    render(<ListDetail list={list} tasks={tasks} currentUserId="u2" now={NOW} />);

    await user.click(screen.getByTestId("task-row"));

    expect(screen.queryByTestId("task-detail-edit")).not.toBeInTheDocument();
  });
});

describe("ListDetail export of the current filtered view", () => {
  afterEach(() => {
    vi.mocked(downloadBlob).mockReset();
    vi.unstubAllGlobals();
  });

  it("exports only tasks that match the applied search", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async (url: string) => {
        if (url.startsWith("/api/saved-filters")) {
          return new Response(JSON.stringify({ data: { recent: [], saved: [] } }), {
            status: 200,
            headers: { "content-type": "application/json" },
          });
        }
        return new Response(null, { status: 404 });
      }),
    );
    const user = userEvent.setup();
    const tasks = [
      makeTask({ id: "t1", title: "backend api" }),
      makeTask({ id: "t2", title: "frontend ui" }),
    ];
    render(<ListDetail list={makeList({})} tasks={tasks} currentUserId="u1" now={NOW} />);

    await user.type(screen.getByTestId("task-filters-search"), "backend");
    await user.click(screen.getByTestId("task-filters-apply"));
    await user.click(screen.getByTestId("list-export-csv"));

    const text = await vi.mocked(downloadBlob).mock.calls[0][0].text();
    expect(text).toContain("backend api");
    expect(text).not.toContain("frontend ui");
  });
});
