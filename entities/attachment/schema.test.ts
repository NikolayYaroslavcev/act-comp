import { describe, expect, it } from "vitest";
import { attachmentSchema } from "@/entities/attachment/schema";

const validAttachment = {
  id: "a1",
  taskId: "t1",
  filename: "report.pdf",
  size: 1024,
  mimeType: "application/pdf",
  uploadedAt: "2026-08-27T08:00:00.000Z",
  uploadedBy: "u1",
};

describe("attachmentSchema", () => {
  it("accepts a valid attachment", () => {
    expect(attachmentSchema.safeParse(validAttachment).success).toBe(true);
  });

  it("rejects a non-positive size", () => {
    expect(attachmentSchema.safeParse({ ...validAttachment, size: 0 }).success).toBe(false);
  });

  it("rejects a negative size", () => {
    expect(attachmentSchema.safeParse({ ...validAttachment, size: -1 }).success).toBe(false);
  });

  it("rejects an empty filename", () => {
    expect(attachmentSchema.safeParse({ ...validAttachment, filename: "" }).success).toBe(false);
  });

  it("accepts a Unicode filename", () => {
    expect(attachmentSchema.safeParse({ ...validAttachment, filename: "Отчёт по задаче.pdf" }).success).toBe(true);
  });

  it("rejects an empty mimeType", () => {
    expect(attachmentSchema.safeParse({ ...validAttachment, mimeType: "" }).success).toBe(false);
  });
});
