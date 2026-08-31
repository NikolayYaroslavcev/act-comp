import { act, renderHook } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { LIST_SEARCH_DEBOUNCE_MS, useListFilters } from "./use-list-filters";
import { EMPTY_LIST_FILTER_CRITERIA } from "@/entities/saved-filter/list-query-schema";
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

describe("useListFilters", () => {
  it("returns every list unfiltered by default", () => {
    const lists = [makeSummary({ id: "l1" }), makeSummary({ id: "l2" })];
    const { result } = renderHook(() => useListFilters(lists));

    expect(result.current.filteredLists.map((l) => l.id)).toEqual(["l1", "l2"]);
  });

  it("debounces the text search before applying it", async () => {
    vi.useFakeTimers();
    const lists = [makeSummary({ id: "l1", title: "Backend" }), makeSummary({ id: "l2", title: "Frontend" })];
    const { result } = renderHook(() => useListFilters(lists));

    act(() => result.current.setDraft({ ...EMPTY_LIST_FILTER_CRITERIA, search: "back" }));
    expect(result.current.filteredLists.map((l) => l.id)).toEqual(["l1", "l2"]);

    await act(() => vi.advanceTimersByTime(LIST_SEARCH_DEBOUNCE_MS));
    expect(result.current.filteredLists.map((l) => l.id)).toEqual(["l1"]);
    vi.useRealTimers();
  });

  it("applies structured filters immediately via apply()", () => {
    const lists = [
      makeSummary({ id: "l1", template: "work" }),
      makeSummary({ id: "l2", template: "personal" }),
    ];
    const { result } = renderHook(() => useListFilters(lists));

    act(() => result.current.setDraft({ ...EMPTY_LIST_FILTER_CRITERIA, template: ["work"] }));
    act(() => result.current.apply());

    expect(result.current.filteredLists.map((l) => l.id)).toEqual(["l1"]);
  });

  it("clear() resets both draft and applied filters", () => {
    const lists = [makeSummary({ id: "l1", template: "work" }), makeSummary({ id: "l2", template: "personal" })];
    const { result } = renderHook(() => useListFilters(lists));

    act(() => result.current.setDraft({ ...EMPTY_LIST_FILTER_CRITERIA, template: ["work"] }));
    act(() => result.current.apply());
    act(() => result.current.clear());

    expect(result.current.draft).toEqual(EMPTY_LIST_FILTER_CRITERIA);
    expect(result.current.filteredLists.map((l) => l.id)).toEqual(["l1", "l2"]);
  });

  it("restore() loads a saved/recent filter as both draft and applied", () => {
    const lists = [makeSummary({ id: "l1", template: "work" }), makeSummary({ id: "l2", template: "personal" })];
    const { result } = renderHook(() => useListFilters(lists));

    act(() => result.current.restore({ ...EMPTY_LIST_FILTER_CRITERIA, template: ["personal"] }));

    expect(result.current.draft.template).toEqual(["personal"]);
    expect(result.current.filteredLists.map((l) => l.id)).toEqual(["l2"]);
  });
});
