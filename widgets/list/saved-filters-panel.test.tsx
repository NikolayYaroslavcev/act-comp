import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { SavedFiltersPanel } from "./saved-filters-panel";
import { EMPTY_TASK_FILTER_CRITERIA } from "@/entities/saved-filter/query-schema";
import type { SavedFilter } from "@/entities/saved-filter/schema";

function makeFilter(overrides: Partial<SavedFilter> & { saved: boolean; label?: string | null }): SavedFilter {
  const { saved, label = null, ...rest } = overrides;
  return {
    id: "f1",
    userId: "u1",
    scope: "tasks",
    usedAt: "2026-08-01T00:00:00.000Z",
    query: { ...EMPTY_TASK_FILTER_CRITERIA, saved, label },
    ...rest,
  };
}

describe("SavedFiltersPanel", () => {
  it("shows a loading state", () => {
    render(
      <SavedFiltersPanel
        recent={[]}
        saved={[]}
        isLoading
        error={null}
        currentCriteria={EMPTY_TASK_FILTER_CRITERIA}
        onApplyFilter={vi.fn()}
        onSaveFilter={vi.fn()}
        onDeleteFilter={vi.fn()}
      />,
    );
    expect(screen.getByTestId("saved-filters-loading")).toBeInTheDocument();
  });

  it("shows an error state", () => {
    render(
      <SavedFiltersPanel
        recent={[]}
        saved={[]}
        isLoading={false}
        error="Не удалось соединиться с сервером"
        currentCriteria={EMPTY_TASK_FILTER_CRITERIA}
        onApplyFilter={vi.fn()}
        onSaveFilter={vi.fn()}
        onDeleteFilter={vi.fn()}
      />,
    );
    expect(screen.getByTestId("saved-filters-error")).toHaveTextContent("Не удалось соединиться с сервером");
  });

  it("lists recent filters and applies one on click", async () => {
    const user = userEvent.setup();
    const onApplyFilter = vi.fn();
    const recentFilter = makeFilter({ id: "r1", saved: false, query: { ...EMPTY_TASK_FILTER_CRITERIA, search: "deploy", saved: false, label: null } });
    render(
      <SavedFiltersPanel
        recent={[recentFilter]}
        saved={[]}
        isLoading={false}
        error={null}
        currentCriteria={EMPTY_TASK_FILTER_CRITERIA}
        onApplyFilter={onApplyFilter}
        onSaveFilter={vi.fn()}
        onDeleteFilter={vi.fn()}
      />,
    );

    await user.click(screen.getByTestId("saved-filter-apply-r1"));
    expect(onApplyFilter).toHaveBeenCalledWith(expect.objectContaining({ search: "deploy" }));
  });

  it("lists saved filters with a delete button", async () => {
    const user = userEvent.setup();
    const onDeleteFilter = vi.fn();
    const savedFilter = makeFilter({ id: "s1", saved: true, label: "Mine" });
    render(
      <SavedFiltersPanel
        recent={[]}
        saved={[savedFilter]}
        isLoading={false}
        error={null}
        currentCriteria={EMPTY_TASK_FILTER_CRITERIA}
        onApplyFilter={vi.fn()}
        onSaveFilter={vi.fn()}
        onDeleteFilter={onDeleteFilter}
      />,
    );

    expect(screen.getByText("Mine")).toBeInTheDocument();
    await user.click(screen.getByTestId("saved-filter-delete-s1"));
    expect(onDeleteFilter).toHaveBeenCalledWith("s1");
  });

  it("saves the current criteria with the entered label", async () => {
    const user = userEvent.setup();
    const onSaveFilter = vi.fn();
    render(
      <SavedFiltersPanel
        recent={[]}
        saved={[]}
        isLoading={false}
        error={null}
        currentCriteria={{ ...EMPTY_TASK_FILTER_CRITERIA, search: "deploy" }}
        onApplyFilter={vi.fn()}
        onSaveFilter={onSaveFilter}
        onDeleteFilter={vi.fn()}
      />,
    );

    await user.type(screen.getByTestId("saved-filters-save-label"), "My deploys");
    await user.click(screen.getByTestId("saved-filters-save"));

    expect(onSaveFilter).toHaveBeenCalledWith("My deploys");
  });
});
