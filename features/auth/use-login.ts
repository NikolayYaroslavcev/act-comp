"use client";

import { useCallback, useState } from "react";
import type { LoginInput } from "@/entities/auth/requests";
import type { LoginResult } from "@/features/auth/login";

const INVALID_CREDENTIALS_MESSAGE = "Неверный email или пароль";
const VALIDATION_ERROR_MESSAGE = "Проверьте правильность заполнения формы";
const NETWORK_ERROR_MESSAGE =
  "Не удалось соединиться с сервером. Проверьте подключение к интернету";
const UNEXPECTED_ERROR_MESSAGE = "Что-то пошло не так. Попробуйте ещё раз";

export interface UseLoginResult {
  login: (input: LoginInput) => Promise<LoginResult | null>;
  isPending: boolean;
  error: string | null;
}

/**
 * Client-side wrapper around `POST /api/auth/login`. Owns request state
 * (pending/error) only — credential validation and session creation stay on
 * the server, this just relays the outcome.
 */
export function useLogin(): UseLoginResult {
  const [isPending, setIsPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const login = useCallback(async (input: LoginInput): Promise<LoginResult | null> => {
    setIsPending(true);
    setError(null);

    try {
      const response = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(input),
      });

      if (response.status === 401) {
        setError(INVALID_CREDENTIALS_MESSAGE);
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

      const json = (await response.json().catch(() => null)) as { data?: LoginResult } | null;
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

  return { login, isPending, error };
}
