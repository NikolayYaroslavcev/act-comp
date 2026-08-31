"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { AttachmentWithUploader } from "@/entities/attachment/dto";
import { downloadBlob } from "@/shared/lib/export/download";
import { useAppDispatch } from "@/shared/store/hooks";
import { activityApi } from "@/features/activity/activity-api";

const LOAD_SESSION_EXPIRED_MESSAGE = "Вложения: сессия истекла. Войдите снова";
const LOAD_NOT_FOUND_MESSAGE = "Вложения: задача недоступна или была удалена";
const LOAD_NETWORK_ERROR_MESSAGE = "Вложения: нет соединения с сервером. Проверьте подключение к интернету";
const LOAD_UNEXPECTED_ERROR_MESSAGE = "Вложения: не удалось загрузить. Попробуйте ещё раз";

const UPLOAD_SESSION_EXPIRED_MESSAGE = "Не удалось загрузить файл: сессия истекла. Войдите снова";
const UPLOAD_FORBIDDEN_MESSAGE = "У вас нет прав загружать файлы к этой задаче";
const UPLOAD_NOT_FOUND_MESSAGE = "Не удалось загрузить файл: задача недоступна или была удалена";
const UPLOAD_EMPTY_MESSAGE = "Нельзя загрузить пустой файл";
const UPLOAD_TOO_LARGE_MESSAGE = "Файл превышает допустимый размер (5 МБ)";
const UPLOAD_NETWORK_ERROR_MESSAGE = "Не удалось загрузить файл: нет соединения с сервером";
const UPLOAD_UNEXPECTED_ERROR_MESSAGE = "Не удалось загрузить файл. Попробуйте ещё раз";

const DELETE_SESSION_EXPIRED_MESSAGE = "Не удалось удалить файл: сессия истекла. Войдите снова";
const DELETE_FORBIDDEN_MESSAGE = "У вас нет прав удалять файлы этой задачи";
const DELETE_NOT_FOUND_MESSAGE = "Файл не найден или уже был удалён";
const DELETE_NETWORK_ERROR_MESSAGE = "Не удалось удалить файл: нет соединения с сервером";
const DELETE_UNEXPECTED_ERROR_MESSAGE = "Не удалось удалить файл. Попробуйте ещё раз";

const DOWNLOAD_NETWORK_ERROR_MESSAGE = "Не удалось скачать файл: нет соединения с сервером";
const DOWNLOAD_UNEXPECTED_ERROR_MESSAGE = "Не удалось скачать файл. Попробуйте ещё раз";

export interface UseTaskAttachmentsResult {
  attachments: AttachmentWithUploader[];
  isLoading: boolean;
  loadError: string | null;
  upload: (file: File) => Promise<boolean>;
  isUploading: boolean;
  uploadError: string | null;
  remove: (attachmentId: string) => Promise<boolean>;
  pendingDeleteId: string | null;
  deleteError: string | null;
  download: (attachment: AttachmentWithUploader) => Promise<void>;
  downloadError: string | null;
}

/**
 * Client-side wrapper around GET/POST `/api/tasks/:id/files` and
 * GET/DELETE `/api/tasks/:id/files/:fileId`. Owns request state
 * (loading/pending/error) and the loaded list only — permissions and
 * validation stay on the server, this just relays the outcome.
 */
export function useTaskAttachments(taskId: string): UseTaskAttachmentsResult {
  const [attachments, setAttachments] = useState<AttachmentWithUploader[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [isUploading, setIsUploading] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [pendingDeleteId, setPendingDeleteId] = useState<string | null>(null);
  const [deleteError, setDeleteError] = useState<string | null>(null);
  const [downloadError, setDownloadError] = useState<string | null>(null);
  const isUploadingRef = useRef(false);
  const pendingDeleteRef = useRef<string | null>(null);
  const dispatch = useAppDispatch();

  useEffect(() => {
    let cancelled = false;

    async function load() {
      setIsLoading(true);
      setLoadError(null);

      try {
        const response = await fetch(`/api/tasks/${taskId}/files`);
        if (cancelled) {
          return;
        }

        if (response.status === 401) {
          setLoadError(LOAD_SESSION_EXPIRED_MESSAGE);
          return;
        }
        if (response.status === 404) {
          setLoadError(LOAD_NOT_FOUND_MESSAGE);
          return;
        }
        if (!response.ok) {
          setLoadError(LOAD_UNEXPECTED_ERROR_MESSAGE);
          return;
        }

        const json = (await response.json().catch(() => null)) as { data?: unknown } | null;
        if (!json || !Array.isArray(json.data)) {
          setLoadError(LOAD_UNEXPECTED_ERROR_MESSAGE);
          return;
        }

        setAttachments(json.data as AttachmentWithUploader[]);
      } catch {
        if (!cancelled) {
          setLoadError(LOAD_NETWORK_ERROR_MESSAGE);
        }
      } finally {
        if (!cancelled) {
          setIsLoading(false);
        }
      }
    }

    load();

    return () => {
      cancelled = true;
    };
  }, [taskId]);

  const upload = useCallback(
    async (file: File): Promise<boolean> => {
      if (isUploadingRef.current) {
        return false;
      }

      isUploadingRef.current = true;
      setIsUploading(true);
      setUploadError(null);

      try {
        const body = new FormData();
        body.append("file", file);
        const response = await fetch(`/api/tasks/${taskId}/files`, { method: "POST", body });

        if (response.status === 401) {
          setUploadError(UPLOAD_SESSION_EXPIRED_MESSAGE);
          return false;
        }
        if (response.status === 403) {
          setUploadError(UPLOAD_FORBIDDEN_MESSAGE);
          return false;
        }
        if (response.status === 404) {
          setUploadError(UPLOAD_NOT_FOUND_MESSAGE);
          return false;
        }
        if (response.status === 413) {
          setUploadError(UPLOAD_TOO_LARGE_MESSAGE);
          return false;
        }
        if (response.status === 400) {
          setUploadError(UPLOAD_EMPTY_MESSAGE);
          return false;
        }
        if (!response.ok) {
          setUploadError(UPLOAD_UNEXPECTED_ERROR_MESSAGE);
          return false;
        }

        const json = (await response.json().catch(() => null)) as { data?: AttachmentWithUploader } | null;
        if (!json?.data) {
          setUploadError(UPLOAD_UNEXPECTED_ERROR_MESSAGE);
          return false;
        }

        setAttachments((current) => [...current, json.data!]);
        dispatch(activityApi.util.invalidateTags([{ type: "Activity", id: taskId }]));
        return true;
      } catch {
        setUploadError(UPLOAD_NETWORK_ERROR_MESSAGE);
        return false;
      } finally {
        isUploadingRef.current = false;
        setIsUploading(false);
      }
    },
    [dispatch, taskId],
  );

  const remove = useCallback(
    async (attachmentId: string): Promise<boolean> => {
      if (pendingDeleteRef.current !== null) {
        return false;
      }

      pendingDeleteRef.current = attachmentId;
      setPendingDeleteId(attachmentId);
      setDeleteError(null);

      try {
        const response = await fetch(`/api/tasks/${taskId}/files/${attachmentId}`, { method: "DELETE" });

        if (response.status === 401) {
          setDeleteError(DELETE_SESSION_EXPIRED_MESSAGE);
          return false;
        }
        if (response.status === 403) {
          setDeleteError(DELETE_FORBIDDEN_MESSAGE);
          return false;
        }
        if (response.status === 404) {
          setDeleteError(DELETE_NOT_FOUND_MESSAGE);
          return false;
        }
        if (!response.ok) {
          setDeleteError(DELETE_UNEXPECTED_ERROR_MESSAGE);
          return false;
        }

        setAttachments((current) => current.filter((attachment) => attachment.id !== attachmentId));
        dispatch(activityApi.util.invalidateTags([{ type: "Activity", id: taskId }]));
        return true;
      } catch {
        setDeleteError(DELETE_NETWORK_ERROR_MESSAGE);
        return false;
      } finally {
        pendingDeleteRef.current = null;
        setPendingDeleteId(null);
      }
    },
    [dispatch, taskId],
  );

  const download = useCallback(
    async (attachment: AttachmentWithUploader): Promise<void> => {
      setDownloadError(null);

      try {
        const response = await fetch(`/api/tasks/${taskId}/files/${attachment.id}`);
        if (!response.ok) {
          setDownloadError(DOWNLOAD_UNEXPECTED_ERROR_MESSAGE);
          return;
        }

        const buffer = await response.arrayBuffer();
        downloadBlob(new Blob([buffer], { type: attachment.mimeType }), attachment.filename);
      } catch {
        setDownloadError(DOWNLOAD_NETWORK_ERROR_MESSAGE);
      }
    },
    [taskId],
  );

  return {
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
  };
}
