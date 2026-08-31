import { afterEach, describe, expect, it, vi } from "vitest";
import { notificationsApi } from "@/features/notification/notifications-api";
import { makeStore } from "@/shared/store/store";
import type { DueNotification } from "@/entities/notification/model";

function jsonResponse(status: number, body: unknown) {
  return new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json" } });
}

const item: DueNotification = {
  key: "time_threshold:t1:75",
  kind: "time_threshold",
  entityType: "task",
  entityId: "t1",
  threshold: 75,
  title: "75%",
  body: "spent",
};

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("notificationsApi", () => {
  it("getNotifications unwraps the { data } envelope", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(jsonResponse(200, { data: [item] })));
    const store = makeStore();

    const result = await store.dispatch(notificationsApi.endpoints.getNotifications.initiate());

    expect(result.data).toEqual([item]);
  });

  it("acknowledgeNotifications optimistically removes the key before the request resolves", async () => {
    let resolveAck: (value: Response) => void = () => {};
    const pending = new Promise<Response>((resolve) => {
      resolveAck = resolve;
    });
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(jsonResponse(200, { data: [item] }))
      .mockReturnValueOnce(pending);
    vi.stubGlobal("fetch", fetchMock);
    const store = makeStore();

    const subscription = store.dispatch(notificationsApi.endpoints.getNotifications.initiate());
    await subscription;

    const ackPromise = store.dispatch(notificationsApi.endpoints.acknowledgeNotifications.initiate([item.key]));

    const duringAck = notificationsApi.endpoints.getNotifications.select()(store.getState());
    expect(duringAck.data).toEqual([]);

    resolveAck(jsonResponse(200, { data: [item.key] }));
    await ackPromise;
    subscription.unsubscribe();
  });

  it("rolls back the optimistic removal when the ack request fails", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(jsonResponse(200, { data: [item] }))
      .mockResolvedValueOnce(jsonResponse(500, {}));
    vi.stubGlobal("fetch", fetchMock);
    const store = makeStore();

    const subscription = store.dispatch(notificationsApi.endpoints.getNotifications.initiate());
    await subscription;

    await store.dispatch(notificationsApi.endpoints.acknowledgeNotifications.initiate([item.key]));

    const afterFailure = notificationsApi.endpoints.getNotifications.select()(store.getState());
    expect(afterFailure.data).toEqual([item]);
    subscription.unsubscribe();
  });
});
