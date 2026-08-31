import { describe, expect, it } from "vitest";
import { MAX_ATTACHMENT_FILENAME_LENGTH, sanitizeAttachmentFilename } from "@/entities/attachment/model";

describe("sanitizeAttachmentFilename", () => {
  it("leaves an ordinary filename unchanged", () => {
    expect(sanitizeAttachmentFilename("report.pdf")).toBe("report.pdf");
  });

  it("preserves a Cyrillic filename", () => {
    expect(sanitizeAttachmentFilename("Отчёт по задаче.pdf")).toBe("Отчёт по задаче.pdf");
  });

  it("keeps a path-traversal-shaped name as display metadata", () => {
    expect(sanitizeAttachmentFilename("../../../../etc/passwd")).toBe("../../../../etc/passwd");
  });

  it("strips CR and LF characters", () => {
    expect(sanitizeAttachmentFilename("evil\r\nname.txt")).toBe("evilname.txt");
  });

  it("strips NUL characters", () => {
    expect(sanitizeAttachmentFilename("a\0b.txt")).toBe("ab.txt");
  });

  it("trims surrounding whitespace", () => {
    expect(sanitizeAttachmentFilename("  notes.txt  ")).toBe("notes.txt");
  });

  it("caps an extremely long filename", () => {
    const name = `${"a".repeat(400)}.txt`;
    const sanitized = sanitizeAttachmentFilename(name);
    expect(sanitized.length).toBeLessThanOrEqual(MAX_ATTACHMENT_FILENAME_LENGTH);
    expect(sanitized.startsWith("aaa")).toBe(true);
  });

  it("falls back to a generic name when nothing remains", () => {
    expect(sanitizeAttachmentFilename("\r\n\0  ")).toBe("file");
  });
});
