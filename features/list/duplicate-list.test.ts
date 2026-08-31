import { describe, expect, it } from "vitest";
import { duplicateList } from "@/features/list/duplicate-list";
import { createList, findListById } from "@/entities/list/repository";

describe("duplicateList use-case", () => {
  it("duplicates the list for the owner", () => {
    const list = createList("u-usecase-dup-owner", { title: "Original", template: "work", deadline: null });

    const result = duplicateList("u-usecase-dup-owner", list.id, { copyTasks: false, copySharedWith: false });

    expect(result.status).toBe("ok");
    if (result.status === "ok") {
      expect(result.list.id).not.toBe(list.id);
      expect(result.list.ownerId).toBe("u-usecase-dup-owner");
    }
  });

  it("does not allow a user with no relation to the list to duplicate it", () => {
    const list = createList("u-usecase-dup-owner2", { title: "Original", template: "work", deadline: null });

    const result = duplicateList("someone-else", list.id, { copyTasks: false, copySharedWith: false });

    expect(result).toEqual({ status: "not_found" });
  });

  it("returns not_found for an unknown list id", () => {
    const result = duplicateList("u-usecase-dup-unknown", "does-not-exist", {
      copyTasks: false,
      copySharedWith: false,
    });
    expect(result).toEqual({ status: "not_found" });
  });

  it("returns deleted for a soft-deleted source list", () => {
    const list = createList("u-usecase-dup-deleted", { title: "Original", template: "work", deadline: null });
    findListById(list.id)!.deletedAt = "2026-08-20T00:00:00.000Z";

    const result = duplicateList("u-usecase-dup-deleted", list.id, { copyTasks: false, copySharedWith: false });

    expect(result).toEqual({ status: "deleted" });
  });
});
