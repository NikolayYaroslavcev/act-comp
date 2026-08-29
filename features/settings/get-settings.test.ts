import { describe, expect, it } from "vitest";
import { getSettingsForUser } from "@/features/settings/get-settings";
import { findUserById } from "@/entities/user/repository";

describe("getSettingsForUser", () => {
  it("returns the stored settings for an existing user", () => {
    const result = getSettingsForUser("u2");
    expect(result.status).toBe("ok");
    if (result.status === "ok") {
      expect(result.settings).toEqual(findUserById("u2")!.settings);
    }
  });

  it("returns not_found for an unknown user", () => {
    expect(getSettingsForUser("does-not-exist")).toEqual({ status: "not_found" });
  });
});
