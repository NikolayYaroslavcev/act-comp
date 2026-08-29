import { act, renderHook, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { useNotifications } from "./use-notifications";

function jsonResponse(status: number, body: unknown) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json" },
  });
}

describe("useNotifications", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
    vi.useRealTimers();
  });

  it("keeps the login page quiet when the session is missing", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(jsonResponse(401, { error: { message: "Unauthorized" } })));
    vi.useFakeTimers();

    const { result } = renderHook(() => useNotifications());
    await act(async () => {
      await vi.runOnlyPendingTimersAsync();
    });

    expect(result.current.notifications).toEqual([]);
    expect(result.current.error).toBeNull();
  });

  it("loads due notifications from the API", async () => {
    const item = {
      key: "time_threshold:t1:75",
      kind: "time_threshold",
      entityType: "task",
      entityId: "t1",
      threshold: 75,
      title: "75%",
      body: "spent",
    };
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(jsonResponse(200, { data: [item] })),
    );

    const { result } = renderHook(() => useNotifications());

    await waitFor(() => {
      expect(result.current.notifications).toEqual([item]);
    });
  });

  it("dismisses a notification and acks the key", async () => {
    const item = {
      key: "time_threshold:t1:75",
      kind: "time_threshold",
      entityType: "task",
      entityId: "t1",
      threshold: 75,
      title: "75%",
      body: "spent",
    };
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(jsonResponse(200, { data: [item] }))
      .mockResolvedValueOnce(jsonResponse(200, { data: [item.key] }));
    vi.stubGlobal("fetch", fetchMock);

    const { result } = renderHook(() => useNotifications());
    await waitFor(() => {
      expect(result.current.notifications).toHaveLength(1);
    });

    await act(async () => {
      await result.current.dismiss(item.key);
    });

    expect(result.current.notifications).toEqual([]);
    expect(fetchMock).toHaveBeenCalledWith("/api/notifications", {
      method: "PATCH",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ keys: [item.key] }),
    });
  });
});
