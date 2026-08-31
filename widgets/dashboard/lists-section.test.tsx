import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it } from "vitest";
import { ListsSection } from "./lists-section";
import type { DashboardListSummary } from "@/features/dashboard/dashboard-lists";

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

describe("ListsSection", () => {
  it("renders one card per list", () => {
    render(
      <ListsSection
        lists={[
          makeSummary({ id: "l1", title: "Спринт 34" }),
          makeSummary({ id: "l2", title: "Личные дела" }),
          makeSummary({ id: "l3", title: "Проект Феникс" }),
        ]}
      />
    );

    expect(screen.getAllByTestId("list-card")).toHaveLength(3);
    expect(screen.getByRole("heading", { name: "Спринт 34" })).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Личные дела" })).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Проект Феникс" })).toBeInTheDocument();
    expect(screen.queryByTestId("dashboard-lists-pagination")).not.toBeInTheDocument();
  });

  it("paginates when there are more lists than one page", async () => {
    const user = userEvent.setup();
    const lists = Array.from({ length: 10 }, (_, index) =>
      makeSummary({ id: `l${index + 1}`, title: `Список ${index + 1}` }),
    );
    render(<ListsSection lists={lists} />);

    expect(screen.getAllByTestId("list-card")).toHaveLength(9);
    expect(screen.queryByRole("heading", { name: "Список 10" })).not.toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "Следующая страница" }));

    expect(screen.getAllByTestId("list-card")).toHaveLength(1);
    expect(screen.getByRole("heading", { name: "Список 10" })).toBeInTheDocument();
  });

  it("shows an empty state when the user has no visible lists", () => {
    render(<ListsSection lists={[]} />);

    expect(screen.queryByTestId("list-card")).not.toBeInTheDocument();
    expect(screen.getByText(/пока нет списков/i)).toBeInTheDocument();
  });

  it("shows a distinct empty state when search/filters produce no matches, instead of the no-lists message", () => {
    render(<ListsSection lists={[]} isFiltered />);

    expect(screen.queryByTestId("list-card")).not.toBeInTheDocument();
    expect(screen.getByTestId("lists-empty-filtered")).toBeInTheDocument();
    expect(screen.queryByText(/пока нет списков/i)).not.toBeInTheDocument();
  });

  it("passes the delete action through to each card that can be deleted", () => {
    render(<ListsSection lists={[makeSummary({ id: "l1", canDelete: true, title: "Спринт 34" })]} />);

    expect(screen.getByRole("button", { name: "Удалить список «Спринт 34»" })).toBeInTheDocument();
  });

  it("passes the edit action through to each card that can be edited", () => {
    render(<ListsSection lists={[makeSummary({ id: "l1", canEdit: true, title: "Спринт 34" })]} />);

    expect(screen.getByRole("button", { name: "Редактировать список «Спринт 34»" })).toBeInTheDocument();
  });
});
