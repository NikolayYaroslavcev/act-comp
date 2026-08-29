import { describe, expect, it } from "vitest";
import { loginInputSchema } from "@/entities/auth/requests";

describe("loginInputSchema", () => {
  it("accepts valid credentials and defaults rememberMe to false", () => {
    const result = loginInputSchema.safeParse({
      email: "admin@example.com",
      password: "Admin123!",
    });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.rememberMe).toBe(false);
    }
  });

  it("keeps an explicit rememberMe value", () => {
    const result = loginInputSchema.safeParse({
      email: "admin@example.com",
      password: "Admin123!",
      rememberMe: true,
    });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.rememberMe).toBe(true);
    }
  });

  it("rejects an invalid email", () => {
    const result = loginInputSchema.safeParse({
      email: "not-an-email",
      password: "Admin123!",
    });
    expect(result.success).toBe(false);
  });

  it("rejects a missing password", () => {
    const result = loginInputSchema.safeParse({ email: "admin@example.com" });
    expect(result.success).toBe(false);
  });

  it("rejects an empty password", () => {
    const result = loginInputSchema.safeParse({ email: "admin@example.com", password: "" });
    expect(result.success).toBe(false);
  });
});
