import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { ListCard } from "./list-card";
import type { DashboardListSummary } from "@/features/dashboard/dashboard-lists";

function makeSummary(overrides: Partial<DashboardListSummary>): DashboardListSummary {
  return {
    id: "l1",
    title: "Спринт 34",
    template: "work",
    deadline: null,
    taskCount: 4,
    statusCounts: { new: 1, in_progress: 1, done: 2 },
    overdueCount: 0,
    progress: 50,
    urgency: "normal",
    isArchiveCandidate: false,
    lastActivityAt: "2026-08-19T14:00:00.000Z",
    priority: 0,
    canDelete: false,
    canEdit: false,
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

  it("shows a separate overdue count alongside the status counts when there are overdue tasks", () => {
    render(<ListCard list={makeSummary({ overdueCount: 2 })} />);
    expect(screen.getByTestId("status-count-overdue")).toHaveTextContent("2");
  });

  it("does not show an overdue count row when there are no overdue tasks", () => {
    render(<ListCard list={makeSummary({ overdueCount: 0 })} />);
    expect(screen.queryByTestId("status-count-overdue")).not.toBeInTheDocument();
  });
});

describe("ListCard urgency indicator", () => {
  it("shows no urgency badge for a normal list", () => {
    render(<ListCard list={makeSummary({ urgency: "normal" })} />);
    expect(screen.queryByTestId("list-urgency-badge")).not.toBeInTheDocument();
  });

  it("shows a warning-styled badge when the list is due soon", () => {
    render(<ListCard list={makeSummary({ urgency: "warning" })} />);
    const badge = screen.getByTestId("list-urgency-badge");
    expect(badge).toHaveTextContent("Скоро дедлайн");
    expect(badge.className).toContain("warning");
  });

  it("shows an urgent-styled badge when the list has overdue work", () => {
    render(<ListCard list={makeSummary({ urgency: "urgent" })} />);
    const badge = screen.getByTestId("list-urgency-badge");
    expect(badge).toHaveTextContent("Просрочено");
    expect(badge.className).toContain("destructive");
  });
});

describe("ListCard archive suggestion", () => {
  it("shows the archive suggestion for an owner-viewable archive-candidate list", () => {
    render(<ListCard list={makeSummary({ isArchiveCandidate: true, canDelete: true })} />);
    expect(screen.getByTestId("archive-suggestion-banner")).toBeInTheDocument();
  });

  it("does not show the archive suggestion for a non-candidate list", () => {
    render(<ListCard list={makeSummary({ isArchiveCandidate: false, canDelete: true })} />);
    expect(screen.queryByTestId("archive-suggestion-banner")).not.toBeInTheDocument();
  });

  it("does not show the archive suggestion to a viewer who cannot delete the list (shared, non-owner)", () => {
    render(<ListCard list={makeSummary({ isArchiveCandidate: true, canDelete: false })} />);
    expect(screen.queryByTestId("archive-suggestion-banner")).not.toBeInTheDocument();
  });
});

describe("ListCard delete action", () => {
  it("shows a delete action when the user can delete the list", () => {
    render(<ListCard list={makeSummary({ canDelete: true, title: "Спринт 34" })} />);
    expect(screen.getByRole("button", { name: "Удалить список «Спринт 34»" })).toBeInTheDocument();
  });

  it("hides the delete action when the user cannot delete the list", () => {
    render(<ListCard list={makeSummary({ canDelete: false, title: "Спринт 34" })} />);
    expect(screen.queryByRole("button", { name: /удалить список/i })).not.toBeInTheDocument();
  });

  it("keeps the delete trigger outside the card's link so it can never trigger navigation", () => {
    // The delete trigger opens a dialog portaled to document.body; React
    // bubbles portal content along the *component* tree, not the DOM tree.
    // Nesting the trigger inside the <Link> would let a click on it (or on
    // Cancel/Delete inside the dialog) bubble into the Link's navigation
    // handler, so it must render as a sibling instead.
    render(<ListCard list={makeSummary({ canDelete: true, title: "Спринт 34" })} />);

    const link = screen.getByTestId("list-card");
    const trigger = screen.getByRole("button", { name: "Удалить список «Спринт 34»" });
    expect(link).not.toContainElement(trigger);
  });
});

describe("ListCard edit action", () => {
  it("shows an edit action when the user can edit the list", () => {
    render(<ListCard list={makeSummary({ canEdit: true, title: "Спринт 34" })} />);
    expect(screen.getByRole("button", { name: "Редактировать список «Спринт 34»" })).toBeInTheDocument();
  });

  it("hides the edit action when the user cannot edit the list", () => {
    render(<ListCard list={makeSummary({ canEdit: false, title: "Спринт 34" })} />);
    expect(screen.queryByRole("button", { name: /редактировать список/i })).not.toBeInTheDocument();
  });

  it("keeps the edit trigger outside the card's link so it can never trigger navigation", () => {
    render(<ListCard list={makeSummary({ canEdit: true, title: "Спринт 34" })} />);

    const link = screen.getByTestId("list-card");
    const trigger = screen.getByRole("button", { name: "Редактировать список «Спринт 34»" });
    expect(link).not.toContainElement(trigger);
  });
});
