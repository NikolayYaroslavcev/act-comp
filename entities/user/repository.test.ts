import { describe, expect, it } from "vitest";
import { countUsers, findUserByEmail, findUserById } from "@/entities/user/repository";
import { getDb } from "@/shared/lib/db";

describe("findUserByEmail", () => {
  it("finds the seeded admin account", () => {
    const user = findUserByEmail("admin@example.com");
    expect(user?.email).toBe("admin@example.com");
  });

  it("is case-insensitive", () => {
    const user = findUserByEmail("Admin@Example.com");
    expect(user?.email).toBe("admin@example.com");
  });

  it("returns undefined for an unknown email", () => {
    expect(findUserByEmail("nobody@example.com")).toBeUndefined();
  });
});

describe("findUserById", () => {
  it("finds a user by id", () => {
    const user = findUserByEmail("admin@example.com");
    expect(user).toBeDefined();
    expect(findUserById(user!.id)?.email).toBe("admin@example.com");
  });

  it("returns undefined for an unknown id", () => {
    expect(findUserById("does-not-exist")).toBeUndefined();
  });
});

describe("countUsers", () => {
  it("counts every user in the store", () => {
    expect(countUsers()).toBe(Object.keys(getDb().users).length);
  });
});
