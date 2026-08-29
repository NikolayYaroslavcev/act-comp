import { describe, expect, it } from "vitest";
import { createTaskInputSchema, updateTaskInputSchema } from "@/entities/task/requests";

describe("createTaskInputSchema", () => {
  it("applies defaults for optional fields", () => {
    const result = createTaskInputSchema.safeParse({ listId: "l1", title: "New task" });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.description).toBe("");
      expect(result.data.priority).toBe(3);
      expect(result.data.tags).toEqual([]);
      expect(result.data.category).toBeNull();
      expect(result.data.deadline).toBeNull();
    }
  });

  it("rejects a missing title", () => {
    const result = createTaskInputSchema.safeParse({ listId: "l1" });
    expect(result.success).toBe(false);
  });

  it("rejects a priority outside 1-5", () => {
    const result = createTaskInputSchema.safeParse({
      listId: "l1",
      title: "New task",
      priority: 9,
    });
    expect(result.success).toBe(false);
  });
});

describe("updateTaskInputSchema", () => {
  it("rejects an empty patch", () => {
    const result = updateTaskInputSchema.safeParse({});
    expect(result.success).toBe(false);
  });

  it("accepts a status-only patch", () => {
    const result = updateTaskInputSchema.safeParse({ status: "done" });
    expect(result.success).toBe(true);
  });

  it("rejects an unknown status in a patch", () => {
    const result = updateTaskInputSchema.safeParse({ status: "blocked" });
    expect(result.success).toBe(false);
  });

  it("accepts a dependsOn-only patch", () => {
    const result = updateTaskInputSchema.safeParse({ dependsOn: ["t1", "t2"] });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.dependsOn).toEqual(["t1", "t2"]);
    }
  });

  it("accepts a parentId-only patch, including an explicit null", () => {
    const result = updateTaskInputSchema.safeParse({ parentId: null });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.parentId).toBeNull();
      expect("parentId" in result.data).toBe(true);
    }
  });

  it("distinguishes an explicit null deadline from an omitted one", () => {
    const explicitNull = updateTaskInputSchema.safeParse({ deadline: null });
    const omitted = updateTaskInputSchema.safeParse({ title: "Task" });

    expect(explicitNull.success).toBe(true);
    expect(omitted.success).toBe(true);
    if (explicitNull.success && omitted.success) {
      expect("deadline" in explicitNull.data).toBe(true);
      expect(explicitNull.data.deadline).toBeNull();
      expect("deadline" in omitted.data).toBe(false);
    }
  });

  it("strips server-owned fields instead of accepting them", () => {
    const result = updateTaskInputSchema.safeParse({
      title: "Task",
      id: "spoofed",
      listId: "spoofed-list",
      code: "TEST-99",
      createdAt: "2020-01-01T00:00:00.000Z",
      history: [{ field: "title", old: "a", new: "b", at: "2020-01-01T00:00:00.000Z", byUserId: "u1" }],
      deletedAt: "2020-01-01T00:00:00.000Z",
    });

    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data).toEqual({ title: "Task" });
    }
  });
});
