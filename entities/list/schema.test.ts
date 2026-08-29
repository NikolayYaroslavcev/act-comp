import { describe, expect, it } from "vitest";
import { listSchema } from "@/entities/list/schema";

const validList = {
  id: "l1",
  ownerId: "u1",
  title: "Backend",
  template: "work",
  taskIds: ["t1"],
  deadline: null,
  sharedWith: [{ userId: "u2", access: "edit" }],
  history: [],
  deletedAt: null,
  lastActivityAt: "2026-08-27T08:00:00.000Z",
};

describe("listSchema", () => {
  it("accepts a valid list", () => {
    expect(listSchema.safeParse(validList).success).toBe(true);
  });

  it("rejects an unknown template", () => {
    const result = listSchema.safeParse({ ...validList, template: "hobby" });
    expect(result.success).toBe(false);
  });

  it("rejects an unknown share access level", () => {
    const result = listSchema.safeParse({
      ...validList,
      sharedWith: [{ userId: "u2", access: "admin" }],
    });
    expect(result.success).toBe(false);
  });

  it("rejects an empty title", () => {
    const result = listSchema.safeParse({ ...validList, title: "" });
    expect(result.success).toBe(false);
  });
});
