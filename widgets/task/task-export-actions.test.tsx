import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { TaskExportActions } from "./task-export-actions";
import { TASK_CSV_HEADERS } from "@/shared/lib/export/csv";
import { downloadBlob } from "@/shared/lib/export/download";
import type { Task } from "@/entities/task/schema";

vi.mock("@/shared/lib/export/download", () => ({
  downloadBlob: vi.fn(),
}));

function makeTask(overrides: Partial<Task> = {}): Task {
  return {
    id: "t1",
    listId: "l1",
    code: "TEST-1",
    title: "Task",
    description: "",
    status: "new",
    priority: 3,
    category: null,
    tags: [],
    dependsOn: [],
    parentId: null,
    subtaskIds: [],
    deadline: null,
    createdAt: "2026-08-01T00:00:00.000Z",
    estimatedMin: 0,
    timeSpentMin: 0,
    timerStartedAt: null,
    timerPausedAt: null,
    extensions: [],
    history: [],
    deletedAt: null,
    ...overrides,
  };
}

async function openMenu(user: ReturnType<typeof userEvent.setup>) {
  await user.click(screen.getByTestId("task-export-trigger"));
  await waitFor(() => expect(screen.getByTestId("task-export-csv")).toBeInTheDocument());
}

describe("TaskExportActions", () => {
  beforeEach(() => {
    vi.mocked(downloadBlob).mockReset();
    vi.unstubAllGlobals();
  });

  it("renders CSV, PDF and Excel export actions", async () => {
    const user = userEvent.setup();
    render(<TaskExportActions task={makeTask()} />);
    await openMenu(user);
    expect(screen.getByTestId("task-export-csv")).toBeInTheDocument();
    expect(screen.getByTestId("task-export-pdf")).toBeInTheDocument();
    expect(screen.getByTestId("task-export-xlsx")).toBeInTheDocument();
  });

  it("has accessible names for every export action", async () => {
    const user = userEvent.setup();
    render(<TaskExportActions task={makeTask()} />);
    await openMenu(user);
    expect(screen.getByRole("menuitem", { name: "CSV" })).toBeInTheDocument();
    expect(screen.getByRole("menuitem", { name: "PDF" })).toBeInTheDocument();
    expect(screen.getByRole("menuitem", { name: "Excel" })).toBeInTheDocument();
  });

  it("downloads a CSV containing the task's own fields", async () => {
    const user = userEvent.setup();
    const task = makeTask({ code: "AB-1", title: "Deploy service" });
    render(<TaskExportActions task={task} />);
    await openMenu(user);
    await user.click(screen.getByTestId("task-export-csv"));

    expect(downloadBlob).toHaveBeenCalledTimes(1);
    const [blob, filename] = vi.mocked(downloadBlob).mock.calls[0];
    expect(filename).toBe("AB-1 Deploy service.csv");
    const text = await blob.text();
    expect(text.replace(/^/, "").split("\r\n")[0]).toBe(TASK_CSV_HEADERS.join(","));
    expect(text).toContain("AB-1");
    expect(text).toContain("Deploy service");
  });

  it("resolves parent and dependency codes from listTasks when downloading CSV", async () => {
    const user = userEvent.setup();
    const parent = makeTask({ id: "p1", code: "P-1", title: "Parent" });
    const blocker = makeTask({ id: "b1", code: "B-1", title: "Blocker" });
    const task = makeTask({ id: "c1", code: "C-1", parentId: "p1", dependsOn: ["b1"] });
    render(<TaskExportActions task={task} listTasks={[parent, blocker, task]} />);
    await openMenu(user);
    await user.click(screen.getByTestId("task-export-csv"));

    const text = await vi.mocked(downloadBlob).mock.calls[0][0].text();
    expect(text).toContain("P-1");
    expect(text).toContain("B-1");
  });

  it("requests the PDF from the task-scoped endpoint and downloads the response", async () => {
    const user = userEvent.setup();
    const task = makeTask({ id: "t1", code: "AB-1", title: "Deploy service" });
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(new Response(new Uint8Array([0x25, 0x50, 0x44, 0x46]), { status: 200 })),
    );
    render(<TaskExportActions task={task} />);
    await openMenu(user);
    await user.click(screen.getByTestId("task-export-pdf"));

    await waitFor(() => expect(fetch).toHaveBeenCalledWith("/api/tasks/t1/export/pdf", expect.objectContaining({ method: "POST" })));
    await waitFor(() => expect(downloadBlob).toHaveBeenCalledTimes(1));
    expect(vi.mocked(downloadBlob).mock.calls[0][1]).toBe("AB-1 Deploy service.pdf");
  });

  it("disables all export actions while PDF generation is pending, and blocks a second click", async () => {
    const user = userEvent.setup();
    let resolvePdf: (value: Response) => void = () => {};
    vi.stubGlobal(
      "fetch",
      vi.fn(
        () =>
          new Promise<Response>((resolve) => {
            resolvePdf = resolve;
          }),
      ),
    );
    render(<TaskExportActions task={makeTask()} />);
    await openMenu(user);
    const click = user.click(screen.getByTestId("task-export-pdf"));
    await waitFor(() => expect(screen.getByTestId("task-export-trigger")).toBeDisabled());
    expect(fetch).toHaveBeenCalledTimes(1);
    await user.click(screen.getByTestId("task-export-trigger"));
    expect(fetch).toHaveBeenCalledTimes(1);
    resolvePdf(new Response(new Uint8Array([0x25, 0x50, 0x44, 0x46]), { status: 200 }));
    await click;
  });

  it("shows a visible error, not an alert(), when PDF generation fails", async () => {
    const user = userEvent.setup();
    const alertSpy = vi.spyOn(window, "alert");
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response(null, { status: 500 })));
    render(<TaskExportActions task={makeTask()} />);
    await openMenu(user);
    await user.click(screen.getByTestId("task-export-pdf"));

    expect(await screen.findByRole("alert")).toHaveTextContent("Не удалось сформировать PDF");
    expect(alertSpy).not.toHaveBeenCalled();
  });

  it("shows a 401 error for an expired session on PDF export", async () => {
    const user = userEvent.setup();
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response(null, { status: 401 })));
    render(<TaskExportActions task={makeTask()} />);
    await openMenu(user);
    await user.click(screen.getByTestId("task-export-pdf"));

    expect(await screen.findByRole("alert")).toBeInTheDocument();
  });

  it("shows a network error when PDF export cannot reach the server", async () => {
    const user = userEvent.setup();
    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new TypeError("Failed to fetch")));
    render(<TaskExportActions task={makeTask()} />);
    await openMenu(user);
    await user.click(screen.getByTestId("task-export-pdf"));

    expect(await screen.findByRole("alert")).toBeInTheDocument();
  });

  it("requests Excel from the task-scoped endpoint and downloads the response", async () => {
    const user = userEvent.setup();
    const task = makeTask({ id: "t1", code: "AB-1", title: "Deploy service" });
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(new Response(new Uint8Array([0x50, 0x4b, 0x03, 0x04]), { status: 200 })),
    );
    render(<TaskExportActions task={task} />);
    await openMenu(user);
    await user.click(screen.getByTestId("task-export-xlsx"));

    await waitFor(() =>
      expect(fetch).toHaveBeenCalledWith("/api/tasks/t1/export/xlsx", expect.objectContaining({ method: "POST" })),
    );
    await waitFor(() => expect(downloadBlob).toHaveBeenCalledTimes(1));
    expect(vi.mocked(downloadBlob).mock.calls[0][1]).toBe("AB-1 Deploy service.xlsx");
  });

  it("shows a visible error when Excel generation fails", async () => {
    const user = userEvent.setup();
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response(null, { status: 500 })));
    render(<TaskExportActions task={makeTask()} />);
    await openMenu(user);
    await user.click(screen.getByTestId("task-export-xlsx"));

    expect(await screen.findByRole("alert")).toHaveTextContent("Не удалось сформировать Excel");
  });

  it("disables all export actions while Excel generation is pending", async () => {
    const user = userEvent.setup();
    let resolveXlsx: (value: Response) => void = () => {};
    vi.stubGlobal(
      "fetch",
      vi.fn(
        () =>
          new Promise<Response>((resolve) => {
            resolveXlsx = resolve;
          }),
      ),
    );
    render(<TaskExportActions task={makeTask()} />);
    await openMenu(user);
    const click = user.click(screen.getByTestId("task-export-xlsx"));
    await waitFor(() => expect(screen.getByTestId("task-export-trigger")).toBeDisabled());
    resolveXlsx(new Response(new Uint8Array([0x50, 0x4b, 0x03, 0x04]), { status: 200 }));
    await click;
  });
});
