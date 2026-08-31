"use client";

import { useRef, useState } from "react";
import { Loader2Icon, Trash2Icon } from "lucide-react";
import type { AttachmentWithUploader } from "@/entities/attachment/dto";
import { useTaskAttachments } from "@/features/attachment/use-task-attachments";
import { usePagedItems } from "@/shared/lib/use-paged-items";
import { Button } from "@/shared/ui/button";
import { Dialog, DialogClose, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/shared/ui/dialog";
import { PaginationBar } from "@/shared/ui/pagination";
import { formatDateTime } from "@/shared/lib/format-date";

interface TaskAttachmentsProps {
  taskId: string;
  canManage?: boolean;
}

function formatSize(bytes: number): string {
  if (bytes < 1024) {
    return `${bytes} Б`;
  }
  if (bytes < 1024 * 1024) {
    return `${(bytes / 1024).toFixed(1)} КБ`;
  }
  return `${(bytes / (1024 * 1024)).toFixed(1)} МБ`;
}

function ErrorBanner({ children }: { children: string }) {
  return (
    <p role="alert" className="rounded-lg border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive">
      {children}
    </p>
  );
}

export function TaskAttachments({ taskId, canManage = false }: TaskAttachmentsProps) {
  const {
    attachments,
    isLoading,
    loadError,
    upload,
    isUploading,
    uploadError,
    remove,
    pendingDeleteId,
    deleteError,
    download,
    downloadError,
  } = useTaskAttachments(taskId);
  const { page, setPage, totalPages, pageItems } = usePagedItems(attachments);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);
  const confirmTarget = attachments.find((attachment) => attachment.id === confirmDeleteId) ?? null;
  const isDeleting = pendingDeleteId !== null;

  async function handleFileChange(event: React.ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file) {
      return;
    }
    await upload(file);
  }

  async function handleConfirmDelete() {
    if (!confirmDeleteId) {
      return;
    }
    const ok = await remove(confirmDeleteId);
    if (ok) {
      setConfirmDeleteId(null);
    }
  }

  return (
    <div className="flex flex-col gap-3 border-t border-border pt-4" data-testid="task-attachments">
      <h3 className="text-sm font-medium">Вложения</h3>

      {isLoading && (
        <p className="text-sm text-muted-foreground" data-testid="task-attachments-loading">
          Загрузка вложений...
        </p>
      )}

      {loadError && <ErrorBanner>{loadError}</ErrorBanner>}

      {!isLoading && !loadError && attachments.length === 0 && (
        <p className="text-sm text-muted-foreground" data-testid="task-attachments-empty">
          Нет вложений
        </p>
      )}

      {!isLoading && !loadError && attachments.length > 0 && (
        <div className="flex flex-col gap-2">
          <ul className="flex flex-col gap-2" data-testid="task-attachments-list">
            {pageItems.map((attachment: AttachmentWithUploader) => (
            <li
              key={attachment.id}
              data-testid="task-attachment"
              className="flex min-w-0 items-center justify-between gap-2 rounded-lg border border-border px-3 py-2"
            >
              <div className="min-w-0 flex-1">
                <p
                  className="min-w-0 truncate break-words text-sm"
                  data-testid="task-attachment-name"
                  title={attachment.filename}
                >
                  {attachment.filename}
                </p>
                <p className="text-xs text-muted-foreground">
                  {formatSize(attachment.size)} · {formatDateTime(attachment.uploadedAt)} ·{" "}
                  {attachment.uploaderEmail}
                </p>
              </div>
              <div className="flex shrink-0 items-center gap-1">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  data-testid="task-attachment-download"
                  disabled={pendingDeleteId === attachment.id}
                  onClick={() => void download(attachment)}
                >
                  Скачать
                </Button>
                {canManage && (
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon-sm"
                    className="text-muted-foreground hover:bg-destructive/10 hover:text-destructive"
                    aria-label={`Удалить файл «${attachment.filename}»`}
                    disabled={pendingDeleteId === attachment.id}
                    onClick={() => setConfirmDeleteId(attachment.id)}
                  >
                    <Trash2Icon aria-hidden="true" />
                  </Button>
                )}
              </div>
            </li>
          ))}
          </ul>
          <PaginationBar
            page={page}
            totalPages={totalPages}
            onPageChange={setPage}
            data-testid="task-attachments-pagination"
          />
        </div>
      )}

      {downloadError && <ErrorBanner>{downloadError}</ErrorBanner>}

      {canManage && (
        <div className="flex flex-col gap-2">
          {uploadError && <ErrorBanner>{uploadError}</ErrorBanner>}
          <div className="flex items-center gap-2">
            <Button
              type="button"
              variant="outline"
              size="sm"
              disabled={isUploading}
              onClick={() => fileInputRef.current?.click()}
            >
              {isUploading ? "Загрузка..." : "Загрузить файл"}
            </Button>
            <input
              ref={fileInputRef}
              type="file"
              className="sr-only"
              aria-label="Выбрать файл для загрузки"
              data-testid="task-attachment-input"
              disabled={isUploading}
              onChange={(event) => void handleFileChange(event)}
            />
          </div>
        </div>
      )}

      <Dialog open={confirmDeleteId !== null} onOpenChange={(open) => !open && setConfirmDeleteId(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Удалить файл?</DialogTitle>
            <DialogDescription>
              Файл «{confirmTarget?.filename}» будет удалён без возможности восстановления.
            </DialogDescription>
          </DialogHeader>

          {deleteError && <ErrorBanner>{deleteError}</ErrorBanner>}

          <div className="flex justify-end gap-2">
            <DialogClose
              render={
                <Button type="button" variant="outline" disabled={isDeleting}>
                  Отмена
                </Button>
              }
            />
            <Button type="button" variant="destructive" disabled={isDeleting} onClick={() => void handleConfirmDelete()}>
              {isDeleting ? (
                <>
                  <Loader2Icon className="animate-spin" aria-hidden="true" />
                  Удаление...
                </>
              ) : (
                "Удалить"
              )}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
