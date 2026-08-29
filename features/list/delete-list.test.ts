import { describe, expect, it } from "vitest";
import { deleteList } from "@/features/list/delete-list";
import { createList, findListById } from "@/entities/list/repository";

describe("deleteList use-case", () => {
  it("soft-deletes the list when the caller is the owner", () => {
    const list = createList("u-usecase-delete-owner", { title: "Old", template: "work", deadline: null });

    const result = deleteList("u-usecase-delete-owner", list.id);

    expect(result.status).toBe("ok");
    if (result.status === "ok") {
      expect(result.list.deletedAt).not.toBeNull();
    }
  });

  it("does not allow a user who is not the owner to delete the list", () => {
    const list = createList("u-usecase-delete-owner2", { title: "Old", template: "work", deadline: null });

    const result = deleteList("someone-else", list.id);

    expect(result).toEqual({ status: "forbidden" });
    expect(findListById(list.id)?.deletedAt).toBeNull();
  });

  it("returns not_found for an unknown list id", () => {
    const result = deleteList("u-usecase-delete-unknown", "does-not-exist");
    expect(result).toEqual({ status: "not_found" });
  });
});
