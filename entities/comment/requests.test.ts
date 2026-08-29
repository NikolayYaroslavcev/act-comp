import { describe, expect, it } from "vitest";
import { createCommentInputSchema } from "@/entities/comment/requests";

describe("createCommentInputSchema", () => {
  it("accepts a non-empty text", () => {
    const result = createCommentInputSchema.safeParse({ text: "Hello" });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.text).toBe("Hello");
    }
  });

  it("rejects an empty string", () => {
    const result = createCommentInputSchema.safeParse({ text: "" });
    expect(result.success).toBe(false);
  });

  it("rejects a missing text field", () => {
    const result = createCommentInputSchema.safeParse({});
    expect(result.success).toBe(false);
  });

  it("rejects text longer than 2000 characters", () => {
    const result = createCommentInputSchema.safeParse({ text: "a".repeat(2001) });
    expect(result.success).toBe(false);
  });

  it("accepts text at exactly 2000 characters", () => {
    const result = createCommentInputSchema.safeParse({ text: "a".repeat(2000) });
    expect(result.success).toBe(true);
  });

  it("ignores server-owned fields present in the payload", () => {
    const result = createCommentInputSchema.safeParse({
      text: "Hello",
      authorId: "u2",
      taskId: "spoofed-task",
      id: "spoofed-id",
      createdAt: "2020-01-01T00:00:00.000Z",
    });

    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data).toEqual({ text: "Hello" });
    }
  });
});
