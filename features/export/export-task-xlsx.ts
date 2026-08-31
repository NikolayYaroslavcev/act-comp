import { getVisibleTask } from "@/features/task/get-task";
import { listVisibleTasks } from "@/features/task/list-tasks";
import { generateTaskXlsx } from "@/shared/lib/export/xlsx";
import { taskExportFilename } from "@/shared/lib/export/filename";

export type ExportTaskXlsxResult =
  | { status: "not_found" }
  | { status: "ok"; bytes: Uint8Array; filename: string };

export async function exportTaskXlsx(userId: string, taskId: string): Promise<ExportTaskXlsxResult> {
  const visible = await getVisibleTask(userId, taskId);
  if (visible.status === "not_found") {
    return { status: "not_found" };
  }

  const { task } = visible;
  const codeById = new Map((await listVisibleTasks(userId, task.listId)).map((candidate) => [candidate.id, candidate.code]));
  const parentCode = task.parentId !== null ? (codeById.get(task.parentId) ?? null) : null;
  const dependencyCodes = task.dependsOn
    .map((id) => codeById.get(id))
    .filter((code): code is string => code !== undefined);

  const bytes = await generateTaskXlsx({ task, parentCode, dependencyCodes });

  return { status: "ok", bytes, filename: taskExportFilename(task, "xlsx") };
}
