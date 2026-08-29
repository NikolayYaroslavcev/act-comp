import { describe, expect, it } from "vitest";
import { ackNotificationKeys, listAckedNotificationKeys } from "./repository";

describe("notification acks repository", () => {
  it("starts with no acks for a user", () => {
    expect(listAckedNotificationKeys("u-acks-empty")).toEqual([]);
  });

  it("persists keys for the owning user only", () => {
    ackNotificationKeys("u-acks-owner", ["time_threshold:t1:75"]);
    ackNotificationKeys("u-acks-other", ["time_threshold:t9:90"]);

    expect(listAckedNotificationKeys("u-acks-owner")).toEqual(["time_threshold:t1:75"]);
    expect(listAckedNotificationKeys("u-acks-other")).toEqual(["time_threshold:t9:90"]);
  });

  it("is idempotent for the same key", () => {
    ackNotificationKeys("u-acks-dup", ["time_threshold:t1:75"]);
    ackNotificationKeys("u-acks-dup", ["time_threshold:t1:75", "time_threshold:t1:90"]);

    expect(listAckedNotificationKeys("u-acks-dup")).toEqual([
      "time_threshold:t1:75",
      "time_threshold:t1:90",
    ]);
  });
});
