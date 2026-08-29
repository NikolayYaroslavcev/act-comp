import { describe, expect, it } from "vitest";
import { getVisibleList } from "@/features/list/get-list";
import { createList, findListById } from "@/entities/list/repository";

describe("getVisibleList", () => {
  it("returns the list for its owner", () => {
    const list = createList("u-owner-1", { title: "Owned", template: "work", deadline: null });

    const result = getVisibleList("u-owner-1", list.id);

    expect(result).toEqual({ status: "ok", list });
  });

  it("returns the list for a user it is shared with", () => {
    const list = createList("u-owner-2", { title: "Shared", template: "work", deadline: null });
    findListById(list.id)!.sharedWith.push({ userId: "u-viewer-2", access: "read" });

    const result = getVisibleList("u-viewer-2", list.id);

    expect(result).toEqual({ status: "ok", list: findListById(list.id) });
  });

  it("returns not_found for an unknown list id", () => {
    expect(getVisibleList("u-anyone-3", "does-not-exist")).toEqual({ status: "not_found" });
  });

  it("returns not_found instead of leaking the existence of another user's list", () => {
    const list = createList("u-owner-4", { title: "Private", template: "work", deadline: null });

    const result = getVisibleList("u-stranger-4", list.id);

    expect(result).toEqual({ status: "not_found" });
  });

  it("returns not_found for a soft-deleted list, even for the owner", () => {
    const list = createList("u-owner-5", { title: "Owned", template: "work", deadline: null });
    findListById(list.id)!.deletedAt = "2026-08-01T00:00:00.000Z";

    const result = getVisibleList("u-owner-5", list.id);

    expect(result).toEqual({ status: "not_found" });
  });
});
