import { describe, expect, it } from "vitest";
import data from "@/data.json";
import { databaseSchema } from "@/entities/database/schema";

describe("databaseSchema", () => {
  it("parses data.json as a valid normalized database", () => {
    const result = databaseSchema.safeParse(data);
    expect(result.success).toBe(true);
  });

  it("contains seed data for every required entity collection", () => {
    const db = databaseSchema.parse(data);
    expect(Object.keys(db.users).length).toBeGreaterThanOrEqual(2);
    expect(Object.keys(db.sessions).length).toBeGreaterThanOrEqual(2);
    expect(Object.keys(db.lists).length).toBeGreaterThanOrEqual(3);
    expect(Object.keys(db.tasks).length).toBeGreaterThanOrEqual(5);
    expect(Object.keys(db.comments).length).toBeGreaterThan(0);
    expect(Object.keys(db.activityLog).length).toBeGreaterThan(0);
    expect(Object.keys(db.savedFilters).length).toBeGreaterThan(0);
  });

  it("has a soft-deleted list and a soft-deleted task", () => {
    const db = databaseSchema.parse(data);
    expect(Object.values(db.lists).some((list) => list.deletedAt !== null)).toBe(true);
    expect(Object.values(db.tasks).some((task) => task.deletedAt !== null)).toBe(true);
  });

  it("has TEST-1 and TEST-3 with a missing TEST-2 in the same list", () => {
    const db = databaseSchema.parse(data);
    const l1Tasks = Object.values(db.tasks).filter((task) => task.listId === "l1");
    const codes = l1Tasks.filter((task) => task.deletedAt === null).map((task) => task.code);
    expect(codes).toContain("TEST-1");
    expect(codes).toContain("TEST-3");
    expect(codes).not.toContain("TEST-2");
  });

  it("has a shared list with another user", () => {
    const db = databaseSchema.parse(data);
    expect(Object.values(db.lists).some((list) => list.sharedWith.length > 0)).toBe(true);
  });
});
