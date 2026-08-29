import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { ListCard } from "./list-card";
import type { DashboardListSummary } from "@/features/dashboard/dashboard-lists";

function makeSummary(overrides: Partial<DashboardListSummary>): DashboardListSummary {
  return {
    id: "l1",
    title: "Спринт 34",
    taskCount: 4,
    statusCounts: { new: 1, in_progress: 1, done: 2 },
    progress: 50,
    lastActivityAt: "2026-08-19T14:00:00.000Z",
    priority: 0,
    ...overrides,
  };
}

describe("ListCard", () => {
  it("links to the list's detail page", () => {
    render(<ListCard list={makeSummary({ id: "l42" })} />);
    expect(screen.getByTestId("list-card")).toHaveAttribute("href", "/lists/l42");
  });

  it("shows the list title", () => {
    render(<ListCard list={makeSummary({ title: "Личные дела" })} />);
    expect(screen.getByRole("heading", { name: "Личные дела" })).toBeInTheDocument();
  });

  it("shows the task count and per-status counts", () => {
    render(
      <ListCard
        list={makeSummary({ taskCount: 6, statusCounts: { new: 3, in_progress: 1, done: 2 } })}
      />
    );

    expect(screen.getByText("6")).toBeInTheDocument();
    expect(screen.getByTestId("status-count-new")).toHaveTextContent("3");
    expect(screen.getByTestId("status-count-in_progress")).toHaveTextContent("1");
    expect(screen.getByTestId("status-count-done")).toHaveTextContent("2");
  });

  it("renders a progress bar reflecting the completion percentage", () => {
    render(<ListCard list={makeSummary({ progress: 33 })} />);

    const progressbar = screen.getByRole("progressbar");
    expect(progressbar).toHaveAttribute("aria-valuenow", "33");
    expect(screen.getByText("33%")).toBeInTheDocument();
  });

  it("shows an empty state and a 0% progress bar with no NaN/Infinity when the list has no tasks", () => {
    render(
      <ListCard
        list={makeSummary({ taskCount: 0, statusCounts: { new: 0, in_progress: 0, done: 0 }, progress: 0 })}
      />
    );

    expect(screen.getByText("Нет задач")).toBeInTheDocument();
    const progressbar = screen.getByRole("progressbar");
    expect(progressbar).toHaveAttribute("aria-valuenow", "0");
    expect(screen.getByText("0%")).toBeInTheDocument();
    expect(screen.queryByText(/NaN/)).not.toBeInTheDocument();
    expect(screen.queryByText(/Infinity/)).not.toBeInTheDocument();
  });

  it("shows a placeholder when there is no recorded activity", () => {
    render(<ListCard list={makeSummary({ lastActivityAt: null })} />);
    expect(screen.getByText("Нет активности")).toBeInTheDocument();
  });
});
