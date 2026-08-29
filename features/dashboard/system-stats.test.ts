import { describe, expect, it } from "vitest";
import { getSystemStats } from "@/features/dashboard/system-stats";
import { countUsers } from "@/entities/user/repository";
import { countTasks } from "@/entities/task/repository";

describe("getSystemStats", () => {
  it("aggregates total users and total tasks from the repositories", () => {
    expect(getSystemStats()).toEqual({
      totalUsers: countUsers(),
      totalTasks: countTasks(),
    });
  });
});
