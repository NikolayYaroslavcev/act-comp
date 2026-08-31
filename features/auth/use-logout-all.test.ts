import { act, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { renderHookWithStore } from "@/shared/store/test-utils";
import { useLogoutAll } from "@/features/auth/use-logout-all";
import { notificationsApi } from "@/features/notification/notifications-api";

function jsonResponse(status: number, body: unknown) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json" },
  });
}

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("useLogoutAll", () => {
  it("posts logout-all without a userId in the body", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(jsonResponse(200, { data: { success: true } })));

    const { result } = renderHookWithStore(() => useLogoutAll());

    let returned: unknown;
    await act(async () => {
      returned = await result.current.logoutAll();
    });

    expect(returned).toBe(true);
    expect(result.current.error).toBeNull();
    expect(fetch).toHaveBeenCalledWith(
      "/api/auth/logout-all",
      expect.objectContaining({ method: "POST" }),
    );
    const init = vi.mocked(fetch).mock.calls[0]?.[1] as RequestInit | undefined;
    expect(init?.body).toBeUndefined();
  });

  it("sets isPending while the request is in flight", async () => {
    let resolveFetch: (value: Response) => void = () => {};
    const pending = new Promise<Response>((resolve) => {
      resolveFetch = resolve;
    });
    vi.stubGlobal("fetch", vi.fn().mockReturnValue(pending));

    const { result } = renderHookWithStore(() => useLogoutAll());

    let promise!: Promise<unknown>;
    act(() => {
      promise = result.current.logoutAll();
    });

    await waitFor(() => expect(result.current.isPending).toBe(true));

    resolveFetch(jsonResponse(200, { data: { success: true } }));
    await act(async () => {
      await promise;
    });

    expect(result.current.isPending).toBe(false);
  });

  it("shows a session-expired message for a 401 response", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(jsonResponse(401, { error: { message: "x" } })));

    const { result } = renderHookWithStore(() => useLogoutAll());

    let returned: unknown;
    await act(async () => {
      returned = await result.current.logoutAll();
    });

    expect(returned).toBe(false);
    expect(result.current.error).toBe("Сессия истекла. Войдите снова");
  });

  it("shows a network error when the request fails outright", async () => {
    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new TypeError("Failed to fetch")));

    const { result } = renderHookWithStore(() => useLogoutAll());

    await act(async () => {
      await result.current.logoutAll();
    });

    expect(result.current.error).toBe(
      "Не удалось соединиться с сервером. Проверьте подключение к интернету",
    );
  });

  it("clears any cached RTK Query data on a successful logout, so a next login can't see it", async () => {
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
      .mockResolvedValueOnce(jsonResponse(200, { data: [item] })) // getNotifications, populates cache
      .mockResolvedValueOnce(jsonResponse(200, { data: { success: true } })); // logout-all
    vi.stubGlobal("fetch", fetchMock);

    const { result, store } = renderHookWithStore(() => useLogoutAll());

    const subscription = store.dispatch(notificationsApi.endpoints.getNotifications.initiate());
    await subscription;
    expect(notificationsApi.endpoints.getNotifications.select()(store.getState()).data).toEqual([item]);

    await act(async () => {
      await result.current.logoutAll();
    });

    expect(notificationsApi.endpoints.getNotifications.select()(store.getState()).data).toBeUndefined();
    subscription.unsubscribe();
  });
});
