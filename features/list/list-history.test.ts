import { describe, expect, it } from "vitest";
import { getListHistoryForUser } from "./list-history";
import { createList, deleteList, findListById, updateList } from "@/entities/list/repository";

describe("getListHistoryForUser", () => {
  it("returns not_found for an unknown list", () => {
    expect(getListHistoryForUser("u1", "does-not-exist")).toEqual({ status: "not_found" });
  });

  it("returns not_found for a list the user cannot view", () => {
    const list = createList("u1", { title: "Private", template: "work", deadline: null });
    expect(getListHistoryForUser("u2", list.id)).toEqual({ status: "not_found" });
  });

  it("returns the owner's list history with resolved actor emails, newest first", () => {
    const list = createList("u1", { title: "Original", template: "work", deadline: null });
    updateList(list.id, "u1", { title: "Renamed" });

    const result = getListHistoryForUser("u1", list.id);

    expect(result.status).toBe("ok");
    if (result.status === "ok") {
      expect(result.history).toHaveLength(1);
      expect(result.history[0]).toMatchObject({ field: "title", old: "Original", new: "Renamed" });
      expect(result.history[0].actorEmail).toMatch(/@/);
    }
  });

  it("orders multiple history entries newest first", () => {
    const list = createList("u1", { title: "Original", template: "work", deadline: null });
    updateList(list.id, "u1", { title: "Second" }, );
    updateList(list.id, "u1", { title: "Third" });

    const result = getListHistoryForUser("u1", list.id);

    expect(result.status).toBe("ok");
    if (result.status === "ok") {
      expect(result.history.map((entry) => entry.new)).toEqual(["Third", "Second"]);
    }
  });

  it("allows a shared read-only viewer to see the list's history", () => {
    const list = createList("u1", { title: "Shared", template: "work", deadline: null });
    updateList(list.id, "u1", { title: "Renamed" });
    findListById(list.id)!.sharedWith.push({ userId: "u2", access: "read" });

    const result = getListHistoryForUser("u2", list.id);

    expect(result.status).toBe("ok");
    if (result.status === "ok") {
      expect(result.history).toHaveLength(1);
    }
  });

  it("returns not_found for a soft-deleted list, even to its owner", () => {
    const list = createList("u1", { title: "Gone", template: "work", deadline: null });
    deleteList(list.id, "u1");

    expect(getListHistoryForUser("u1", list.id)).toEqual({ status: "not_found" });
  });
});
