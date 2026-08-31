import { getVisibleTask } from "@/features/task/get-task";
import { listVisibleTasks } from "@/features/task/list-tasks";
import { loadCyrillicFontBytes } from "@/shared/lib/export/load-cyrillic-font";
import { generateTaskDetailPdf } from "@/shared/lib/export/pdf";
import { taskExportFilename } from "@/shared/lib/export/filename";

export type ExportTaskPdfResult =
  | { status: "not_found" }
  | { status: "ok"; bytes: Uint8Array; filename: string };

export async function exportTaskPdf(userId: string, taskId: string): Promise<ExportTaskPdfResult> {
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

  const fontBytes = await loadCyrillicFontBytes();
  const bytes = await generateTaskDetailPdf({
    task,
    parentCode,
    dependencyCodes,
    exportedAt: new Date(),
    fontBytes,
  });

  return { status: "ok", bytes, filename: taskExportFilename(task, "pdf") };
}
