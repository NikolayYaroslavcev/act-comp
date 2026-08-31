import { act, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { renderHookWithStore } from "@/shared/store/test-utils";
import { useUpdateTask } from "@/features/task/use-update-task";
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

describe("useUpdateTask", () => {
  it("PATCHes the task and returns the updated task and cascade on success", async () => {
    const responseBody = {
      data: {
        task: { id: "t1", title: "Updated title" },
        cascade: [{ taskId: "t2", isBlocked: false, recalculatedPriority: 4 }],
      },
    };
    const fetchMock = vi.fn().mockResolvedValue(jsonResponse(200, responseBody));
    vi.stubGlobal("fetch", fetchMock);

    const { result } = renderHookWithStore(() => useUpdateTask());

    let returned: unknown;
    await act(async () => {
      returned = await result.current.updateTask("t1", PATCH_INPUT);
    });

    expect(returned).toEqual(responseBody.data);
    expect(result.current.isPending).toBe(false);
    expect(result.current.error).toBeNull();
    const request = fetchMock.mock.calls[0][0] as Request;
    expect(request.url.endsWith("/api/tasks/t1")).toBe(true);
    expect(request.method).toBe("PATCH");
    expect(await request.json()).toEqual(PATCH_INPUT);
  });

  it("sets isPending while the request is in flight", async () => {
    let resolveFetch: (value: Response) => void = () => {};
    const pending = new Promise<Response>((resolve) => {
      resolveFetch = resolve;
    });
    vi.stubGlobal("fetch", vi.fn().mockReturnValue(pending));

    const { result } = renderHookWithStore(() => useUpdateTask());

    let updatePromise!: Promise<unknown>;
    act(() => {
      updatePromise = result.current.updateTask("t1", PATCH_INPUT);
    });

    await waitFor(() => expect(result.current.isPending).toBe(true));

    resolveFetch(jsonResponse(200, { data: { task: {}, cascade: [] } }));
    await act(async () => {
      await updatePromise;
    });

    await waitFor(() => expect(result.current.isPending).toBe(false));
  });

  it("shows a validation message for a 400 response", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(jsonResponse(400, { error: { message: "Validation failed" } })));

    const { result } = renderHookWithStore(() => useUpdateTask());

    let returned: unknown;
    await act(async () => {
      returned = await result.current.updateTask("t1", PATCH_INPUT);
    });

    expect(returned).toBeNull();
    expect(result.current.error).toBe("Проверьте правильность заполнения полей");
  });

  it("shows a session-expired message for a 401 response", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(jsonResponse(401, { error: { message: "Unauthorized" } })));

    const { result } = renderHookWithStore(() => useUpdateTask());

    await act(async () => {
      await result.current.updateTask("t1", PATCH_INPUT);
    });

    expect(result.current.error).toBe("Сессия истекла. Войдите снова");
  });

  it("shows a forbidden message for a 403 response", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(jsonResponse(403, { error: { message: "You do not have permission to edit this task" } })),
    );

    const { result } = renderHookWithStore(() => useUpdateTask());

    await act(async () => {
      await result.current.updateTask("t1", PATCH_INPUT);
    });

    expect(result.current.error).toBe("У вас нет прав на редактирование этой задачи");
  });

  it("shows a not-found message for a 404 response", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(jsonResponse(404, { error: { message: "Task not found" } })));

    const { result } = renderHookWithStore(() => useUpdateTask());

    await act(async () => {
      await result.current.updateTask("t1", PATCH_INPUT);
    });

    expect(result.current.error).toBe("Задача недоступна или была удалена");
  });

  it("shows a dependency-cycle message for a 409 response", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(jsonResponse(409, { error: { message: "Update would create a dependency cycle" } })),
    );

    const { result } = renderHookWithStore(() => useUpdateTask());

    await act(async () => {
      await result.current.updateTask("t1", PATCH_INPUT);
    });

    expect(result.current.error).toBe("Изменение создаёт цикл зависимостей. Проверьте выбранные зависимости");
  });

  it("shows a network error message when the request fails outright", async () => {
    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new TypeError("Failed to fetch")));

    const { result } = renderHookWithStore(() => useUpdateTask());

    await act(async () => {
      await result.current.updateTask("t1", PATCH_INPUT);
    });

    expect(result.current.error).toBe("Не удалось соединиться с сервером. Проверьте подключение к интернету");
    expect(result.current.isPending).toBe(false);
  });

  it("shows a generic message for an unexpected server error", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(jsonResponse(500, {})));

    const { result } = renderHookWithStore(() => useUpdateTask());

    await act(async () => {
      await result.current.updateTask("t1", PATCH_INPUT);
    });

    expect(result.current.error).toBe("Что-то пошло не так. Попробуйте ещё раз");
  });
});
