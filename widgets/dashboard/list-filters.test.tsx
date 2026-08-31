import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { ListFilters } from "./list-filters";
import { EMPTY_LIST_FILTER_CRITERIA } from "@/entities/saved-filter/list-query-schema";

describe("ListFilters", () => {
  it("shows the current search value and reports changes", async () => {
    const user = userEvent.setup();
    const onDraftChange = vi.fn();
    render(
      <ListFilters
        draft={{ ...EMPTY_LIST_FILTER_CRITERIA, search: "spr" }}
        onDraftChange={onDraftChange}
        onApply={vi.fn()}
        onClear={vi.fn()}
      />,
    );

    expect(screen.getByTestId("list-filters-search")).toHaveValue("spr");

    await user.type(screen.getByTestId("list-filters-search"), "i");

    expect(onDraftChange).toHaveBeenCalledWith(expect.objectContaining({ search: "spri" }));
  });

  it("toggles a template checkbox on and off", async () => {
    const user = userEvent.setup();
    const onDraftChange = vi.fn();
    const { rerender } = render(
      <ListFilters draft={EMPTY_LIST_FILTER_CRITERIA} onDraftChange={onDraftChange} onApply={vi.fn()} onClear={vi.fn()} />,
    );

    await user.click(screen.getByTestId("list-filters-template-work"));
    expect(onDraftChange).toHaveBeenCalledWith(expect.objectContaining({ template: ["work"] }));

    rerender(
      <ListFilters
        draft={{ ...EMPTY_LIST_FILTER_CRITERIA, template: ["work"] }}
        onDraftChange={onDraftChange}
        onApply={vi.fn()}
        onClear={vi.fn()}
      />,
    );
    await user.click(screen.getByTestId("list-filters-template-work"));
    expect(onDraftChange).toHaveBeenCalledWith(expect.objectContaining({ template: [] }));
  });

  it("calls onApply and onClear", async () => {
    const user = userEvent.setup();
    const onApply = vi.fn();
    const onClear = vi.fn();
    render(<ListFilters draft={EMPTY_LIST_FILTER_CRITERIA} onDraftChange={vi.fn()} onApply={onApply} onClear={onClear} />);

    await user.click(screen.getByTestId("list-filters-apply"));
    await user.click(screen.getByTestId("list-filters-clear"));

    expect(onApply).toHaveBeenCalledTimes(1);
    expect(onClear).toHaveBeenCalledTimes(1);
  });
});
