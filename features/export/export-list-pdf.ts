import { z } from "zod";
import { getVisibleList } from "@/features/list/get-list";
import { listVisibleTasks } from "@/features/task/list-tasks";
import { loadCyrillicFontBytes } from "@/shared/lib/export/load-cyrillic-font";
import { generateTaskListPdf } from "@/shared/lib/export/pdf";
import { exportFilename } from "@/shared/lib/export/filename";

export const exportPdfBodySchema = z.object({
  taskIds: z.array(z.string().min(1)).optional(),
});

export type ExportListPdfResult =
  | { status: "not_found" }
  | { status: "ok"; bytes: Uint8Array; filename: string };

export async function exportListPdf(
  userId: string,
  listId: string,
  requestedIds: string[] | undefined,
): Promise<ExportListPdfResult> {
  const visible = await getVisibleList(userId, listId);
  if (visible.status === "not_found") {
    return { status: "not_found" };
  }

  const visibleTasks = await listVisibleTasks(userId, listId);
  const requested = requestedIds === undefined ? null : new Set(requestedIds);
  const tasks = requested === null ? visibleTasks : visibleTasks.filter((task) => requested.has(task.id));

  const fontBytes = await loadCyrillicFontBytes();
  const bytes = await generateTaskListPdf({
    listTitle: visible.list.title,
    tasks,
    exportedAt: new Date(),
    fontBytes,
  });

  return { status: "ok", bytes, filename: exportFilename(visible.list.title, "pdf") };
}
