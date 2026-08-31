import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { ListSavedFiltersPanel } from "./list-saved-filters-panel";
import { EMPTY_LIST_FILTER_CRITERIA } from "@/entities/saved-filter/list-query-schema";
import type { SavedFilter } from "@/entities/saved-filter/schema";

function makeFilter(overrides: Partial<SavedFilter> & { saved: boolean; label?: string | null }): SavedFilter {
  const { saved, label = null, ...rest } = overrides;
  return {
    id: "f1",
    userId: "u1",
    scope: "lists",
    usedAt: "2026-08-01T00:00:00.000Z",
    query: { ...EMPTY_LIST_FILTER_CRITERIA, saved, label },
    ...rest,
  };
}

describe("ListSavedFiltersPanel", () => {
  it("shows a loading state", () => {
    render(
      <ListSavedFiltersPanel recent={[]} saved={[]} isLoading error={null} onApplyFilter={vi.fn()} onSaveFilter={vi.fn()} onDeleteFilter={vi.fn()} />,
    );
    expect(screen.getByTestId("saved-filters-loading")).toBeInTheDocument();
  });

  it("shows empty states for recent and saved when there are none", () => {
    render(
      <ListSavedFiltersPanel
        recent={[]}
        saved={[]}
        isLoading={false}
        error={null}
        onApplyFilter={vi.fn()}
        onSaveFilter={vi.fn()}
        onDeleteFilter={vi.fn()}
      />,
    );
    expect(screen.queryByTestId("saved-filters-recent")).not.toBeInTheDocument();
    expect(screen.queryByTestId("saved-filters-saved")).not.toBeInTheDocument();
  });

  it("lists a recent filter, describing its criteria, and applies it on click", async () => {
    const user = userEvent.setup();
    const onApplyFilter = vi.fn();
    const recentFilter = makeFilter({ id: "r1", saved: false, query: { ...EMPTY_LIST_FILTER_CRITERIA, search: "sprint", template: ["work"], saved: false, label: null } });
    render(
      <ListSavedFiltersPanel
        recent={[recentFilter]}
        saved={[]}
        isLoading={false}
        error={null}
        onApplyFilter={onApplyFilter}
        onSaveFilter={vi.fn()}
        onDeleteFilter={vi.fn()}
      />,
    );

    expect(screen.getByText(/поиск: «sprint»/i)).toBeInTheDocument();

    await user.click(screen.getByTestId("saved-filter-apply-r1"));
    expect(onApplyFilter).toHaveBeenCalledWith("r1", expect.objectContaining({ search: "sprint", template: ["work"] }));
  });

  it("lists a saved filter by its label, with a delete action", async () => {
    const user = userEvent.setup();
    const onDeleteFilter = vi.fn();
    const savedFilter = makeFilter({ id: "s1", saved: true, label: "My lists", query: { ...EMPTY_LIST_FILTER_CRITERIA, saved: true, label: "My lists" } });
    render(
      <ListSavedFiltersPanel
        recent={[]}
        saved={[savedFilter]}
        isLoading={false}
        error={null}
        onApplyFilter={vi.fn()}
        onSaveFilter={vi.fn()}
        onDeleteFilter={onDeleteFilter}
      />,
    );

    expect(screen.getByText("My lists")).toBeInTheDocument();
    await user.click(screen.getByTestId("saved-filter-delete-s1"));
    expect(onDeleteFilter).toHaveBeenCalledWith("s1");
  });

  it("saves the current filter under an optional label", async () => {
    const user = userEvent.setup();
    const onSaveFilter = vi.fn();
    render(
      <ListSavedFiltersPanel recent={[]} saved={[]} isLoading={false} error={null} onApplyFilter={vi.fn()} onSaveFilter={onSaveFilter} onDeleteFilter={vi.fn()} />,
    );

    await user.type(screen.getByTestId("saved-filters-save-label"), "Sprint views");
    await user.click(screen.getByTestId("saved-filters-save"));

    expect(onSaveFilter).toHaveBeenCalledWith("Sprint views");
  });
});
