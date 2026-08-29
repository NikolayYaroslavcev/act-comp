import { describe, expect, it } from "vitest";
import {
  createListInputSchema,
  duplicateListInputSchema,
  shareListInputSchema,
  updateListInputSchema,
} from "@/entities/list/requests";

describe("createListInputSchema", () => {
  it("accepts minimal valid input and defaults deadline to null", () => {
    const result = createListInputSchema.safeParse({
      title: "New list",
      template: "personal",
    });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.deadline).toBeNull();
    }
  });

  it.each(["work", "personal", "project"] as const)("accepts the %s template", (template) => {
    const result = createListInputSchema.safeParse({ title: "New list", template });
    expect(result.success).toBe(true);
  });

  it("rejects a missing title", () => {
    const result = createListInputSchema.safeParse({ template: "work" });
    expect(result.success).toBe(false);
  });

  it("rejects a missing template", () => {
    const result = createListInputSchema.safeParse({ title: "New list" });
    expect(result.success).toBe(false);
  });

  it("rejects an invalid template", () => {
    const result = createListInputSchema.safeParse({
      title: "New list",
      template: "hobby",
    });
    expect(result.success).toBe(false);
  });

  it("rejects a non-string title", () => {
    const result = createListInputSchema.safeParse({ title: 42, template: "work" });
    expect(result.success).toBe(false);
  });

  it("ignores a client-supplied ownerId rather than accepting it", () => {
    const result = createListInputSchema.safeParse({
      ownerId: "someone-else",
      title: "New list",
      template: "work",
    });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data).not.toHaveProperty("ownerId");
    }
  });
});

describe("duplicateListInputSchema", () => {
  it("defaults copyTasks and copySharedWith to false for an empty body", () => {
    const result = duplicateListInputSchema.safeParse({});
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data).toEqual({ copyTasks: false, copySharedWith: false });
    }
  });

  it("accepts explicit copyTasks and copySharedWith values", () => {
    const result = duplicateListInputSchema.safeParse({ copyTasks: true, copySharedWith: true });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data).toEqual({ copyTasks: true, copySharedWith: true });
    }
  });

  it("rejects a non-boolean copyTasks", () => {
    const result = duplicateListInputSchema.safeParse({ copyTasks: "yes" });
    expect(result.success).toBe(false);
  });

  it("ignores a client-supplied ownerId rather than accepting it", () => {
    const result = duplicateListInputSchema.safeParse({ ownerId: "someone-else" });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data).not.toHaveProperty("ownerId");
    }
  });
});

describe("shareListInputSchema", () => {
  it("accepts a valid userId + access", () => {
    const result = shareListInputSchema.safeParse({ userId: "u2", access: "read" });
    expect(result.success).toBe(true);
  });

  it("accepts a valid email + access", () => {
    const result = shareListInputSchema.safeParse({ email: "user@example.com", access: "edit" });
    expect(result.success).toBe(true);
  });

  it("rejects when neither userId nor email is provided", () => {
    const result = shareListInputSchema.safeParse({ access: "read" });
    expect(result.success).toBe(false);
  });

  it("rejects when both userId and email are provided", () => {
    const result = shareListInputSchema.safeParse({ userId: "u2", email: "user@example.com", access: "read" });
    expect(result.success).toBe(false);
  });

  it("rejects an invalid email", () => {
    const result = shareListInputSchema.safeParse({ email: "not-an-email", access: "read" });
    expect(result.success).toBe(false);
  });

  it("rejects a missing access", () => {
    const result = shareListInputSchema.safeParse({ userId: "u2" });
    expect(result.success).toBe(false);
  });

  it("rejects an invalid access value", () => {
    const result = shareListInputSchema.safeParse({ userId: "u2", access: "admin" });
    expect(result.success).toBe(false);
  });

  it("ignores a client-supplied ownerId rather than accepting it", () => {
    const result = shareListInputSchema.safeParse({ ownerId: "someone-else", userId: "u2", access: "read" });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data).not.toHaveProperty("ownerId");
    }
  });
});

describe("updateListInputSchema", () => {
  it("rejects an empty patch", () => {
    const result = updateListInputSchema.safeParse({});
    expect(result.success).toBe(false);
  });

  it("accepts a single-field patch", () => {
    const result = updateListInputSchema.safeParse({ title: "Renamed" });
    expect(result.success).toBe(true);
  });
});
