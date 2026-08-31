import { waitFor } from "@testing-library/react";
import { act } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { renderHookWithStore } from "@/shared/store/test-utils";
import { useTaskAttachments } from "@/features/attachment/use-task-attachments";
import type { AttachmentWithUploader } from "@/entities/attachment/dto";

function jsonResponse(status: number, body: unknown) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json" },
  });
}

function makeAttachment(overrides: Partial<AttachmentWithUploader>): AttachmentWithUploader {
  return {
    id: "a1",
    taskId: "t1",
    filename: "report.pdf",
    size: 1024,
    mimeType: "application/pdf",
    uploadedAt: "2026-08-01T00:00:00.000Z",
    uploadedBy: "u1",
    uploaderEmail: "admin@example.com",
    ...overrides,
  };
}

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("useTaskAttachments (loading)", () => {
  it("loads attachments for the given task on mount", async () => {
    const attachment = makeAttachment({});
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(jsonResponse(200, { data: [attachment] })));

    const { result } = renderHookWithStore(() => useTaskAttachments("t1"));

    expect(result.current.isLoading).toBe(true);
    await waitFor(() => expect(result.current.isLoading).toBe(false));

    expect(result.current.attachments).toEqual([attachment]);
    expect(result.current.loadError).toBeNull();
    expect(fetch).toHaveBeenCalledWith("/api/tasks/t1/files");
  });

  it("shows a not-found message for a 404 response", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(jsonResponse(404, { error: { message: "Task not found" } })));

    const { result } = renderHookWithStore(() => useTaskAttachments("t1"));

    await waitFor(() => expect(result.current.isLoading).toBe(false));
    expect(result.current.loadError).toBe("Вложения: задача недоступна или была удалена");
  });

  it("shows a session-expired message for a 401 response", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(jsonResponse(401, { error: { message: "Unauthorized" } })));

    const { result } = renderHookWithStore(() => useTaskAttachments("t1"));

    await waitFor(() => expect(result.current.isLoading).toBe(false));
    expect(result.current.loadError).toBe("Вложения: сессия истекла. Войдите снова");
  });

  it("shows a network error message when the request fails outright", async () => {
    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new TypeError("Failed to fetch")));

    const { result } = renderHookWithStore(() => useTaskAttachments("t1"));

    await waitFor(() => expect(result.current.isLoading).toBe(false));
    expect(result.current.loadError).toBe("Вложения: нет соединения с сервером. Проверьте подключение к интернету");
  });
});

describe("useTaskAttachments (upload)", () => {
  it("appends the uploaded attachment on success", async () => {
    const fetchMock = vi.fn((url: string, init?: RequestInit) => {
      if (init?.method === "POST") {
        return Promise.resolve(jsonResponse(201, { data: makeAttachment({ id: "a2" }) }));
      }
      return Promise.resolve(jsonResponse(200, { data: [] }));
    });
    vi.stubGlobal("fetch", fetchMock);

    const { result } = renderHookWithStore(() => useTaskAttachments("t1"));
    await waitFor(() => expect(result.current.isLoading).toBe(false));

    let ok = false;
    await act(async () => {
      ok = await result.current.upload(new File(["hi"], "a.txt", { type: "text/plain" }));
    });

    expect(ok).toBe(true);
    expect(result.current.attachments.map((a) => a.id)).toEqual(["a2"]);
    expect(result.current.uploadError).toBeNull();
  });

  it("shows a forbidden message for a 403 response, without appending anything", async () => {
    const fetchMock = vi.fn((url: string, init?: RequestInit) => {
      if (init?.method === "POST") {
        return Promise.resolve(jsonResponse(403, { error: { message: "Forbidden" } }));
      }
      return Promise.resolve(jsonResponse(200, { data: [] }));
    });
    vi.stubGlobal("fetch", fetchMock);

    const { result } = renderHookWithStore(() => useTaskAttachments("t1"));
    await waitFor(() => expect(result.current.isLoading).toBe(false));

    await act(async () => {
      await result.current.upload(new File(["hi"], "a.txt", { type: "text/plain" }));
    });

    expect(result.current.uploadError).toBe("У вас нет прав загружать файлы к этой задаче");
    expect(result.current.attachments).toEqual([]);
  });

  it("shows a too-large message for a 413 response", async () => {
    const fetchMock = vi.fn((url: string, init?: RequestInit) => {
      if (init?.method === "POST") {
        return Promise.resolve(jsonResponse(413, { error: { message: "File exceeds the maximum allowed size" } }));
      }
      return Promise.resolve(jsonResponse(200, { data: [] }));
    });
    vi.stubGlobal("fetch", fetchMock);

    const { result } = renderHookWithStore(() => useTaskAttachments("t1"));
    await waitFor(() => expect(result.current.isLoading).toBe(false));

    await act(async () => {
      await result.current.upload(new File(["hi"], "a.txt", { type: "text/plain" }));
    });

    expect(result.current.uploadError).toBe("Файл превышает допустимый размер (5 МБ)");
  });

  it("shows an empty-file message for a 400 response", async () => {
    const fetchMock = vi.fn((url: string, init?: RequestInit) => {
      if (init?.method === "POST") {
        return Promise.resolve(jsonResponse(400, { error: { message: "File is empty" } }));
      }
      return Promise.resolve(jsonResponse(200, { data: [] }));
    });
    vi.stubGlobal("fetch", fetchMock);

    const { result } = renderHookWithStore(() => useTaskAttachments("t1"));
    await waitFor(() => expect(result.current.isLoading).toBe(false));

    await act(async () => {
      await result.current.upload(new File([], "empty.txt", { type: "text/plain" }));
    });

    expect(result.current.uploadError).toBe("Нельзя загрузить пустой файл");
  });

  it("ignores a second concurrent upload while one is pending", async () => {
    const fetchMock = vi.fn((url: string, init?: RequestInit) => {
      if (init?.method === "POST") {
        return new Promise<Response>(() => {});
      }
      return Promise.resolve(jsonResponse(200, { data: [] }));
    });
    vi.stubGlobal("fetch", fetchMock);

    const { result } = renderHookWithStore(() => useTaskAttachments("t1"));
    await waitFor(() => expect(result.current.isLoading).toBe(false));

    act(() => {
      void result.current.upload(new File(["hi"], "a.txt"));
    });
    await waitFor(() => expect(result.current.isUploading).toBe(true));

    let secondResult: boolean | undefined;
    await act(async () => {
      secondResult = await result.current.upload(new File(["hi"], "b.txt"));
    });

    expect(secondResult).toBe(false);
  });
});

describe("useTaskAttachments (delete)", () => {
  it("removes the deleted attachment from the list", async () => {
    const attachment = makeAttachment({});
    const fetchMock = vi.fn((url: string, init?: RequestInit) => {
      if (init?.method === "DELETE") {
        return Promise.resolve(new Response(null, { status: 204 }));
      }
      return Promise.resolve(jsonResponse(200, { data: [attachment] }));
    });
    vi.stubGlobal("fetch", fetchMock);

    const { result } = renderHookWithStore(() => useTaskAttachments("t1"));
    await waitFor(() => expect(result.current.isLoading).toBe(false));
    expect(result.current.attachments).toHaveLength(1);

    let ok = false;
    await act(async () => {
      ok = await result.current.remove(attachment.id);
    });

    expect(ok).toBe(true);
    expect(result.current.attachments).toEqual([]);
  });

  it("shows a not-found message for a 404 response, without removing anything else", async () => {
    const attachment = makeAttachment({});
    const fetchMock = vi.fn((url: string, init?: RequestInit) => {
      if (init?.method === "DELETE") {
        return Promise.resolve(jsonResponse(404, { error: { message: "File not found" } }));
      }
      return Promise.resolve(jsonResponse(200, { data: [attachment] }));
    });
    vi.stubGlobal("fetch", fetchMock);

    const { result } = renderHookWithStore(() => useTaskAttachments("t1"));
    await waitFor(() => expect(result.current.isLoading).toBe(false));

    await act(async () => {
      await result.current.remove(attachment.id);
    });

    expect(result.current.deleteError).toBe("Файл не найден или уже был удалён");
    expect(result.current.attachments).toHaveLength(1);
  });
});

describe("useTaskAttachments (download)", () => {
  it("shows a download error when the request fails", async () => {
    const fetchMock = vi.fn((url: string) => {
      if (typeof url === "string" && url.includes("/files/")) {
        return Promise.resolve(new Response(null, { status: 500 }));
      }
      return Promise.resolve(jsonResponse(200, { data: [] }));
    });
    vi.stubGlobal("fetch", fetchMock);

    const { result } = renderHookWithStore(() => useTaskAttachments("t1"));
    await waitFor(() => expect(result.current.isLoading).toBe(false));

    await act(async () => {
      await result.current.download(makeAttachment({}));
    });

    expect(result.current.downloadError).toBe("Не удалось скачать файл. Попробуйте ещё раз");
  });
});
