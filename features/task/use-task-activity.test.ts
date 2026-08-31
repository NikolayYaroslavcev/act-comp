import { act, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { renderHookWithStore } from "@/shared/store/test-utils";
import { useTaskActivity } from "@/features/task/use-task-activity";
import type { TaskActivityItem } from "@/entities/activity/dto";

function jsonResponse(status: number, body: unknown) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json" },
  });
}

function makeItem(overrides: Partial<TaskActivityItem> = {}): TaskActivityItem {
  return {
    id: "a1",
    entityType: "task",
    entityId: "t1",
    action: "updated",
    at: "2026-08-30T10:00:00.000Z",
    byUserId: "u1",
    actorEmail: "admin@example.com",
    metadata: { field: "priority", old: 3, new: 5 },
    ...overrides,
  };
}

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("useTaskActivity", () => {
  it("loads activity for the given task on mount", async () => {
    const item = makeItem();
    const fetchMock = vi.fn().mockResolvedValue(jsonResponse(200, { data: [item] }));
    vi.stubGlobal("fetch", fetchMock);

    const { result } = renderHookWithStore(() => useTaskActivity("t1"));

    expect(result.current.isLoading).toBe(true);
    await waitFor(() => expect(result.current.isLoading).toBe(false));

    expect(result.current.activity).toEqual([item]);
    expect(result.current.loadError).toBeNull();
    const request = fetchMock.mock.calls[0][0] as Request;
    expect(request.url.endsWith("/api/tasks/t1/activity")).toBe(true);
  });

  it("shows a not-found message for a 404 response", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(jsonResponse(404, { error: { message: "Task not found" } })));

    const { result } = renderHookWithStore(() => useTaskActivity("t1"));

    await waitFor(() => expect(result.current.isLoading).toBe(false));
    expect(result.current.loadError).toBe("История: задача недоступна или была удалена");
  });

  it("shows a session-expired message for a 401 response", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(jsonResponse(401, { error: { message: "Unauthorized" } })));

    const { result } = renderHookWithStore(() => useTaskActivity("t1"));

    await waitFor(() => expect(result.current.isLoading).toBe(false));
    expect(result.current.loadError).toBe("История: сессия истекла. Войдите снова");
  });

  it("retries the request when reload is called", async () => {
    const fetchMock = vi.fn();
    fetchMock.mockResolvedValueOnce(jsonResponse(500, { error: { message: "fail" } }));
    fetchMock.mockResolvedValueOnce(jsonResponse(200, { data: [makeItem()] }));
    vi.stubGlobal("fetch", fetchMock);

    const { result } = renderHookWithStore(() => useTaskActivity("t1"));
    await waitFor(() => expect(result.current.isLoading).toBe(false));
    expect(result.current.loadError).toBeTruthy();

    await act(async () => {
      result.current.reload();
    });

    await waitFor(() => expect(result.current.loadError).toBeNull());
    expect(result.current.activity).toHaveLength(1);
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it("refetches automatically when the Activity tag for the task is invalidated elsewhere", async () => {
    const fetchMock = vi.fn();
    fetchMock.mockResolvedValueOnce(jsonResponse(200, { data: [] }));
    fetchMock.mockResolvedValueOnce(jsonResponse(200, { data: [makeItem({ id: "a2", action: "attachment_added" })] }));
    vi.stubGlobal("fetch", fetchMock);

    const { result, store } = renderHookWithStore(() => useTaskActivity("t1"));
    await waitFor(() => expect(result.current.isLoading).toBe(false));
    expect(result.current.activity).toEqual([]);

    const { activityApi } = await import("@/features/activity/activity-api");
    await act(async () => {
      store.dispatch(activityApi.util.invalidateTags([{ type: "Activity", id: "t1" }]));
    });

    await waitFor(() => expect(result.current.activity).toHaveLength(1));
    expect(result.current.activity[0].action).toBe("attachment_added");
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });
});
