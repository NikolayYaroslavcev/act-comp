"use client";

import { useState } from "react";
import type { Task } from "@/entities/task/schema";
import { tasksToCsv } from "@/shared/lib/export/csv";
import { downloadBlob } from "@/shared/lib/export/download";
import { taskExportFilename } from "@/shared/lib/export/filename";
import { buttonVariants } from "@/shared/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/shared/ui/dropdown-menu";

interface TaskExportActionsProps {
  task: Task;
  listTasks?: Task[];
}

type PendingFormat = "pdf" | "xlsx" | null;

const PDF_ERROR = "Не удалось сформировать PDF. Попробуйте ещё раз";
const XLSX_ERROR = "Не удалось сформировать Excel. Попробуйте ещё раз";
const CSV_ERROR = "Не удалось скачать CSV. Попробуйте ещё раз";

export function TaskExportActions({ task, listTasks = [task] }: TaskExportActionsProps) {
  const [pendingFormat, setPendingFormat] = useState<PendingFormat>(null);
  const [error, setError] = useState<string | null>(null);
  const isPending = pendingFormat !== null;

  function handleCsv() {
    try {
      const csv = tasksToCsv([task], listTasks);
      downloadBlob(new Blob([csv], { type: "text/csv;charset=utf-8" }), taskExportFilename(task, "csv"));
      setError(null);
    } catch {
      setError(CSV_ERROR);
    }
  }

  async function requestFile(format: "pdf" | "xlsx", errorMessage: string, contentType: string) {
    if (isPending) {
      return;
    }
    setPendingFormat(format);
    setError(null);
    try {
      const response = await fetch(`/api/tasks/${task.id}/export/${format}`, { method: "POST" });
      if (!response.ok) {
        throw new Error(`${format} export failed`);
      }
      const buffer = await response.arrayBuffer();
      downloadBlob(new Blob([buffer], { type: contentType }), taskExportFilename(task, format));
    } catch {
      setError(errorMessage);
    } finally {
      setPendingFormat(null);
    }
  }

  return (
    <div className="flex flex-col items-end gap-1.5" data-testid="task-export">
      <DropdownMenu>
        <DropdownMenuTrigger
          disabled={isPending}
          data-testid="task-export-trigger"
          className={buttonVariants({ variant: "outline", size: "sm" })}
        >
          {isPending ? "Экспорт…" : "Экспорт"}
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end">
          <DropdownMenuItem data-testid="task-export-csv" disabled={isPending} onClick={handleCsv}>
            CSV
          </DropdownMenuItem>
          <DropdownMenuItem
            data-testid="task-export-pdf"
            disabled={isPending}
            onClick={() => void requestFile("pdf", PDF_ERROR, "application/pdf")}
          >
            {pendingFormat === "pdf" ? "PDF…" : "PDF"}
          </DropdownMenuItem>
          <DropdownMenuItem
            data-testid="task-export-xlsx"
            disabled={isPending}
            onClick={() =>
              void requestFile(
                "xlsx",
                XLSX_ERROR,
                "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
              )
            }
          >
            {pendingFormat === "xlsx" ? "Excel…" : "Excel"}
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
      {error && (
        <p role="alert" className="text-xs text-destructive">
          {error}
        </p>
      )}
    </div>
  );
}
