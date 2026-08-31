import { screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";
import { renderWithStore as render } from "@/shared/store/test-utils";
import { TaskAttachments } from "./task-attachments";
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
    size: 2048,
    mimeType: "application/pdf",
    uploadedAt: "2026-08-19T14:00:00.000Z",
    uploadedBy: "u1",
    uploaderEmail: "admin@example.com",
    ...overrides,
  };
}

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("TaskAttachments (list)", () => {
  it("shows a loading state before attachments arrive", () => {
    vi.stubGlobal("fetch", vi.fn().mockReturnValue(new Promise(() => {})));

    render(<TaskAttachments taskId="t1" canManage />);

    expect(screen.getByTestId("task-attachments-loading")).toBeInTheDocument();
  });

  it("renders filename, size, date, and uploader for each attachment", async () => {
    const attachment = makeAttachment({ filename: "notes.txt", size: 512, uploaderEmail: "user@example.com" });
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(jsonResponse(200, { data: [attachment] })));

    render(<TaskAttachments taskId="t1" canManage />);

    await waitFor(() => expect(screen.queryByTestId("task-attachments-loading")).not.toBeInTheDocument());
    const row = screen.getByTestId("task-attachment");
    expect(row).toHaveTextContent("notes.txt");
    expect(row).toHaveTextContent("512 Б");
    expect(row).toHaveTextContent("user@example.com");
    expect(screen.queryByTestId("task-attachments-pagination")).not.toBeInTheDocument();
  });

  it("paginates when there are more attachments than one page", async () => {
    const user = userEvent.setup();
    const attachments = Array.from({ length: 11 }, (_, index) =>
      makeAttachment({ id: `a${index + 1}`, filename: `file-${index + 1}.pdf` }),
    );
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(jsonResponse(200, { data: attachments })));

    render(<TaskAttachments taskId="t1" />);

    await waitFor(() => expect(screen.queryByTestId("task-attachments-loading")).not.toBeInTheDocument());
    expect(screen.getAllByTestId("task-attachment")).toHaveLength(10);
    expect(screen.queryByText("file-11.pdf")).not.toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "Следующая страница" }));

    expect(screen.getByText("file-11.pdf")).toBeInTheDocument();
    expect(screen.getAllByTestId("task-attachment")).toHaveLength(1);
  });

  it("shows an empty-state message when there are no attachments", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(jsonResponse(200, { data: [] })));

    render(<TaskAttachments taskId="t1" canManage />);

    await waitFor(() => expect(screen.queryByTestId("task-attachments-loading")).not.toBeInTheDocument());
    expect(screen.getByTestId("task-attachments-empty")).toBeInTheDocument();
  });

  it("shows a load error via role=alert", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(jsonResponse(404, { error: { message: "Task not found" } })));

    render(<TaskAttachments taskId="t1" canManage />);

    expect(await screen.findByRole("alert")).toHaveTextContent("Вложения: задача недоступна или была удалена");
  });

  it("wraps a long Unicode filename instead of overflowing (break-words class present)", async () => {
    const longName = "Очень-очень-длинное-имя-файла-которое-должно-переноситься-на-новую-строку-в-мобильной-верстке.pdf";
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(jsonResponse(200, { data: [makeAttachment({ filename: longName })] })));

    render(<TaskAttachments taskId="t1" canManage />);

    const name = await screen.findByTestId("task-attachment-name");
    expect(name).toHaveTextContent(longName);
    expect(name.className).toContain("break-words");
  });
});

describe("TaskAttachments (permissions)", () => {
  it("hides the upload control and delete buttons when canManage is false", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(jsonResponse(200, { data: [makeAttachment({})] })));

    render(<TaskAttachments taskId="t1" canManage={false} />);

    await waitFor(() => expect(screen.queryByTestId("task-attachments-loading")).not.toBeInTheDocument());
    expect(screen.queryByRole("button", { name: "Загрузить файл" })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /Удалить файл/ })).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Скачать" })).toBeInTheDocument();
  });

  it("shows the upload control and delete buttons when canManage is true", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(jsonResponse(200, { data: [makeAttachment({})] })));

    render(<TaskAttachments taskId="t1" canManage />);

    await waitFor(() => expect(screen.queryByTestId("task-attachments-loading")).not.toBeInTheDocument());
    expect(screen.getByRole("button", { name: "Загрузить файл" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Удалить файл/ })).toBeInTheDocument();
  });
});

describe("TaskAttachments (upload)", () => {
  it("uploads the selected file and adds it to the list", async () => {
    const user = userEvent.setup();
    const uploaded = makeAttachment({ id: "a2", filename: "new.txt" });
    const fetchMock = vi.fn((url: string, init?: RequestInit) => {
      if (init?.method === "POST") {
        return Promise.resolve(jsonResponse(201, { data: uploaded }));
      }
      return Promise.resolve(jsonResponse(200, { data: [] }));
    });
    vi.stubGlobal("fetch", fetchMock);

    render(<TaskAttachments taskId="t1" canManage />);
    await waitFor(() => expect(screen.queryByTestId("task-attachments-loading")).not.toBeInTheDocument());

    const input = screen.getByTestId("task-attachment-input");
    const file = new File(["hello"], "new.txt", { type: "text/plain" });
    await user.upload(input, file);

    await waitFor(() => expect(screen.getByTestId("task-attachment")).toHaveTextContent("new.txt"));
    expect(fetchMock).toHaveBeenCalledWith("/api/tasks/t1/files", expect.objectContaining({ method: "POST" }));
  });

  it("disables the upload button while an upload is pending", async () => {
    const user = userEvent.setup();
    let resolveUpload!: (value: Response) => void;
    const pending = new Promise<Response>((resolve) => {
      resolveUpload = resolve;
    });
    const fetchMock = vi.fn((url: string, init?: RequestInit) => {
      if (init?.method === "POST") {
        return pending;
      }
      return Promise.resolve(jsonResponse(200, { data: [] }));
    });
    vi.stubGlobal("fetch", fetchMock);

    render(<TaskAttachments taskId="t1" canManage />);
    await waitFor(() => expect(screen.queryByTestId("task-attachments-loading")).not.toBeInTheDocument());

    const input = screen.getByTestId("task-attachment-input");
    await user.upload(input, new File(["hi"], "a.txt", { type: "text/plain" }));

    expect(await screen.findByRole("button", { name: "Загрузка..." })).toBeDisabled();

    resolveUpload(jsonResponse(201, { data: makeAttachment({ id: "a3" }) }));
    await waitFor(() => expect(screen.getByRole("button", { name: "Загрузить файл" })).not.toBeDisabled());
  });

  it("shows an upload error via role=alert", async () => {
    const user = userEvent.setup();
    const fetchMock = vi.fn((url: string, init?: RequestInit) => {
      if (init?.method === "POST") {
        return Promise.resolve(jsonResponse(413, { error: { message: "File exceeds the maximum allowed size" } }));
      }
      return Promise.resolve(jsonResponse(200, { data: [] }));
    });
    vi.stubGlobal("fetch", fetchMock);

    render(<TaskAttachments taskId="t1" canManage />);
    await waitFor(() => expect(screen.queryByTestId("task-attachments-loading")).not.toBeInTheDocument());

    const input = screen.getByTestId("task-attachment-input");
    await user.upload(input, new File(["hi"], "huge.bin", { type: "application/octet-stream" }));

    expect(await screen.findByRole("alert")).toHaveTextContent("Файл превышает допустимый размер");
  });
});

describe("TaskAttachments (download)", () => {
  it("triggers a download fetch when Download is clicked", async () => {
    const user = userEvent.setup();
    const attachment = makeAttachment({});
    const fetchMock = vi.fn((url: string) => {
      if (typeof url === "string" && url.endsWith(`/files/${attachment.id}`)) {
        return Promise.resolve(new Response(new Uint8Array([1, 2, 3]), { status: 200 }));
      }
      return Promise.resolve(jsonResponse(200, { data: [attachment] }));
    });
    vi.stubGlobal("fetch", fetchMock);
    // downloadBlob touches document APIs jsdom doesn't fully implement.
    vi.spyOn(URL, "createObjectURL").mockReturnValue("blob:mock");
    vi.spyOn(URL, "revokeObjectURL").mockImplementation(() => {});

    render(<TaskAttachments taskId="t1" canManage={false} />);
    await waitFor(() => expect(screen.queryByTestId("task-attachments-loading")).not.toBeInTheDocument());

    await user.click(screen.getByRole("button", { name: "Скачать" }));

    await waitFor(() =>
      expect(fetchMock).toHaveBeenCalledWith(`/api/tasks/t1/files/${attachment.id}`),
    );
  });

  it("shows a download error via role=alert when the request fails", async () => {
    const user = userEvent.setup();
    const attachment = makeAttachment({});
    const fetchMock = vi.fn((url: string) => {
      if (typeof url === "string" && url.endsWith(`/files/${attachment.id}`)) {
        return Promise.resolve(new Response(null, { status: 500 }));
      }
      return Promise.resolve(jsonResponse(200, { data: [attachment] }));
    });
    vi.stubGlobal("fetch", fetchMock);

    render(<TaskAttachments taskId="t1" canManage={false} />);
    await waitFor(() => expect(screen.queryByTestId("task-attachments-loading")).not.toBeInTheDocument());

    await user.click(screen.getByRole("button", { name: "Скачать" }));

    expect(await screen.findByRole("alert")).toHaveTextContent("Не удалось скачать файл");
  });
});

describe("TaskAttachments (delete)", () => {
  it("shows a confirmation dialog naming the file before deleting", async () => {
    const user = userEvent.setup();
    const attachment = makeAttachment({ filename: "important.pdf" });
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(jsonResponse(200, { data: [attachment] })));

    render(<TaskAttachments taskId="t1" canManage />);
    await waitFor(() => expect(screen.queryByTestId("task-attachments-loading")).not.toBeInTheDocument());

    await user.click(screen.getByRole("button", { name: "Удалить файл «important.pdf»" }));

    const dialog = screen.getByRole("dialog", { name: /удалить файл/i });
    expect(dialog).toBeInTheDocument();
    expect(within(dialog).getByText(/important\.pdf/)).toBeInTheDocument();
  });

  it("does not call the API and closes the dialog when Cancel is clicked", async () => {
    const user = userEvent.setup();
    const attachment = makeAttachment({});
    const fetchMock = vi.fn().mockResolvedValue(jsonResponse(200, { data: [attachment] }));
    vi.stubGlobal("fetch", fetchMock);

    render(<TaskAttachments taskId="t1" canManage />);
    await waitFor(() => expect(screen.queryByTestId("task-attachments-loading")).not.toBeInTheDocument());

    await user.click(screen.getByRole("button", { name: /Удалить файл/ }));
    await user.click(screen.getByRole("button", { name: "Отмена" }));

    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    expect(fetchMock).not.toHaveBeenCalledWith(expect.stringContaining("/files/"), expect.objectContaining({ method: "DELETE" }));
  });

  it("deletes the file and removes it from the list when confirmed", async () => {
    const user = userEvent.setup();
    const attachment = makeAttachment({});
    const fetchMock = vi.fn((url: string, init?: RequestInit) => {
      if (init?.method === "DELETE") {
        return Promise.resolve(new Response(null, { status: 204 }));
      }
      return Promise.resolve(jsonResponse(200, { data: [attachment] }));
    });
    vi.stubGlobal("fetch", fetchMock);

    render(<TaskAttachments taskId="t1" canManage />);
    await waitFor(() => expect(screen.queryByTestId("task-attachments-loading")).not.toBeInTheDocument());

    await user.click(screen.getByRole("button", { name: /Удалить файл/ }));
    await user.click(screen.getByRole("button", { name: "Удалить" }));

    await waitFor(() =>
      expect(fetchMock).toHaveBeenCalledWith(`/api/tasks/t1/files/${attachment.id}`, expect.objectContaining({ method: "DELETE" })),
    );
    await waitFor(() => expect(screen.getByTestId("task-attachments-empty")).toBeInTheDocument());
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  });

  it("disables the confirm button and prevents a second submit while deleting", async () => {
    const user = userEvent.setup();
    const attachment = makeAttachment({});
    let resolveDelete!: (value: Response) => void;
    const pending = new Promise<Response>((resolve) => {
      resolveDelete = resolve;
    });
    const fetchMock = vi.fn((url: string, init?: RequestInit) => {
      if (init?.method === "DELETE") {
        return pending;
      }
      return Promise.resolve(jsonResponse(200, { data: [attachment] }));
    });
    vi.stubGlobal("fetch", fetchMock);

    render(<TaskAttachments taskId="t1" canManage />);
    await waitFor(() => expect(screen.queryByTestId("task-attachments-loading")).not.toBeInTheDocument());

    await user.click(screen.getByRole("button", { name: /Удалить файл/ }));
    await user.click(screen.getByRole("button", { name: "Удалить" }));

    const pendingButton = screen.getByRole("button", { name: /Удаление/i });
    expect(pendingButton).toBeDisabled();

    await user.click(pendingButton);
    expect(fetchMock).toHaveBeenCalledTimes(2);

    resolveDelete(new Response(null, { status: 204 }));
    await waitFor(() => expect(screen.queryByRole("dialog")).not.toBeInTheDocument());
  });

  it("shows a delete error and keeps the dialog open for a 403 response", async () => {
    const user = userEvent.setup();
    const attachment = makeAttachment({});
    const fetchMock = vi.fn((url: string, init?: RequestInit) => {
      if (init?.method === "DELETE") {
        return Promise.resolve(jsonResponse(403, { error: { message: "Forbidden" } }));
      }
      return Promise.resolve(jsonResponse(200, { data: [attachment] }));
    });
    vi.stubGlobal("fetch", fetchMock);

    render(<TaskAttachments taskId="t1" canManage />);
    await waitFor(() => expect(screen.queryByTestId("task-attachments-loading")).not.toBeInTheDocument());

    await user.click(screen.getByRole("button", { name: /Удалить файл/ }));
    await user.click(screen.getByRole("button", { name: "Удалить" }));

    expect(await screen.findByRole("alert")).toHaveTextContent(/прав/i);
    expect(screen.getByRole("dialog")).toBeInTheDocument();
  });
});
