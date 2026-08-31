import type { Task } from "@/entities/task/schema";

const SESSION_EXPIRED_MESSAGE = "Сессия истекла. Войдите снова";
const FORBIDDEN_MESSAGE = "У вас нет прав на просмотр этой задачи";
const NOT_FOUND_MESSAGE = "Задача недоступна или была удалена";
const NETWORK_ERROR_MESSAGE = "Не удалось соединиться с сервером. Проверьте подключение к интернету";
const UNEXPECTED_ERROR_MESSAGE = "Что-то пошло не так. Попробуйте ещё раз";

export type GetTaskRequestResult = { status: "ok"; task: Task } | { status: "error"; message: string };

const STATUS_MESSAGES: Record<number, string> = {
  401: SESSION_EXPIRED_MESSAGE,
  403: FORBIDDEN_MESSAGE,
  404: NOT_FOUND_MESSAGE,
};

/**
 * Plain async wrapper around `GET /api/tasks/:id`, mirroring
 * requestUpdateTask's imperative, non-RTK-Query style — used only to fetch
 * one fresh snapshot when the user explicitly asks to pull in another
 * user's change, not as a subscribed cache entry.
 */
export async function requestGetTask(taskId: string): Promise<GetTaskRequestResult> {
  try {
    const response = await fetch(`/api/tasks/${taskId}`);

    const knownMessage = STATUS_MESSAGES[response.status];
    if (knownMessage) {
      return { status: "error", message: knownMessage };
    }

    if (!response.ok) {
      return { status: "error", message: UNEXPECTED_ERROR_MESSAGE };
    }

    const json = (await response.json().catch(() => null)) as { data?: Task } | null;
    if (!json?.data) {
      return { status: "error", message: UNEXPECTED_ERROR_MESSAGE };
    }

    return { status: "ok", task: json.data };
  } catch {
    return { status: "error", message: NETWORK_ERROR_MESSAGE };
  }
}
