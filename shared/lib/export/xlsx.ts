import ExcelJS from "exceljs";
import type { Task } from "@/entities/task/schema";

export const TASK_XLSX_HEADERS = [
  "code",
  "title",
  "description",
  "status",
  "priority",
  "category",
  "tags",
  "deadline",
  "estimatedMin",
  "timeSpentMin",
  "parentCode",
  "dependsOnCodes",
] as const;

export interface GenerateTaskXlsxInput {
  task: Task;
  parentCode: string | null;
  dependencyCodes: string[];
}

function rowValues({ task, parentCode, dependencyCodes }: GenerateTaskXlsxInput) {
  return [
    task.code,
    task.title,
    task.description,
    task.status,
    task.priority,
    task.category ?? "",
    task.tags.join("; "),
    task.deadline ? new Date(task.deadline) : "",
    task.estimatedMin,
    task.timeSpentMin,
    parentCode ?? "",
    dependencyCodes.join("; "),
  ];
}

export async function generateTasksXlsx(
  rows: GenerateTaskXlsxInput[],
  sheetName = "Задачи",
): Promise<Uint8Array> {
  const workbook = new ExcelJS.Workbook();
  const sheet = workbook.addWorksheet(sheetName);
  sheet.addRow([...TASK_XLSX_HEADERS]);
  const deadlineIndex = TASK_XLSX_HEADERS.indexOf("deadline") + 1;

  rows.forEach((row, index) => {
    sheet.addRow(rowValues(row));
    if (row.task.deadline) {
      sheet.getRow(index + 2).getCell(deadlineIndex).numFmt = "yyyy-mm-dd hh:mm";
    }
  });

  const buffer = await workbook.xlsx.writeBuffer();
  return new Uint8Array(buffer);
}

export async function generateTaskXlsx(input: GenerateTaskXlsxInput): Promise<Uint8Array> {
  return generateTasksXlsx([input], "Задача");
}
