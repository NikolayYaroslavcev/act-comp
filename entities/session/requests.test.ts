import { describe, expect, it } from "vitest";
import { createSessionInputSchema } from "@/entities/session/requests";

describe("createSessionInputSchema", () => {
  it("accepts a valid session input", () => {
    const result = createSessionInputSchema.safeParse({
      userId: "u1",
      ip: "192.0.2.1 (demo)",
      device: "Chrome on Windows",
      rememberMe: true,
    });
    expect(result.success).toBe(true);
  });

  it("rejects a missing userId", () => {
    const result = createSessionInputSchema.safeParse({
      ip: "192.0.2.1 (demo)",
      device: "Chrome on Windows",
      rememberMe: true,
    });
    expect(result.success).toBe(false);
  });

  it("rejects an empty device", () => {
    const result = createSessionInputSchema.safeParse({
      userId: "u1",
      ip: "192.0.2.1 (demo)",
      device: "",
      rememberMe: true,
    });
    expect(result.success).toBe(false);
  });
});
