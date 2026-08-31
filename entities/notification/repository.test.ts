import { describe, expect, it } from "vitest";
import { ackNotificationKeys, listAckedNotificationKeys } from "./repository";

describe("notification acks repository", () => {
  it("starts with no acks for a user", async () => {
    expect(await listAckedNotificationKeys("u-acks-empty")).toEqual([]);
  });

  it("persists keys for the owning user only", async () => {
    await ackNotificationKeys("u-acks-owner", ["time_threshold:t1:75"]);
    await ackNotificationKeys("u-acks-other", ["time_threshold:t9:90"]);

    expect(await listAckedNotificationKeys("u-acks-owner")).toEqual(["time_threshold:t1:75"]);
    expect(await listAckedNotificationKeys("u-acks-other")).toEqual(["time_threshold:t9:90"]);
  });

  it("is idempotent for the same key", async () => {
    await ackNotificationKeys("u-acks-dup", ["time_threshold:t1:75"]);
    await ackNotificationKeys("u-acks-dup", ["time_threshold:t1:75", "time_threshold:t1:90"]);

    expect(await listAckedNotificationKeys("u-acks-dup")).toEqual([
      "time_threshold:t1:75",
      "time_threshold:t1:90",
    ]);
  });
});
