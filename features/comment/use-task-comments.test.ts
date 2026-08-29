import { act, renderHook, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { useTaskComments } from "@/features/comment/use-task-comments";
import type { CommentWithAuthor } from "@/entities/comment/dto";

function jsonResponse(status: number, body: unknown) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json" },
  });
}

function makeComment(overrides: Partial<CommentWithAuthor>): CommentWithAuthor {
  return {
    id: "c1",
    taskId: "t1",
    authorId: "u1",
    authorEmail: "admin@example.com",
    text: "Hello",
    createdAt: "2026-08-01T00:00:00.000Z",
    ...overrides,
  };
}

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("useTaskComments (loading)", () => {
  it("loads comments for the given task on mount", async () => {
    const comment = makeComment({});
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(jsonResponse(200, { data: [comment] })));

    const { result } = renderHook(() => useTaskComments("t1"));

    expect(result.current.isLoading).toBe(true);
    await waitFor(() => expect(result.current.isLoading).toBe(false));

    expect(result.current.comments).toEqual([comment]);
    expect(result.current.loadError).toBeNull();
    expect(fetch).toHaveBeenCalledWith("/api/tasks/t1/comments");
  });

  it("shows a not-found message for a 404 response", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(jsonResponse(404, { error: { message: "Task not found" } })));

    const { result } = renderHook(() => useTaskComments("t1"));

    await waitFor(() => expect(result.current.isLoading).toBe(false));
    expect(result.current.loadError).toBe("Комментарии: задача недоступна или была удалена");
  });

  it("shows a session-expired message for a 401 response", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(jsonResponse(401, { error: { message: "Unauthorized" } })));

    const { result } = renderHook(() => useTaskComments("t1"));

    await waitFor(() => expect(result.current.isLoading).toBe(false));
    expect(result.current.loadError).toBe("Комментарии: сессия истекла. Войдите снова");
  });

  it("shows a network error message when the request fails outright", async () => {
    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new TypeError("Failed to fetch")));

    const { result } = renderHook(() => useTaskComments("t1"));

    await waitFor(() => expect(result.current.isLoading).toBe(false));
    expect(result.current.loadError).toBe("Комментарии: нет соединения с сервером. Проверьте подключение к интернету");
  });
});

describe("useTaskComments (addComment)", () => {
  it("POSTs the text and appends the created comment to the list", async () => {
    const created = makeComment({ id: "c2", text: "New comment" });
    const fetchMock = vi.fn();
    fetchMock.mockResolvedValueOnce(jsonResponse(200, { data: [] }));
    fetchMock.mockResolvedValueOnce(jsonResponse(201, { data: created }));
    vi.stubGlobal("fetch", fetchMock);

    const { result } = renderHook(() => useTaskComments("t1"));
    await waitFor(() => expect(result.current.isLoading).toBe(false));

    let ok: boolean | undefined;
    await act(async () => {
      ok = await result.current.addComment("New comment");
    });

    expect(ok).toBe(true);
    expect(result.current.comments).toEqual([created]);
    expect(fetchMock).toHaveBeenLastCalledWith(
      "/api/tasks/t1/comments",
      expect.objectContaining({
        method: "POST",
        body: JSON.stringify({ text: "New comment" }),
      }),
    );
  });

  it("sets isSubmitting while the request is in flight", async () => {
    let resolvePost: (value: Response) => void = () => {};
    const pending = new Promise<Response>((resolve) => {
      resolvePost = resolve;
    });
    const fetchMock = vi.fn();
    fetchMock.mockResolvedValueOnce(jsonResponse(200, { data: [] }));
    fetchMock.mockReturnValueOnce(pending);
    vi.stubGlobal("fetch", fetchMock);

    const { result } = renderHook(() => useTaskComments("t1"));
    await waitFor(() => expect(result.current.isLoading).toBe(false));

    let submitPromise!: Promise<boolean>;
    act(() => {
      submitPromise = result.current.addComment("Hi");
    });

    expect(result.current.isSubmitting).toBe(true);

    resolvePost(jsonResponse(201, { data: makeComment({}) }));
    await act(async () => {
      await submitPromise;
    });

    expect(result.current.isSubmitting).toBe(false);
  });

  it("ignores a second submit while one is still pending", async () => {
    let resolvePost: (value: Response) => void = () => {};
    const pending = new Promise<Response>((resolve) => {
      resolvePost = resolve;
    });
    const fetchMock = vi.fn();
    fetchMock.mockResolvedValueOnce(jsonResponse(200, { data: [] }));
    fetchMock.mockReturnValueOnce(pending);
    vi.stubGlobal("fetch", fetchMock);

    const { result } = renderHook(() => useTaskComments("t1"));
    await waitFor(() => expect(result.current.isLoading).toBe(false));

    let first!: Promise<boolean>;
    let second!: Promise<boolean>;
    act(() => {
      first = result.current.addComment("Hi");
      second = result.current.addComment("Hi again");
    });

    expect(fetchMock).toHaveBeenCalledTimes(2); // 1 load + 1 submit

    resolvePost(jsonResponse(201, { data: makeComment({}) }));
    await act(async () => {
      await Promise.all([first, second]);
    });

    expect(await second).toBe(false);
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it("returns false and sets submitError on a 403 response, without clearing loaded comments", async () => {
    const fetchMock = vi.fn();
    fetchMock.mockResolvedValueOnce(jsonResponse(200, { data: [] }));
    fetchMock.mockResolvedValueOnce(
      jsonResponse(403, { error: { message: "You do not have permission to comment on this task" } }),
    );
    vi.stubGlobal("fetch", fetchMock);

    const { result } = renderHook(() => useTaskComments("t1"));
    await waitFor(() => expect(result.current.isLoading).toBe(false));

    let ok: boolean | undefined;
    await act(async () => {
      ok = await result.current.addComment("Hi");
    });

    expect(ok).toBe(false);
    expect(result.current.submitError).toBe("У вас нет прав добавлять комментарии к этой задаче");
    expect(result.current.comments).toEqual([]);
  });

  it("returns false and sets submitError on a 400 validation response", async () => {
    const fetchMock = vi.fn();
    fetchMock.mockResolvedValueOnce(jsonResponse(200, { data: [] }));
    fetchMock.mockResolvedValueOnce(jsonResponse(400, { error: { message: "Validation failed" } }));
    vi.stubGlobal("fetch", fetchMock);

    const { result } = renderHook(() => useTaskComments("t1"));
    await waitFor(() => expect(result.current.isLoading).toBe(false));

    await act(async () => {
      await result.current.addComment("");
    });

    expect(result.current.submitError).toBe("Комментарий не может быть пустым");
  });

  it("returns false and sets submitError on a network failure", async () => {
    const fetchMock = vi.fn();
    fetchMock.mockResolvedValueOnce(jsonResponse(200, { data: [] }));
    fetchMock.mockRejectedValueOnce(new TypeError("Failed to fetch"));
    vi.stubGlobal("fetch", fetchMock);

    const { result } = renderHook(() => useTaskComments("t1"));
    await waitFor(() => expect(result.current.isLoading).toBe(false));

    await act(async () => {
      await result.current.addComment("Hi");
    });

    expect(result.current.submitError).toBe("Не удалось отправить комментарий: нет соединения с сервером");
  });
});
