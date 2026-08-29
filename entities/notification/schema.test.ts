import { describe, expect, it } from "vitest";
import { ackNotificationsInputSchema, dueNotificationSchema } from "./schema";

describe("dueNotificationSchema", () => {
  it("accepts a threshold notification payload", () => {
    expect(
      dueNotificationSchema.safeParse({
        key: "time_threshold:t1:75",
        kind: "time_threshold",
        entityType: "task",
        entityId: "t1",
        threshold: 75,
        title: "75%",
        body: "spent",
      }).success,
    ).toBe(true);
  });
});

describe("ackNotificationsInputSchema", () => {
  it("accepts a non-empty list of keys", () => {
    expect(ackNotificationsInputSchema.safeParse({ keys: ["time_threshold:t1:75"] }).success).toBe(true);
  });

  it("rejects an empty keys array", () => {
    expect(ackNotificationsInputSchema.safeParse({ keys: [] }).success).toBe(false);
  });
});
