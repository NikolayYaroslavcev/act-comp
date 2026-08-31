import { describe, expect, it } from "vitest";
import { getSystemStats } from "@/features/dashboard/system-stats";
import { countUsers } from "@/entities/user/repository";
import { countTasks } from "@/entities/task/repository";

describe("getSystemStats", () => {
  it("aggregates total users and total tasks from the repositories", async () => {
    expect(await getSystemStats()).toEqual({
      totalUsers: await countUsers(),
      totalTasks: await countTasks(),
    });
  });

  it("returns only aggregate counts, not private user or task fields", async () => {
    expect(Object.keys(await getSystemStats()).sort()).toEqual(["totalTasks", "totalUsers"]);
  });
});
