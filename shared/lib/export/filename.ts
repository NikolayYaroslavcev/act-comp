import type { Task } from "@/entities/task/schema";

const UNSAFE_FILENAME = /[\\/:*?"<>|]+/g;

function sanitizeFilenameSegment(segment: string): string {
  return segment
    .replace(UNSAFE_FILENAME, "_")
    .replace(/\s+/g, " ")
    .replace(/^[_ ]+|[_ ]+$/g, "");
}

export function exportFilename(listTitle: string, extension: "csv" | "pdf" | "xlsx"): string {
  const cleaned = sanitizeFilenameSegment(listTitle);
  const base = cleaned.length > 0 ? cleaned : "list";
  return `${base}-tasks.${extension}`;
}

export function taskExportFilename(task: Task, extension: "csv" | "pdf" | "xlsx"): string {
  const cleaned = sanitizeFilenameSegment(`${task.code} ${task.title}`);
  const base = cleaned.length > 0 ? cleaned : "task";
  return `${base}.${extension}`;
}
