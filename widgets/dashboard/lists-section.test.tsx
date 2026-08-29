import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { ListsSection } from "./lists-section";
import type { DashboardListSummary } from "@/features/dashboard/dashboard-lists";

function makeSummary(overrides: Partial<DashboardListSummary>): DashboardListSummary {
  return {
    id: "l1",
    title: "List",
    taskCount: 0,
    statusCounts: { new: 0, in_progress: 0, done: 0 },
    progress: 0,
    lastActivityAt: null,
    priority: 0,
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
  });

  it("shows an empty state when the user has no visible lists", () => {
    render(<ListsSection lists={[]} />);

    expect(screen.queryByTestId("list-card")).not.toBeInTheDocument();
    expect(screen.getByText(/пока нет списков/i)).toBeInTheDocument();
  });
});
