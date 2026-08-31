import { describe, expect, it } from "vitest";
import { updateSettingsForUser } from "@/features/settings/update-settings";
import { findUserById } from "@/entities/user/repository";

describe("updateSettingsForUser", () => {
  it("returns not_found for an unknown user", async () => {
    expect(await updateSettingsForUser("does-not-exist", { theme: "dark" })).toEqual({ status: "not_found" });
  });

  it("persists a partial patch for the given user only", async () => {
    const u3Before = (await findUserById("u3"))!.settings;
    const result = await updateSettingsForUser("u2", { workDayHours: 7 });

    expect(result.status).toBe("ok");
    if (result.status === "ok") {
      expect(result.settings.workDayHours).toBe(7);
      expect(result.settings.theme).toBe("light");
    }
    expect((await findUserById("u3"))!.settings).toEqual(u3Before);
  });
});
