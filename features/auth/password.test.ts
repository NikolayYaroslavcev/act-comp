import { describe, expect, it } from "vitest";
import { verifyPassword } from "@/features/auth/password";

describe("verifyPassword", () => {
  it("accepts the matching demo password", () => {
    expect(verifyPassword("demo:Admin123!", "Admin123!")).toBe(true);
  });

  it("rejects a wrong password", () => {
    expect(verifyPassword("demo:Admin123!", "wrong-password")).toBe(false);
  });

  it("rejects a non-demo password hash", () => {
    expect(verifyPassword("bcrypt:somehash", "Admin123!")).toBe(false);
  });
});
