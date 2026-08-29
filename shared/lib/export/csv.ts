import type { Task } from "@/entities/task/schema";

export function encodeCsv(headers: string[], rows: string[][]): string {
  return [headers, ...rows].map((cells) => cells.map(encodeCsvField).join(",")).join("\r\n");
}

function encodeCsvField(value: string): string {
  if (/[",\r\n]/.test(value)) {
    return `"${value.replaceAll('"', '""')}"`;
  }
  return value;
}

export const TASK_CSV_HEADERS = [
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

export function tasksToCsv(tasks: Task[], lookupTasks: Task[] = tasks): string {
  const codeById = new Map(lookupTasks.map((task) => [task.id, task.code]));
  const rows = tasks.map((task) => [
    task.code,
    task.title,
    task.description,
    task.status,
    String(task.priority),
    task.category ?? "",
    task.tags.join("; "),
    task.deadline ?? "",
    String(task.estimatedMin),
    String(task.timeSpentMin),
    task.parentId !== null ? (codeById.get(task.parentId) ?? "") : "",
    task.dependsOn.map((id) => codeById.get(id)).filter((code): code is string => code !== undefined).join("; "),
  ]);
  return `\uFEFF${encodeCsv([...TASK_CSV_HEADERS], rows)}`;
}
