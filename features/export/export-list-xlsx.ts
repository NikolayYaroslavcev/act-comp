import { getVisibleList } from "@/features/list/get-list";
import { listVisibleTasks } from "@/features/task/list-tasks";
import { generateTasksXlsx } from "@/shared/lib/export/xlsx";
import { exportFilename } from "@/shared/lib/export/filename";
import { exportPdfBodySchema } from "@/features/export/export-list-pdf";

export const exportXlsxBodySchema = exportPdfBodySchema;

export type ExportListXlsxResult =
  | { status: "not_found" }
  | { status: "ok"; bytes: Uint8Array; filename: string };

export async function exportListXlsx(
  userId: string,
  listId: string,
  requestedIds: string[] | undefined,
): Promise<ExportListXlsxResult> {
  const visible = getVisibleList(userId, listId);
  if (visible.status === "not_found") {
    return { status: "not_found" };
  }

  const visibleTasks = listVisibleTasks(userId, listId);
  const requested = requestedIds === undefined ? null : new Set(requestedIds);
  const tasks = requested === null ? visibleTasks : visibleTasks.filter((task) => requested.has(task.id));
  const codeById = new Map(visibleTasks.map((task) => [task.id, task.code]));

  const bytes = await generateTasksXlsx(
    tasks.map((task) => ({
      task,
      parentCode: task.parentId !== null ? (codeById.get(task.parentId) ?? null) : null,
      dependencyCodes: task.dependsOn
        .map((id) => codeById.get(id))
        .filter((code): code is string => code !== undefined),
    })),
  );

  return { status: "ok", bytes, filename: exportFilename(visible.list.title, "xlsx") };
}
