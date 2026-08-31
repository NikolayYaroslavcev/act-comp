import { describe, expect, it } from "vitest";
import { restoreList } from "@/features/list/restore-list";
import { createList, findListById } from "@/entities/list/repository";

describe("restoreList use-case", () => {
  it("restores the list when the caller is the owner within the restore window", async () => {
    const list = await createList("u-usecase-restore-owner", { title: "Old", template: "work", deadline: null });
    (await findListById(list.id))!.deletedAt = "2026-08-20T00:00:00.000Z";
    const now = new Date("2026-08-27T12:00:00.000Z");

    const result = await restoreList("u-usecase-restore-owner", list.id, now);

    expect(result.status).toBe("ok");
    if (result.status === "ok") {
      expect(result.list.deletedAt).toBeNull();
    }
  });

  it("does not allow a user who is not the owner to restore the list", async () => {
    const list = await createList("u-usecase-restore-owner2", { title: "Old", template: "work", deadline: null });
    (await findListById(list.id))!.deletedAt = "2026-08-20T00:00:00.000Z";

    const result = await restoreList("someone-else", list.id, new Date("2026-08-27T12:00:00.000Z"));

    expect(result).toEqual({ status: "not_found" });
  });

  it("returns not_found for an unknown list id", async () => {
    const result = await restoreList("u-usecase-restore-unknown", "does-not-exist", new Date());
    expect(result).toEqual({ status: "not_found" });
  });

  it("returns expired when the restore window has passed", async () => {
    const list = await createList("u-usecase-restore-expired", { title: "Old", template: "work", deadline: null });
    (await findListById(list.id))!.deletedAt = "2026-01-01T00:00:00.000Z";

    const result = await restoreList("u-usecase-restore-expired", list.id, new Date("2026-08-27T12:00:00.000Z"));

    expect(result).toEqual({ status: "expired" });
  });

  it("defaults `now` to the current time when not provided", async () => {
    const list = await createList("u-usecase-restore-default-now", { title: "Old", template: "work", deadline: null });
    (await findListById(list.id))!.deletedAt = new Date().toISOString();

    const result = await restoreList("u-usecase-restore-default-now", list.id);

    expect(result.status).toBe("ok");
  });
});
