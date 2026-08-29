import { describe, expect, it } from "vitest";
import { getArchiveCandidates } from "@/features/dashboard/archive-candidates";

const NOW = new Date("2026-09-18T14:00:00.000Z");

describe("getArchiveCandidates", () => {
  it("flags a list whose latest activity (resolved via findLatestListActivity, including task-level events) is 30+ days old", () => {
    const ids = getArchiveCandidates("u1", NOW).map((list) => list.id);

    expect(ids).toContain("l1");
  });

  it("does not flag a list whose latest activity is under 30 days old", () => {
    const ids = getArchiveCandidates("u1", NOW).map((list) => list.id);

    expect(ids).not.toContain("l2");
  });

  it("does not flag a list with no recorded activity at all", () => {
    const ids = getArchiveCandidates("u1", NOW).map((list) => list.id);

    expect(ids).not.toContain("l5");
  });

  it("never surfaces a soft-deleted list, regardless of how stale it is", () => {
    const ids = getArchiveCandidates("u1", NOW).map((list) => list.id);

    expect(ids).not.toContain("l4");
  });

  it("flags a shared list the same way as an owned one for a non-owner viewer", () => {
    const ids = getArchiveCandidates("u2", NOW).map((list) => list.id);

    expect(ids).toContain("l1");
  });

  it("returns an empty array for a user with no visible lists", () => {
    expect(getArchiveCandidates("u3", NOW)).toEqual([]);
  });
});
