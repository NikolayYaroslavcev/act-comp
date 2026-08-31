import { act, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { renderHookWithStore } from "@/shared/store/test-utils";
import { useTaskChangeWatch } from "./use-task-change-watch";

function jsonResponse(status: number, body: unknown) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json" },
  });
}

function unchanged() {
  return {
    taskId: "t1",
    listId: "l1",
    changed: false,
    latestAt: null,
    actorUserId: null,
    actorEmail: null,
    changedFields: [],
    summary: null,
  };
}

function changed() {
  return {
    taskId: "t1",
    listId: "l1",
    changed: true,
    latestAt: "2026-08-30T10:00:00.000Z",
    actorUserId: "u1",
    actorEmail: "admin@example.com",
    changedFields: ["priority"],
    summary: "admin@example.com изменил приоритет: 3 → 5",
  };
}

function urlOf(arg: unknown): string {
  return arg instanceof Request ? arg.url : String(arg);
}

describe("useTaskChangeWatch", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("does not fetch when disabled", async () => {
    const fetchMock = vi.fn().mockResolvedValue(jsonResponse(200, { data: unchanged() }));
    vi.stubGlobal("fetch", fetchMock);

    renderHookWithStore(() => useTaskChangeWatch({ taskId: "t1", enabled: false, initialSince: "2026-08-30T09:00:00.000Z" }));

    await new Promise((resolve) => setTimeout(resolve, 20));
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("fetches the changes endpoint for the task using the given since cursor and reports changed:false by default", async () => {
    const fetchMock = vi.fn().mockResolvedValue(jsonResponse(200, { data: unchanged() }));
    vi.stubGlobal("fetch", fetchMock);

    const { result } = renderHookWithStore(() =>
      useTaskChangeWatch({ taskId: "t1", enabled: true, initialSince: "2026-08-30T09:00:00.000Z" }),
    );

    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(1));
    expect(result.current.changed).toBe(false);
    const url = urlOf(fetchMock.mock.calls[0][0]);
    expect(url).toContain("/tasks/t1/changes");
    expect(url).toContain(encodeURIComponent("2026-08-30T09:00:00.000Z"));
  });

  it("reports changed:true with the actor email and summary from the server", async () => {
    const fetchMock = vi.fn().mockResolvedValue(jsonResponse(200, { data: changed() }));
    vi.stubGlobal("fetch", fetchMock);

    const { result } = renderHookWithStore(() =>
      useTaskChangeWatch({ taskId: "t1", enabled: true, initialSince: "2026-08-30T09:00:00.000Z" }),
    );

    await waitFor(() => expect(result.current.changed).toBe(true));
    expect(result.current.actorEmail).toBe("admin@example.com");
    expect(result.current.summary).toEqual(expect.stringContaining("приоритет"));
  });

  it("acknowledge advances the since cursor so a stale change is no longer reported", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(jsonResponse(200, { data: changed() }))
      .mockResolvedValueOnce(jsonResponse(200, { data: unchanged() }));
    vi.stubGlobal("fetch", fetchMock);

    const { result } = renderHookWithStore(() =>
      useTaskChangeWatch({ taskId: "t1", enabled: true, initialSince: "2026-08-30T09:00:00.000Z" }),
    );

    await waitFor(() => expect(result.current.changed).toBe(true));
    const firstUrl = urlOf(fetchMock.mock.calls[0][0]);

    act(() => {
      result.current.acknowledge();
    });

    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(2));
    await waitFor(() => expect(result.current.changed).toBe(false));
    const secondUrl = urlOf(fetchMock.mock.calls[1][0]);
    expect(secondUrl).not.toBe(firstUrl);
  });

  it("does not issue a second request on its own once the first check has resolved (no refresh loop)", async () => {
    const fetchMock = vi.fn().mockResolvedValue(jsonResponse(200, { data: changed() }));
    vi.stubGlobal("fetch", fetchMock);

    const { result, rerender } = renderHookWithStore(() =>
      useTaskChangeWatch({ taskId: "t1", enabled: true, initialSince: "2026-08-30T09:00:00.000Z" }),
    );

    await waitFor(() => expect(result.current.changed).toBe(true));
    rerender();
    rerender();

    await new Promise((resolve) => setTimeout(resolve, 20));
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });
});
