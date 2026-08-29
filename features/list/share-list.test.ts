import { describe, expect, it } from "vitest";
import { shareList } from "@/features/list/share-list";
import { createList, findListById } from "@/entities/list/repository";

describe("shareList use-case", () => {
  it("shares the list for the owner", () => {
    const list = createList("u-usecase-share-owner", { title: "Original", template: "work", deadline: null });

    const result = shareList("u-usecase-share-owner", list.id, { userId: "u2", access: "read" });

    expect(result.status).toBe("ok");
    if (result.status === "ok") {
      expect(result.list.sharedWith).toEqual([{ userId: "u2", access: "read" }]);
    }
  });

  it("does not allow a non-owner to share the list", () => {
    const list = createList("u-usecase-share-owner2", { title: "Original", template: "work", deadline: null });

    const result = shareList("someone-else", list.id, { userId: "u2", access: "read" });

    expect(result).toEqual({ status: "forbidden" });
  });

  it("returns not_found for an unknown list id", () => {
    const result = shareList("u-usecase-share-unknown", "does-not-exist", { userId: "u2", access: "read" });
    expect(result).toEqual({ status: "not_found" });
  });

  it("returns self_share when sharing with the caller themselves", () => {
    const list = createList("u1", { title: "Original", template: "work", deadline: null });

    const result = shareList("u1", list.id, { userId: "u1", access: "read" });

    expect(result).toEqual({ status: "self_share" });
  });

  it("does not modify the list when the target user is not found", () => {
    const list = createList("u-usecase-share-owner3", { title: "Original", template: "work", deadline: null });

    shareList("u-usecase-share-owner3", list.id, { userId: "does-not-exist", access: "read" });

    expect(findListById(list.id)?.sharedWith).toEqual([]);
  });
});
