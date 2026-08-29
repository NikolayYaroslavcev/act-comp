import { describe, expect, it } from "vitest";
import { encodeCsv, TASK_CSV_HEADERS, tasksToCsv } from "./csv";
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

describe("encodeCsv", () => {
  it("joins headers and rows with CRLF and quotes fields that need it", () => {
    const csv = encodeCsv(["a", "b"], [["1", "2"], ["3", "4"]]);
    expect(csv).toBe("a,b\r\n1,2\r\n3,4");
  });

  it("quotes commas, quotes, and newlines", () => {
    const csv = encodeCsv(["title"], [['He said "hi"', "a,b", "line1\nline2"]]);
    expect(csv).toBe('title\r\n"He said ""hi""","a,b","line1\nline2"');
  });

  it("keeps unicode and empty values", () => {
    const csv = encodeCsv(["title", "note"], [["Задача", ""]]);
    expect(csv).toBe("title,note\r\nЗадача,");
  });
});

describe("tasksToCsv", () => {
  it("starts with a BOM and the expected headers", () => {
    const csv = tasksToCsv([]);
    expect(csv.startsWith("\uFEFF")).toBe(true);
    expect(csv.slice(1).startsWith(TASK_CSV_HEADERS.join(","))).toBe(true);
  });

  it("exports a header-only file when there are no tasks", () => {
    const csv = tasksToCsv([]);
    expect(csv.slice(1).split("\r\n").filter(Boolean)).toEqual([TASK_CSV_HEADERS.join(",")]);
  });

  it("writes one data row per task with tags and empty category", () => {
    const csv = tasksToCsv([
      makeTask({
        code: "AB-1",
        title: "Deploy",
        description: "Ship it",
        status: "in_progress",
        priority: 5,
        category: null,
        tags: ["backend", "urgent"],
        deadline: "2026-09-01T00:00:00.000Z",
        estimatedMin: 30,
        timeSpentMin: 10,
      }),
    ]);
    const row = csv.slice(1).split("\r\n")[1];
    expect(row).toContain("AB-1");
    expect(row).toContain("Deploy");
    expect(row).toContain("in_progress");
    expect(row).toContain("5");
    expect(row).toContain("backend; urgent");
    expect(row).toContain("2026-09-01T00:00:00.000Z");
    expect(row).toContain("30");
    expect(row).toContain("10");
  });

  it("resolves parent and dependency codes from the provided lookup tasks", () => {
    const parent = makeTask({ id: "p1", code: "P-1", title: "Parent" });
    const blocker = makeTask({ id: "b1", code: "B-1", title: "Blocker" });
    const child = makeTask({
      id: "c1",
      code: "C-1",
      title: "Child",
      parentId: "p1",
      dependsOn: ["b1"],
    });
    const csv = tasksToCsv([child], [parent, blocker, child]);
    const row = csv.slice(1).split("\r\n")[1];
    expect(row).toContain("P-1");
    expect(row).toContain("B-1");
  });

  it("is deterministic for the same input", () => {
    const tasks = [makeTask({ title: "Same" })];
    expect(tasksToCsv(tasks)).toBe(tasksToCsv(tasks));
  });
});
