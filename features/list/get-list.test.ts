import { describe, expect, it } from "vitest";
import { getVisibleList } from "@/features/list/get-list";
import { createList, findListById } from "@/entities/list/repository";

describe("getVisibleList", () => {
  it("returns the list for its owner", async () => {
    const list = await createList("u-owner-1", { title: "Owned", template: "work", deadline: null });

    const result = await getVisibleList("u-owner-1", list.id);

    expect(result).toEqual({ status: "ok", list });
  });

  it("returns the list for a user it is shared with", async () => {
    const list = await createList("u-owner-2", { title: "Shared", template: "work", deadline: null });
    (await findListById(list.id))!.sharedWith.push({ userId: "u-viewer-2", access: "read" });

    const result = await getVisibleList("u-viewer-2", list.id);

    expect(result).toEqual({ status: "ok", list: await findListById(list.id) });
  });

  it("returns not_found for an unknown list id", async () => {
    expect(await getVisibleList("u-anyone-3", "does-not-exist")).toEqual({ status: "not_found" });
  });

  it("returns not_found instead of leaking the existence of another user's list", async () => {
    const list = await createList("u-owner-4", { title: "Private", template: "work", deadline: null });

    const result = await getVisibleList("u-stranger-4", list.id);

    expect(result).toEqual({ status: "not_found" });
  });

  it("returns not_found for a soft-deleted list, even for the owner", async () => {
    const list = await createList("u-owner-5", { title: "Owned", template: "work", deadline: null });
    (await findListById(list.id))!.deletedAt = "2026-08-01T00:00:00.000Z";

    const result = await getVisibleList("u-owner-5", list.id);

    expect(result).toEqual({ status: "not_found" });
  });
});
