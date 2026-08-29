import { describe, expect, it } from "vitest";
import { createList } from "@/features/list/create-list";
import { findListById } from "@/entities/list/repository";

describe("createList use-case", () => {
  it("uses the given ownerId as the list owner", () => {
    const list = createList("u-usecase-1", { title: "Owned list", template: "work", deadline: null });

    expect(list.ownerId).toBe("u-usecase-1");
  });

  it("passes the request fields through to the created list", () => {
    const deadline = "2026-10-01T00:00:00.000Z";
    const list = createList("u-usecase-2", { title: "Detailed list", template: "project", deadline });

    expect(list.title).toBe("Detailed list");
    expect(list.template).toBe("project");
    expect(list.deadline).toBe(deadline);
  });

  it("persists the created list in the repository", () => {
    const list = createList("u-usecase-3", { title: "Persisted list", template: "personal", deadline: null });

    expect(findListById(list.id)).toEqual(list);
  });
});
