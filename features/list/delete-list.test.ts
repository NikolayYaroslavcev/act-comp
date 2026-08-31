import { describe, expect, it } from "vitest";
import { deleteList } from "@/features/list/delete-list";
import { createList, findListById } from "@/entities/list/repository";

describe("deleteList use-case", () => {
  it("soft-deletes the list when the caller is the owner", async () => {
    const list = await createList("u-usecase-delete-owner", { title: "Old", template: "work", deadline: null });

    const result = await deleteList("u-usecase-delete-owner", list.id);

    expect(result.status).toBe("ok");
    if (result.status === "ok") {
      expect(result.list.deletedAt).not.toBeNull();
    }
  });

  it("returns not_found for a user with no relation to the list (cannot view it)", async () => {
    const list = await createList("u-usecase-delete-owner2", { title: "Old", template: "work", deadline: null });

    const result = await deleteList("someone-else", list.id);

    expect(result).toEqual({ status: "not_found" });
    expect((await findListById(list.id))?.deletedAt).toBeNull();
  });

  it("returns not_found for an unknown list id", async () => {
    const result = await deleteList("u-usecase-delete-unknown", "does-not-exist");
    expect(result).toEqual({ status: "not_found" });
  });
});
