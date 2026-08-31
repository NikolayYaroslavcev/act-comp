import { describe, expect, it } from "vitest";
import { exportFilename, taskExportFilename } from "./filename";
import type { Task } from "@/entities/task/schema";

function makeTask(overrides: Partial<Task> = {}): Task {
  return {
    id: "t1",
    listId: "l1",
    code: "TEST-1",
    title: "Task",
    description: "",
    status: "new",
    priority: 3,
    category: null,
    tags: [],
    dependsOn: [],
    parentId: null,
    subtaskIds: [],
    deadline: null,
    createdAt: "2026-08-01T00:00:00.000Z",
    estimatedMin: 0,
    timeSpentMin: 0,
    timerStartedAt: null,
    timerPausedAt: null,
    extensions: [],
    history: [],
    deletedAt: null,
    ...overrides,
  };
}

describe("exportFilename", () => {
  it("uses a readable list-name suffix", () => {
    expect(exportFilename("Спринт 34", "csv")).toBe("Спринт 34-tasks.csv");
    expect(exportFilename("Спринт 34", "pdf")).toBe("Спринт 34-tasks.pdf");
  });

  it("replaces characters that are unsafe in filenames", () => {
    expect(exportFilename('a/b\\c:d*e?f"g<h>i|j', "csv")).toBe("a_b_c_d_e_f_g_h_i_j-tasks.csv");
  });

  it("falls back when the title sanitises to empty", () => {
    expect(exportFilename("***", "csv")).toBe("list-tasks.csv");
  });
});

describe("taskExportFilename", () => {
  it("combines the task code and title, for each supported extension", () => {
    const task = makeTask({ code: "AB-12", title: "Deploy service" });
    expect(taskExportFilename(task, "csv")).toBe("AB-12 Deploy service.csv");
    expect(taskExportFilename(task, "pdf")).toBe("AB-12 Deploy service.pdf");
    expect(taskExportFilename(task, "xlsx")).toBe("AB-12 Deploy service.xlsx");
  });

  it("replaces characters that are unsafe in filenames", () => {
    const task = makeTask({ code: "AB/1", title: 'a/b\\c:d*e?f"g<h>i|j' });
    expect(taskExportFilename(task, "csv")).toBe("AB_1 a_b_c_d_e_f_g_h_i_j.csv");
  });

  it("falls back when the code and title both sanitise to empty", () => {
    const task = makeTask({ code: "***", title: "***" });
    expect(taskExportFilename(task, "csv")).toBe("task.csv");
  });
});
