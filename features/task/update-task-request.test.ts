import { afterEach, describe, expect, it, vi } from "vitest";
import { requestUpdateTask } from "@/features/task/update-task-request";
import type { UpdateTaskInput } from "@/entities/task/requests";

const PATCH_INPUT: UpdateTaskInput = { title: "Updated title" };

function jsonResponse(status: number, body: unknown) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json" },
  });
}

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("requestUpdateTask", () => {
  it("PATCHes the task and resolves with the updated task and cascade on success", async () => {
    const responseBody = {
      data: {
        task: { id: "t1", title: "Updated title" },
        cascade: [{ taskId: "t2", isBlocked: false, recalculatedPriority: 4 }],
      },
    };
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(jsonResponse(200, responseBody)));

    const result = await requestUpdateTask("t1", PATCH_INPUT);

    expect(result).toEqual({ status: "ok", ...responseBody.data });
    expect(fetch).toHaveBeenCalledWith(
      "/api/tasks/t1",
      expect.objectContaining({ method: "PATCH", body: JSON.stringify(PATCH_INPUT) }),
    );
  });

  it("returns a validation message for a 400 response", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(jsonResponse(400, { error: { message: "Validation failed" } })));
    const result = await requestUpdateTask("t1", PATCH_INPUT);
    expect(result).toEqual({ status: "error", message: "Проверьте правильность заполнения полей" });
  });

  it("returns a session-expired message for a 401 response", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(jsonResponse(401, { error: { message: "Unauthorized" } })));
    const result = await requestUpdateTask("t1", PATCH_INPUT);
    expect(result).toEqual({ status: "error", message: "Сессия истекла. Войдите снова" });
  });

  it("returns a forbidden message for a 403 response", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(jsonResponse(403, { error: { message: "Forbidden" } })));
    const result = await requestUpdateTask("t1", PATCH_INPUT);
    expect(result).toEqual({ status: "error", message: "У вас нет прав на редактирование этой задачи" });
  });

  it("returns a not-found message for a 404 response", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(jsonResponse(404, { error: { message: "Not found" } })));
    const result = await requestUpdateTask("t1", PATCH_INPUT);
    expect(result).toEqual({ status: "error", message: "Задача недоступна или была удалена" });
  });

  it("returns a dependency-cycle message for a 409 response", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(jsonResponse(409, { error: { message: "Cycle" } })));
    const result = await requestUpdateTask("t1", PATCH_INPUT);
    expect(result).toEqual({
      status: "error",
      message: "Изменение создаёт цикл зависимостей. Проверьте выбранные зависимости",
    });
  });

  it("returns a network error message when the request fails outright", async () => {
    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new TypeError("Failed to fetch")));
    const result = await requestUpdateTask("t1", PATCH_INPUT);
    expect(result).toEqual({
      status: "error",
      message: "Не удалось соединиться с сервером. Проверьте подключение к интернету",
    });
  });

  it("returns a generic message for an unexpected server error", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(jsonResponse(500, {})));
    const result = await requestUpdateTask("t1", PATCH_INPUT);
    expect(result).toEqual({ status: "error", message: "Что-то пошло не так. Попробуйте ещё раз" });
  });
});
