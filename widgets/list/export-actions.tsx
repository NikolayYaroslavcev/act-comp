"use client";

import { useState } from "react";
import type { Task } from "@/entities/task/schema";
import { tasksToCsv } from "@/shared/lib/export/csv";
import { downloadBlob } from "@/shared/lib/export/download";
import { exportFilename } from "@/shared/lib/export/filename";
import { Button } from "@/shared/ui/button";

interface ExportActionsProps {
  listId: string;
  listTitle: string;
  tasks: Task[];
  lookupTasks?: Task[];
}

export function ExportActions({ listId, listTitle, tasks, lookupTasks = tasks }: ExportActionsProps) {
  const [isPending, setIsPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function handleCsv() {
    try {
      const csv = tasksToCsv(tasks, lookupTasks);
      downloadBlob(new Blob([csv], { type: "text/csv;charset=utf-8" }), exportFilename(listTitle, "csv"));
      setError(null);
    } catch {
      setError("Не удалось скачать CSV. Попробуйте ещё раз");
    }
  }

  async function handlePdf() {
    if (isPending) {
      return;
    }
    setIsPending(true);
    setError(null);
    try {
      const response = await fetch(`/api/lists/${listId}/export/pdf`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ taskIds: tasks.map((task) => task.id) }),
      });
      if (!response.ok) {
        throw new Error("pdf export failed");
      }
      const copy = await response.arrayBuffer();
      downloadBlob(new Blob([copy], { type: "application/pdf" }), exportFilename(listTitle, "pdf"));
    } catch {
      setError("Не удалось сформировать PDF. Попробуйте ещё раз");
    } finally {
      setIsPending(false);
    }
  }

  return (
    <div className="flex flex-col items-end gap-1.5" data-testid="list-export">
      <div className="flex flex-wrap items-center justify-end gap-2">
        <span className="text-sm text-muted-foreground">Экспорт</span>
        <Button data-testid="list-export-csv" variant="outline" size="sm" disabled={isPending} onClick={handleCsv}>
          CSV
        </Button>
        <Button data-testid="list-export-pdf" variant="outline" size="sm" disabled={isPending} onClick={() => void handlePdf()}>
          {isPending ? "PDF…" : "PDF"}
        </Button>
      </div>
      {error && (
        <p role="alert" className="text-xs text-destructive">
          {error}
        </p>
      )}
    </div>
  );
}
