"use client";

import { useEffect, useState } from "react";
import type { SessionHistoryItem } from "@/entities/session/dto";

const SESSION_EXPIRED_MESSAGE = "Сессия истекла. Войдите снова";
const NETWORK_ERROR_MESSAGE =
  "Не удалось соединиться с сервером. Проверьте подключение к интернету";
const UNEXPECTED_ERROR_MESSAGE = "Что-то пошло не так. Попробуйте ещё раз";

export interface UseSessionsResult {
  sessions: SessionHistoryItem[];
  isLoading: boolean;
  error: string | null;
}

export function useSessions(): UseSessionsResult {
  const [sessions, setSessions] = useState<SessionHistoryItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    async function load() {
      setIsLoading(true);
      setError(null);

      try {
        const response = await fetch("/api/auth/sessions");

        if (cancelled) {
          return;
        }

        if (response.status === 401) {
          setError(SESSION_EXPIRED_MESSAGE);
          setSessions([]);
          return;
        }

        if (!response.ok) {
          setError(UNEXPECTED_ERROR_MESSAGE);
          setSessions([]);
          return;
        }

        const json = (await response.json().catch(() => null)) as {
          data?: { sessions?: SessionHistoryItem[] };
        } | null;
        if (!json?.data?.sessions) {
          setError(UNEXPECTED_ERROR_MESSAGE);
          setSessions([]);
          return;
        }

        setSessions(json.data.sessions);
      } catch {
        if (!cancelled) {
          setError(NETWORK_ERROR_MESSAGE);
          setSessions([]);
        }
      } finally {
        if (!cancelled) {
          setIsLoading(false);
        }
      }
    }

    void load();

    return () => {
      cancelled = true;
    };
  }, []);

  return { sessions, isLoading, error };
}
