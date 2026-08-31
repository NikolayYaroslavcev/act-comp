import ExcelJS from "exceljs";
import { describe, expect, it } from "vitest";
import { generateTaskXlsx, TASK_XLSX_HEADERS } from "./xlsx";
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

async function readBack(bytes: Uint8Array) {
  const workbook = new ExcelJS.Workbook();
  await workbook.xlsx.load(Buffer.from(bytes) as unknown as Parameters<typeof workbook.xlsx.load>[0]);
  return workbook;
}

describe("generateTaskXlsx", () => {
  it("produces a real xlsx file (zip signature)", async () => {
    const bytes = await generateTaskXlsx({ task: makeTask(), parentCode: null, dependencyCodes: [] });
    expect(bytes[0]).toBe(0x50); // 'P'
    expect(bytes[1]).toBe(0x4b); // 'K'
    await expect(readBack(bytes)).resolves.toBeTruthy();
  });

  it("writes a header row matching the CSV export field set", async () => {
    const bytes = await generateTaskXlsx({ task: makeTask(), parentCode: null, dependencyCodes: [] });
    const workbook = await readBack(bytes);
    const sheet = workbook.worksheets[0];
    const headerRow = sheet.getRow(1).values as unknown[];
    expect(headerRow.slice(1)).toEqual([...TASK_XLSX_HEADERS]);
  });

  it("stores priority, estimatedMin and timeSpentMin as real numbers", async () => {
    const bytes = await generateTaskXlsx({
      task: makeTask({ priority: 4, estimatedMin: 120, timeSpentMin: 45 }),
      parentCode: null,
      dependencyCodes: [],
    });
    const workbook = await readBack(bytes);
    const dataRow = workbook.worksheets[0].getRow(2);
    expect(dataRow.getCell(5).value).toBe(4);
    expect(dataRow.getCell(9).value).toBe(120);
    expect(dataRow.getCell(10).value).toBe(45);
    expect(typeof dataRow.getCell(5).value).toBe("number");
  });

  it("stores the deadline as a real date, not a string", async () => {
    const bytes = await generateTaskXlsx({
      task: makeTask({ deadline: "2026-09-01T00:00:00.000Z" }),
      parentCode: null,
      dependencyCodes: [],
    });
    const workbook = await readBack(bytes);
    const cell = workbook.worksheets[0].getRow(2).getCell(8);
    expect(cell.value).toBeInstanceOf(Date);
    expect((cell.value as Date).toISOString()).toBe("2026-09-01T00:00:00.000Z");
  });

  it("leaves the deadline cell empty when there is no deadline", async () => {
    const bytes = await generateTaskXlsx({ task: makeTask({ deadline: null }), parentCode: null, dependencyCodes: [] });
    const workbook = await readBack(bytes);
    const cell = workbook.worksheets[0].getRow(2).getCell(8);
    expect(cell.value == null || cell.value === "").toBe(true);
  });

  it("preserves Cyrillic text", async () => {
    const bytes = await generateTaskXlsx({
      task: makeTask({ title: "Проверить кириллицу", description: "Описание", category: "Бэкенд" }),
      parentCode: null,
      dependencyCodes: [],
    });
    const workbook = await readBack(bytes);
    const dataRow = workbook.worksheets[0].getRow(2);
    expect(dataRow.getCell(2).value).toBe("Проверить кириллицу");
    expect(dataRow.getCell(3).value).toBe("Описание");
    expect(dataRow.getCell(6).value).toBe("Бэкенд");
  });

  it("joins tags and dependency codes into readable strings, never [object Object]", async () => {
    const bytes = await generateTaskXlsx({
      task: makeTask({ tags: ["urgent", "backend"] }),
      parentCode: "P-1",
      dependencyCodes: ["B-1", "B-2"],
    });
    const workbook = await readBack(bytes);
    const dataRow = workbook.worksheets[0].getRow(2);
    expect(dataRow.getCell(7).value).toBe("urgent; backend");
    expect(dataRow.getCell(11).value).toBe("P-1");
    expect(dataRow.getCell(12).value).toBe("B-1; B-2");
    for (let i = 1; i <= 12; i += 1) {
      expect(String(dataRow.getCell(i).value)).not.toContain("[object Object]");
    }
  });

  it("writes empty strings, not the word null or undefined, for missing category/parent", async () => {
    const bytes = await generateTaskXlsx({
      task: makeTask({ category: null, parentId: null }),
      parentCode: null,
      dependencyCodes: [],
    });
    const workbook = await readBack(bytes);
    const dataRow = workbook.worksheets[0].getRow(2);
    expect(dataRow.getCell(6).value == null || dataRow.getCell(6).value === "").toBe(true);
    expect(dataRow.getCell(11).value == null || dataRow.getCell(11).value === "").toBe(true);
  });
});
