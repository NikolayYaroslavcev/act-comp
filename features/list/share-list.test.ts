import { describe, expect, it } from "vitest";
import { shareList } from "@/features/list/share-list";
import { createList, findListById } from "@/entities/list/repository";

describe("shareList use-case", () => {
  it("shares the list for the owner", async () => {
    const list = await createList("u-usecase-share-owner", { title: "Original", template: "work", deadline: null });

    const result = await shareList("u-usecase-share-owner", list.id, { userId: "u2", access: "read" });

    expect(result.status).toBe("ok");
    if (result.status === "ok") {
      expect(result.list.sharedWith).toEqual([{ userId: "u2", access: "read" }]);
    }
  });

  it("does not allow a non-owner to share the list", async () => {
    const list = await createList("u-usecase-share-owner2", { title: "Original", template: "work", deadline: null });

    const result = await shareList("someone-else", list.id, { userId: "u2", access: "read" });

    expect(result).toEqual({ status: "not_found" });
  });

  it("returns not_found for an unknown list id", async () => {
    const result = await shareList("u-usecase-share-unknown", "does-not-exist", { userId: "u2", access: "read" });
    expect(result).toEqual({ status: "not_found" });
  });

  it("returns self_share when sharing with the caller themselves", async () => {
    const list = await createList("u1", { title: "Original", template: "work", deadline: null });

    const result = await shareList("u1", list.id, { userId: "u1", access: "read" });

    expect(result).toEqual({ status: "self_share" });
  });

  it("does not modify the list when the target user is not found", async () => {
    const list = await createList("u-usecase-share-owner3", { title: "Original", template: "work", deadline: null });

    await shareList("u-usecase-share-owner3", list.id, { userId: "does-not-exist", access: "read" });

    expect((await findListById(list.id))?.sharedWith).toEqual([]);
  });
});
