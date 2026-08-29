"use client";

import { useCallback, useEffect, useState } from "react";
import type { DueNotification } from "@/entities/notification/model";

const POLL_MS = 15_000;
const UNEXPECTED_ERROR_MESSAGE = "Не удалось загрузить уведомления";

export interface UseNotificationsResult {
  notifications: DueNotification[];
  error: string | null;
  dismiss: (key: string) => Promise<void>;
  refresh: () => Promise<void>;
}

export function useNotifications(): UseNotificationsResult {
  const [notifications, setNotifications] = useState<DueNotification[]>([]);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    try {
      const response = await fetch("/api/notifications");
      if (response.status === 401) {
        setNotifications([]);
        setError(null);
        return;
      }
      if (!response.ok) {
        setError(UNEXPECTED_ERROR_MESSAGE);
        return;
      }
      const json = (await response.json().catch(() => null)) as { data?: DueNotification[] } | null;
      if (!json?.data) {
        setError(UNEXPECTED_ERROR_MESSAGE);
        return;
      }
      setError(null);
      setNotifications(json.data);
    } catch {
      setError(UNEXPECTED_ERROR_MESSAGE);
    }
  }, []);

  const dismiss = useCallback(async (key: string) => {
    setNotifications((current) => current.filter((item) => item.key !== key));
    try {
      const response = await fetch("/api/notifications", {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ keys: [key] }),
      });
      if (!response.ok) {
        await refresh();
      }
    } catch {
      await refresh();
    }
  }, [refresh]);

  useEffect(() => {
    const startId = window.setTimeout(() => {
      void refresh();
    }, 0);
    const pollId = window.setInterval(() => {
      void refresh();
    }, POLL_MS);
    return () => {
      window.clearTimeout(startId);
      window.clearInterval(pollId);
    };
  }, [refresh]);

  return { notifications, error, dismiss, refresh };
}
