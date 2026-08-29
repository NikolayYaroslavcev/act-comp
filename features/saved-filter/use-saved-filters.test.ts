import { act, renderHook, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { useSavedFilters } from "./use-saved-filters";
import { EMPTY_TASK_FILTER_CRITERIA } from "@/entities/saved-filter/query-schema";

function jsonResponse(status: number, body: unknown) {
  return new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json" } });
}

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("useSavedFilters", () => {
  it("loads recent and saved filters on mount", async () => {
    const fetchMock = vi.fn().mockResolvedValue(jsonResponse(200, { data: { recent: [{ id: "r1" }], saved: [{ id: "s1" }] } }));
    vi.stubGlobal("fetch", fetchMock);

    const { result } = renderHook(() => useSavedFilters());

    expect(result.current.isLoading).toBe(true);
    await waitFor(() => expect(result.current.isLoading).toBe(false));

    expect(result.current.recent).toEqual([{ id: "r1" }]);
    expect(result.current.saved).toEqual([{ id: "s1" }]);
    expect(fetchMock).toHaveBeenCalledWith("/api/saved-filters?scope=tasks");
  });

  it("defaults recent/saved to empty arrays when the response data is missing them", async () => {
    const fetchMock = vi.fn().mockResolvedValue(jsonResponse(200, { data: {} }));
    vi.stubGlobal("fetch", fetchMock);

    const { result } = renderHook(() => useSavedFilters());
    await waitFor(() => expect(result.current.isLoading).toBe(false));

    expect(result.current.recent).toEqual([]);
    expect(result.current.saved).toEqual([]);
    expect(result.current.error).toBeNull();
  });

  it("defaults only the missing array when the response data has one but not the other", async () => {
    const fetchMock = vi.fn().mockResolvedValue(jsonResponse(200, { data: { recent: [{ id: "r1" }] } }));
    vi.stubGlobal("fetch", fetchMock);

    const { result } = renderHook(() => useSavedFilters());
    await waitFor(() => expect(result.current.isLoading).toBe(false));

    expect(result.current.recent).toEqual([{ id: "r1" }]);
    expect(result.current.saved).toEqual([]);
  });

  it("surfaces a session-expired error for a 401 on load", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(jsonResponse(401, { error: { message: "Unauthorized" } })));

    const { result } = renderHook(() => useSavedFilters());
    await waitFor(() => expect(result.current.isLoading).toBe(false));

    expect(result.current.error).toBe("Сессия истекла. Войдите снова");
  });

  it("surfaces a network error when the initial load fails outright", async () => {
    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new TypeError("Failed to fetch")));

    const { result } = renderHook(() => useSavedFilters());
    await waitFor(() => expect(result.current.isLoading).toBe(false));

    expect(result.current.error).toBe("Не удалось соединиться с сервером. Проверьте подключение к интернету");
  });

  it("applies a filter and refreshes the lists", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(jsonResponse(200, { data: { recent: [], saved: [] } }))
      .mockResolvedValueOnce(jsonResponse(201, { data: { id: "r1" } }))
      .mockResolvedValueOnce(jsonResponse(200, { data: { recent: [{ id: "r1" }], saved: [] } }));
    vi.stubGlobal("fetch", fetchMock);

    const { result } = renderHook(() => useSavedFilters());
    await waitFor(() => expect(result.current.isLoading).toBe(false));

    let returned;
    await act(async () => {
      returned = await result.current.applyFilter(EMPTY_TASK_FILTER_CRITERIA);
    });

    expect(returned).toEqual({ id: "r1" });
    expect(fetchMock).toHaveBeenCalledWith(
      "/api/saved-filters",
      expect.objectContaining({ method: "POST", body: JSON.stringify({ action: "apply", criteria: EMPTY_TASK_FILTER_CRITERIA }) }),
    );
    await waitFor(() => expect(result.current.recent).toEqual([{ id: "r1" }]));
  });

  it("saves a filter with a label", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(jsonResponse(200, { data: { recent: [], saved: [] } }))
      .mockResolvedValueOnce(jsonResponse(201, { data: { id: "s1" } }))
      .mockResolvedValueOnce(jsonResponse(200, { data: { recent: [], saved: [{ id: "s1" }] } }));
    vi.stubGlobal("fetch", fetchMock);

    const { result } = renderHook(() => useSavedFilters());
    await waitFor(() => expect(result.current.isLoading).toBe(false));

    await act(async () => {
      await result.current.saveFilter(EMPTY_TASK_FILTER_CRITERIA, "Mine");
    });

    expect(fetchMock).toHaveBeenCalledWith(
      "/api/saved-filters",
      expect.objectContaining({
        method: "POST",
        body: JSON.stringify({ action: "save", criteria: EMPTY_TASK_FILTER_CRITERIA, label: "Mine" }),
      }),
    );
    await waitFor(() => expect(result.current.saved).toEqual([{ id: "s1" }]));
  });

  it("deletes a filter and refreshes the lists", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(jsonResponse(200, { data: { recent: [], saved: [{ id: "s1" }] } }))
      .mockResolvedValueOnce(jsonResponse(200, { data: { id: "s1" } }))
      .mockResolvedValueOnce(jsonResponse(200, { data: { recent: [], saved: [] } }));
    vi.stubGlobal("fetch", fetchMock);

    const { result } = renderHook(() => useSavedFilters());
    await waitFor(() => expect(result.current.isLoading).toBe(false));

    let deleted;
    await act(async () => {
      deleted = await result.current.deleteFilter("s1");
    });

    expect(deleted).toBe(true);
    expect(fetchMock).toHaveBeenCalledWith("/api/saved-filters/s1", { method: "DELETE" });
    await waitFor(() => expect(result.current.saved).toEqual([]));
  });

  it("surfaces a not-found error when deleting an already-deleted filter", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(jsonResponse(200, { data: { recent: [], saved: [] } }))
      .mockResolvedValueOnce(jsonResponse(404, { error: { message: "Saved filter not found" } }));
    vi.stubGlobal("fetch", fetchMock);

    const { result } = renderHook(() => useSavedFilters());
    await waitFor(() => expect(result.current.isLoading).toBe(false));

    let deleted;
    await act(async () => {
      deleted = await result.current.deleteFilter("gone");
    });

    expect(deleted).toBe(false);
    expect(result.current.error).toBe("Фильтр не найден или уже удалён");
  });
});
