"use client";

import { useState } from "react";
import type { Task } from "@/entities/task/schema";
import { tasksToCsv } from "@/shared/lib/export/csv";
import { downloadBlob } from "@/shared/lib/export/download";
import { exportFilename } from "@/shared/lib/export/filename";
import { buttonVariants } from "@/shared/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/shared/ui/dropdown-menu";

interface ExportActionsProps {
  listId: string;
  listTitle: string;
  tasks: Task[];
  lookupTasks?: Task[];
}

type PendingFormat = "pdf" | "xlsx" | null;

export function ExportActions({ listId, listTitle, tasks, lookupTasks = tasks }: ExportActionsProps) {
  const [pendingFormat, setPendingFormat] = useState<PendingFormat>(null);
  const [error, setError] = useState<string | null>(null);
  const isPending = pendingFormat !== null;

  function handleCsv() {
    try {
      const csv = tasksToCsv(tasks, lookupTasks);
      downloadBlob(new Blob([csv], { type: "text/csv;charset=utf-8" }), exportFilename(listTitle, "csv"));
      setError(null);
    } catch {
      setError("Не удалось скачать CSV. Попробуйте ещё раз");
    }
  }

  async function requestFile(
    format: "pdf" | "xlsx",
    errorMessage: string,
    contentType: string,
  ) {
    if (isPending) {
      return;
    }
    setPendingFormat(format);
    setError(null);
    try {
      const response = await fetch(`/api/lists/${listId}/export/${format}`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ taskIds: tasks.map((task) => task.id) }),
      });
      if (!response.ok) {
        throw new Error(`${format} export failed`);
      }
      const copy = await response.arrayBuffer();
      downloadBlob(new Blob([copy], { type: contentType }), exportFilename(listTitle, format));
    } catch {
      setError(errorMessage);
    } finally {
      setPendingFormat(null);
    }
  }

  return (
    <div className="flex flex-col items-end gap-1.5" data-testid="list-export">
      <DropdownMenu>
        <DropdownMenuTrigger
          disabled={isPending}
          data-testid="list-export-trigger"
          className={buttonVariants({ variant: "outline", size: "sm" })}
        >
          {isPending ? "Экспорт…" : "Экспорт"}
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end">
          <DropdownMenuItem data-testid="list-export-csv" disabled={isPending} onClick={handleCsv}>
            CSV
          </DropdownMenuItem>
          <DropdownMenuItem
            data-testid="list-export-pdf"
            disabled={isPending}
            onClick={() => void requestFile("pdf", "Не удалось сформировать PDF. Попробуйте ещё раз", "application/pdf")}
          >
            {pendingFormat === "pdf" ? "PDF…" : "PDF"}
          </DropdownMenuItem>
          <DropdownMenuItem
            data-testid="list-export-xlsx"
            disabled={isPending}
            onClick={() =>
              void requestFile(
                "xlsx",
                "Не удалось сформировать Excel. Попробуйте ещё раз",
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
