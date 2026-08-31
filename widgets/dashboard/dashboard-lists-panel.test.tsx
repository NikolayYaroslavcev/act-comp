import { act, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { DashboardListsPanel } from "./dashboard-lists-panel";
import type { DashboardListSummary, DeletedListSummary } from "@/features/dashboard/dashboard-lists";
import type { TaskList } from "@/entities/list/schema";

function makeSummary(overrides: Partial<DashboardListSummary>): DashboardListSummary {
  return {
    id: "l1",
    title: "List",
    template: "work",
    deadline: null,
    taskCount: 0,
    statusCounts: { new: 0, in_progress: 0, done: 0 },
    overdueCount: 0,
    progress: 0,
    urgency: "normal",
    isArchiveCandidate: false,
    lastActivityAt: null,
    priority: 0,
    canDelete: false,
    canEdit: false,
    ...overrides,
  };
}

function makeDeletedSummary(overrides: Partial<DeletedListSummary>): DeletedListSummary {
  return {
    id: "l4",
    title: "Deleted list",
    deletedAt: "2026-08-10T09:00:00.000Z",
    ...overrides,
  };
}

function makeCreatedList(overrides: Partial<TaskList>): TaskList {
  return {
    id: "l9",
    ownerId: "u1",
    title: "Brand new list",
    template: "personal",
    taskIds: [],
    deadline: null,
    sharedWith: [],
    history: [],
    deletedAt: null,
    lastActivityAt: "2026-08-29T00:00:00.000Z",
    ...overrides,
  };
}

function jsonResponse(status: number, body: unknown) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json" },
  });
}

// DashboardListsPanel now loads the "lists" scope saved filters on mount
// (features/dashboard/use-list-filters.ts + useSavedFilters). Routing that
// background request to its own fresh Response — rather than reusing the
// single canned Response a test stubs for the list mutation under test —
// matters because a Response body can only be read once (mirrors the same
// hazard documented in widgets/list/task-list.test.tsx).
function stubFetchForListAction(handler: (url: string) => Promise<Response> | Response) {
  const fetchMock = vi.fn(async (input: string | Request) => {
    const url = input instanceof Request ? input.url : String(input);
    if (url.includes("/api/saved-filters")) {
      return Promise.resolve(jsonResponse(200, { data: { recent: [], saved: [] } }));
    }
    return await handler(url);
  });
  vi.stubGlobal("fetch", fetchMock);
  return fetchMock;
}

beforeEach(() => {
  stubFetchForListAction(async () => await Promise.reject(new Error("Unexpected fetch in DashboardListsPanel test")));
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("DashboardListsPanel", () => {
  it("renders the existing lists plus the create-list CTA", () => {
    render(<DashboardListsPanel initialLists={[makeSummary({ id: "l1", title: "Спринт 34" })]} />);

    expect(screen.getByRole("button", { name: "Создать список" })).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Спринт 34" })).toBeInTheDocument();
  });

  it("adds the newly created list to the dashboard without a page reload", async () => {
    const user = userEvent.setup();
    const created = makeCreatedList({ id: "l9", title: "Brand new list" });
    stubFetchForListAction(() => jsonResponse(201, { data: created }));

    render(<DashboardListsPanel initialLists={[makeSummary({ id: "l1", title: "Спринт 34" })]} />);

    await user.click(screen.getByRole("button", { name: "Создать список" }));
    await user.type(screen.getByLabelText("Название"), "Brand new list");
    await user.click(screen.getByRole("button", { name: "Создать" }));

    await waitFor(() => expect(screen.getByRole("heading", { name: "Brand new list" })).toBeInTheDocument());
    expect(screen.getByRole("heading", { name: "Спринт 34" })).toBeInTheDocument();
    expect(screen.getAllByTestId("list-card")).toHaveLength(2);
  });

  it("removes a deleted list from the dashboard without a page reload, and surfaces it as restorable", async () => {
    const user = userEvent.setup();
    const deleted = makeCreatedList({
      id: "l1",
      title: "Спринт 34",
      deletedAt: "2026-08-29T12:00:00.000Z",
    });
    stubFetchForListAction(() => jsonResponse(200, { data: deleted }));

    render(
      <DashboardListsPanel
        initialLists={[
          makeSummary({ id: "l1", title: "Спринт 34", canDelete: true }),
          makeSummary({ id: "l2", title: "Личные дела", canDelete: false }),
        ]}
      />,
    );

    expect(screen.getAllByTestId("list-card")).toHaveLength(2);

    await user.click(screen.getByRole("button", { name: "Удалить список «Спринт 34»" }));
    await user.click(screen.getByRole("button", { name: "Удалить" }));

    await waitFor(() => expect(screen.getAllByTestId("list-card")).toHaveLength(1));
    expect(screen.queryByRole("heading", { name: "Спринт 34" })).not.toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Личные дела" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /восстановить/i })).toBeInTheDocument();
  });

  it("updates a card's title after a successful edit, without a page reload", async () => {
    const user = userEvent.setup();
    const updated = makeCreatedList({ id: "l1", title: "Обновлённое название" });
    stubFetchForListAction(() => jsonResponse(200, { data: updated }));

    render(
      <DashboardListsPanel
        initialLists={[makeSummary({ id: "l1", title: "Спринт 34", canEdit: true })]}
      />,
    );

    await user.click(screen.getByRole("button", { name: "Редактировать список «Спринт 34»" }));
    await user.click(screen.getByRole("button", { name: "Сохранить" }));

    await waitFor(() => expect(screen.getByRole("heading", { name: "Обновлённое название" })).toBeInTheDocument());
    expect(screen.queryByRole("heading", { name: "Спринт 34" })).not.toBeInTheDocument();
    expect(screen.getAllByTestId("list-card")).toHaveLength(1);
  });

  it("shows the updated values when the edit dialog is reopened after a save", async () => {
    const user = userEvent.setup();
    const updated = makeCreatedList({ id: "l1", title: "Спринт 35", template: "personal" });
    stubFetchForListAction(() => jsonResponse(200, { data: updated }));

    render(
      <DashboardListsPanel
        initialLists={[makeSummary({ id: "l1", title: "Спринт 34", template: "work", canEdit: true })]}
      />,
    );

    await user.click(screen.getByRole("button", { name: "Редактировать список «Спринт 34»" }));
    await user.click(screen.getByRole("button", { name: "Сохранить" }));
    await waitFor(() => expect(screen.getByRole("heading", { name: "Спринт 35" })).toBeInTheDocument());

    await user.click(screen.getByRole("button", { name: "Редактировать список «Спринт 35»" }));

    expect(screen.getByLabelText("Название")).toHaveValue("Спринт 35");
    expect(screen.getByLabelText("Шаблон")).toHaveTextContent("Личное");
  });

  it("moves a restored list back into the active dashboard lists", async () => {
    const user = userEvent.setup();
    const restored = makeCreatedList({ id: "l4", title: "Старый список" });
    stubFetchForListAction(() => jsonResponse(200, { data: restored }));

    render(
      <DashboardListsPanel
        initialLists={[makeSummary({ id: "l1", title: "Спринт 34" })]}
        initialDeletedLists={[makeDeletedSummary({ id: "l4", title: "Старый список" })]}
      />,
    );

    expect(screen.getByText("Старый список")).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: /восстановить/i }));

    await waitFor(() => expect(screen.getByRole("heading", { name: "Старый список" })).toBeInTheDocument());
    expect(screen.queryByRole("button", { name: /восстановить/i })).not.toBeInTheDocument();
    expect(screen.getAllByTestId("list-card")).toHaveLength(2);
  });
});

describe("DashboardListsPanel search and filters", () => {
  it("filters the visible lists by the debounced search term", async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    const user = userEvent.setup({ delay: null });
    render(
      <DashboardListsPanel
        initialLists={[
          makeSummary({ id: "l1", title: "Backend sprint" }),
          makeSummary({ id: "l2", title: "Личные дела" }),
        ]}
      />,
    );

    await user.type(screen.getByTestId("list-filters-search"), "backend");
    await act(() => {
      vi.advanceTimersByTime(400);
    });

    expect(screen.getByRole("heading", { name: "Backend sprint" })).toBeInTheDocument();
    expect(screen.queryByRole("heading", { name: "Личные дела" })).not.toBeInTheDocument();
    vi.useRealTimers();
  });

  it("shows the filtered-empty state (not the no-lists state) when a search matches nothing", async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    const user = userEvent.setup({ delay: null });
    render(<DashboardListsPanel initialLists={[makeSummary({ id: "l1", title: "Спринт 34" })]} />);

    await user.type(screen.getByTestId("list-filters-search"), "no-such-list");
    await act(() => {
      vi.advanceTimersByTime(400);
    });

    expect(screen.getByTestId("lists-empty-filtered")).toBeInTheDocument();
    vi.useRealTimers();
  });

  it("clear() restores every list and the default empty state", async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    const user = userEvent.setup({ delay: null });
    render(<DashboardListsPanel initialLists={[makeSummary({ id: "l1", title: "Спринт 34" })]} />);

    await user.type(screen.getByTestId("list-filters-search"), "no-such-list");
    await act(() => {
      vi.advanceTimersByTime(400);
    });
    expect(screen.getByTestId("lists-empty-filtered")).toBeInTheDocument();

    await user.click(screen.getByTestId("list-filters-clear"));

    expect(screen.getByRole("heading", { name: "Спринт 34" })).toBeInTheDocument();
    vi.useRealTimers();
  });

  it("filters by template via the checkboxes", async () => {
    const user = userEvent.setup();
    render(
      <DashboardListsPanel
        initialLists={[
          makeSummary({ id: "l1", title: "Work list", template: "work" }),
          makeSummary({ id: "l2", title: "Personal list", template: "personal" }),
        ]}
      />,
    );

    await user.click(screen.getByTestId("list-filters-template-work"));
    await user.click(screen.getByTestId("list-filters-apply"));

    expect(screen.getByRole("heading", { name: "Work list" })).toBeInTheDocument();
    expect(screen.queryByRole("heading", { name: "Personal list" })).not.toBeInTheDocument();
  });
});
