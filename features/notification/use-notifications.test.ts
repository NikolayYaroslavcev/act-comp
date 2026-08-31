import { act, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { renderHookWithStore } from "@/shared/store/test-utils";
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
  });

  it("keeps the login page quiet when the session is missing", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(jsonResponse(401, { error: { message: "Unauthorized" } })));

    const { result } = renderHookWithStore(() => useNotifications());

    await waitFor(() => {
      expect(result.current.notifications).toEqual([]);
      expect(result.current.error).toBeNull();
    });
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

    const { result } = renderHookWithStore(() => useNotifications());

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

    const { result } = renderHookWithStore(() => useNotifications());
    await waitFor(() => {
      expect(result.current.notifications).toHaveLength(1);
    });

    await act(async () => {
      await result.current.dismiss(item.key);
    });

    expect(result.current.notifications).toEqual([]);
    expect(fetchMock).toHaveBeenCalledTimes(2);
    const patchRequest = fetchMock.mock.calls[1][0] as Request;
    expect(patchRequest.url.endsWith("/api/notifications")).toBe(true);
    expect(patchRequest.method).toBe("PATCH");
    expect(await patchRequest.json()).toEqual({ keys: [item.key] });
  });

  it("restores the notification if the ack request fails", async () => {
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
      .mockResolvedValueOnce(jsonResponse(500, {}));
    vi.stubGlobal("fetch", fetchMock);

    const { result } = renderHookWithStore(() => useNotifications());
    await waitFor(() => {
      expect(result.current.notifications).toHaveLength(1);
    });

    await act(async () => {
      await result.current.dismiss(item.key);
    });

    await waitFor(() => {
      expect(result.current.notifications).toEqual([item]);
    });
  });
});

describe("useNotifications cross-tab sync (otherUserChanges)", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("does not react to a same-origin broadcast when crossTabSyncEnabled is false (default)", async () => {
    const fetchMock = vi.fn().mockResolvedValue(jsonResponse(200, { data: [] }));
    vi.stubGlobal("fetch", fetchMock);

    renderHookWithStore(() => useNotifications());
    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(1));

    const sender = new BroadcastChannel("task-manager:notifications");
    sender.postMessage({ type: "acked" });
    sender.close();

    // No new fetch beyond the initial poll — a disabled tab ignores broadcasts.
    await new Promise((resolve) => setTimeout(resolve, 20));
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it("refetches when a broadcast arrives on another tab's channel while enabled", async () => {
    const fetchMock = vi.fn().mockResolvedValue(jsonResponse(200, { data: [] }));
    vi.stubGlobal("fetch", fetchMock);

    renderHookWithStore(() => useNotifications({ crossTabSyncEnabled: true }));
    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(1));

    const sender = new BroadcastChannel("task-manager:notifications");
    sender.postMessage({ type: "acked" });
    sender.close();

    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(2));
  });

  it("broadcasts on the shared channel after a successful dismiss while enabled, for other tabs to pick up", async () => {
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

    const { result } = renderHookWithStore(() => useNotifications({ crossTabSyncEnabled: true }));
    await waitFor(() => expect(result.current.notifications).toHaveLength(1));

    const listener = new BroadcastChannel("task-manager:notifications");
    const received: unknown[] = [];
    listener.onmessage = (event) => received.push(event.data);

    await act(async () => {
      await result.current.dismiss(item.key);
    });

    await waitFor(() => expect(received).toHaveLength(1));
    listener.close();
  });
});
