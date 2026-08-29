"use client";

import { useCallback, useState } from "react";
import type { UpdateSettingsInput } from "@/entities/user/requests";
import type { Settings } from "@/entities/user/schema";

const SESSION_EXPIRED_MESSAGE = "Сессия истекла. Войдите снова";
const VALIDATION_ERROR_MESSAGE = "Проверьте правильность заполнения формы";
const NETWORK_ERROR_MESSAGE =
  "Не удалось соединиться с сервером. Проверьте подключение к интернету";
const UNEXPECTED_ERROR_MESSAGE = "Что-то пошло не так. Попробуйте ещё раз";

export interface UseSettingsResult {
  updateSettings: (input: UpdateSettingsInput) => Promise<Settings | null>;
  isPending: boolean;
  error: string | null;
}

export function useSettings(): UseSettingsResult {
  const [isPending, setIsPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const updateSettings = useCallback(async (input: UpdateSettingsInput): Promise<Settings | null> => {
    setIsPending(true);
    setError(null);

    try {
      const response = await fetch("/api/settings", {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(input),
      });

      if (response.status === 401) {
        setError(SESSION_EXPIRED_MESSAGE);
        return null;
      }

      if (response.status === 400) {
        setError(VALIDATION_ERROR_MESSAGE);
        return null;
      }

      if (!response.ok) {
        setError(UNEXPECTED_ERROR_MESSAGE);
        return null;
      }

      const json = (await response.json().catch(() => null)) as { data?: Settings } | null;
      if (!json?.data) {
        setError(UNEXPECTED_ERROR_MESSAGE);
        return null;
      }

      return json.data;
    } catch {
      setError(NETWORK_ERROR_MESSAGE);
      return null;
    } finally {
      setIsPending(false);
    }
  }, []);

  return { updateSettings, isPending, error };
}
