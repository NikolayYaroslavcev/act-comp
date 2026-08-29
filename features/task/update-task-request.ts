import type { UpdateTaskInput } from "@/entities/task/requests";
import type { Task } from "@/entities/task/schema";
import type { CascadeUpdate } from "@/entities/task/model";

export const VALIDATION_ERROR_MESSAGE = "Проверьте правильность заполнения полей";
export const SESSION_EXPIRED_MESSAGE = "Сессия истекла. Войдите снова";
export const FORBIDDEN_MESSAGE = "У вас нет прав на редактирование этой задачи";
export const NOT_FOUND_MESSAGE = "Задача недоступна или была удалена";
export const CYCLE_MESSAGE = "Изменение создаёт цикл зависимостей. Проверьте выбранные зависимости";
export const NETWORK_ERROR_MESSAGE = "Не удалось соединиться с сервером. Проверьте подключение к интернету";
export const UNEXPECTED_ERROR_MESSAGE = "Что-то пошло не так. Попробуйте ещё раз";

export type UpdateTaskRequestResult =
  | { status: "ok"; task: Task; cascade: CascadeUpdate[] }
  | { status: "error"; message: string };

const STATUS_MESSAGES: Record<number, string> = {
  400: VALIDATION_ERROR_MESSAGE,
  401: SESSION_EXPIRED_MESSAGE,
  403: FORBIDDEN_MESSAGE,
  404: NOT_FOUND_MESSAGE,
  409: CYCLE_MESSAGE,
};

/**
 * Plain async wrapper around `PATCH /api/tasks/:id` — no component state, so
 * concurrent independent calls (e.g. one per Kanban card) never share or
 * race over isPending/error. useUpdateTask wraps this for the single-caller
 * case (Task Edit form); the Kanban board calls it directly per task.
 */
export async function requestUpdateTask(taskId: string, input: UpdateTaskInput): Promise<UpdateTaskRequestResult> {
  try {
    const response = await fetch(`/api/tasks/${taskId}`, {
      method: "PATCH",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(input),
    });

    const knownMessage = STATUS_MESSAGES[response.status];
    if (knownMessage) {
      return { status: "error", message: knownMessage };
    }

    if (!response.ok) {
      return { status: "error", message: UNEXPECTED_ERROR_MESSAGE };
    }

    const json = (await response.json().catch(() => null)) as
      | { data?: { task: Task; cascade: CascadeUpdate[] } }
      | null;
    if (!json?.data) {
      return { status: "error", message: UNEXPECTED_ERROR_MESSAGE };
    }

    return { status: "ok", task: json.data.task, cascade: json.data.cascade };
  } catch {
    return { status: "error", message: NETWORK_ERROR_MESSAGE };
  }
}
