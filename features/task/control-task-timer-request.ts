import type { TimerAction } from "@/entities/task/requests";
import type { Task } from "@/entities/task/schema";

export const SESSION_EXPIRED_MESSAGE = "Сессия истекла. Войдите снова";
export const FORBIDDEN_MESSAGE = "У вас нет прав на управление таймером этой задачи";
export const NOT_FOUND_MESSAGE = "Задача недоступна или была удалена";
export const TASK_COMPLETED_MESSAGE = "Таймер недоступен для завершённой задачи";
export const INVALID_TRANSITION_MESSAGE = "Это действие сейчас недоступно для таймера";
export const NETWORK_ERROR_MESSAGE = "Не удалось соединиться с сервером. Проверьте подключение к интернету";
const UNEXPECTED_ERROR_MESSAGE = "Что-то пошло не так. Попробуйте ещё раз";

export type ControlTaskTimerRequestResult = { status: "ok"; task: Task } | { status: "error"; message: string };

function messageForStatus(status: number, apiMessage: string | undefined): string | undefined {
  if (status === 401) {
    return SESSION_EXPIRED_MESSAGE;
  }
  if (status === 403) {
    return FORBIDDEN_MESSAGE;
  }
  if (status === 404) {
    return NOT_FOUND_MESSAGE;
  }
  if (status === 409 && apiMessage === "Task is completed") {
    return TASK_COMPLETED_MESSAGE;
  }
  if (status === 409) {
    return INVALID_TRANSITION_MESSAGE;
  }
  if (status === 400) {
    return INVALID_TRANSITION_MESSAGE;
  }
  return undefined;
}

export async function requestControlTaskTimer(
  taskId: string,
  action: TimerAction,
): Promise<ControlTaskTimerRequestResult> {
  try {
    const response = await fetch(`/api/tasks/${taskId}/timer`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ action }),
    });

    const json = (await response.json().catch(() => null)) as
      | { data?: Task; error?: { message?: string } }
      | null;

    if (!response.ok) {
      return {
        status: "error",
        message: messageForStatus(response.status, json?.error?.message) ?? UNEXPECTED_ERROR_MESSAGE,
      };
    }

    if (!json?.data) {
      return { status: "error", message: UNEXPECTED_ERROR_MESSAGE };
    }

    return { status: "ok", task: json.data };
  } catch {
    return { status: "error", message: NETWORK_ERROR_MESSAGE };
  }
}
