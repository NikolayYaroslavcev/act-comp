import { describe, expect, it } from "vitest";
import { updateList } from "@/features/list/update-list";
import { createList } from "@/entities/list/repository";

describe("updateList use-case", () => {
  it("applies the update when the caller is the owner", () => {
    const list = createList("u-usecase-owner", { title: "Old", template: "work", deadline: null });

    const result = updateList("u-usecase-owner", list.id, { title: "New" });

    expect(result.status).toBe("ok");
    if (result.status === "ok") {
      expect(result.list.title).toBe("New");
    }
  });

  it("passes the input fields through to the repository", () => {
    const list = createList("u-usecase-fields", { title: "Old", template: "work", deadline: null });

    const result = updateList("u-usecase-fields", list.id, { template: "personal" });

    expect(result.status).toBe("ok");
    if (result.status === "ok") {
      expect(result.list.template).toBe("personal");
    }
  });

  it("returns not_found for a user with no relation to the list (cannot view it)", () => {
    const list = createList("u-usecase-owner2", { title: "Old", template: "work", deadline: null });

    const result = updateList("someone-else", list.id, { title: "Hijacked" });

    expect(result).toEqual({ status: "not_found" });
  });

  it("returns not_found for an unknown list id", () => {
    const result = updateList("u-usecase-unknown", "does-not-exist", { title: "New" });
    expect(result).toEqual({ status: "not_found" });
  });
});
