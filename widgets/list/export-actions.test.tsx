import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { ExportActions } from "./export-actions";
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

describe("ExportActions", () => {
  beforeEach(() => {
    vi.mocked(downloadBlob).mockReset();
    vi.unstubAllGlobals();
  });

  it("renders CSV and PDF export actions", () => {
    render(<ExportActions listId="l1" listTitle="Спринт" tasks={[]} />);
    expect(screen.getByTestId("list-export-csv")).toBeInTheDocument();
    expect(screen.getByTestId("list-export-pdf")).toBeInTheDocument();
  });

  it("downloads a header-only CSV when there are no tasks", async () => {
    const user = userEvent.setup();
    render(<ExportActions listId="l1" listTitle="Спринт" tasks={[]} />);
    await user.click(screen.getByTestId("list-export-csv"));

    expect(downloadBlob).toHaveBeenCalledTimes(1);
    const [blob, filename] = vi.mocked(downloadBlob).mock.calls[0];
    expect(filename).toBe("Спринт-tasks.csv");
    const text = await blob.text();
    expect(text.replace(/^\uFEFF/, "")).toBe(TASK_CSV_HEADERS.join(","));
  });

  it("downloads only tasks matching the current list filters", async () => {
    const user = userEvent.setup();
    const tasks = [
      makeTask({ id: "t1", title: "backend api", status: "in_progress", priority: 4 }),
      makeTask({ id: "t2", title: "frontend ui", status: "new", priority: 2 }),
    ];
    render(
      <ExportActions
        listId="l1"
        listTitle="Work"
        tasks={[tasks[0]]}
        lookupTasks={tasks}
      />,
    );
    await user.click(screen.getByTestId("list-export-csv"));

    const text = await vi.mocked(downloadBlob).mock.calls[0][0].text();
    expect(text).toContain("backend api");
    expect(text).not.toContain("frontend ui");
  });

  it("disables both actions while PDF generation is pending", async () => {
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
    render(<ExportActions listId="l1" listTitle="Work" tasks={[makeTask()]} />);
    const click = user.click(screen.getByTestId("list-export-pdf"));
    await waitFor(() => expect(screen.getByTestId("list-export-pdf")).toBeDisabled());
    expect(screen.getByTestId("list-export-csv")).toBeDisabled();
    expect(fetch).toHaveBeenCalledTimes(1);
    await user.click(screen.getByTestId("list-export-pdf"));
    expect(fetch).toHaveBeenCalledTimes(1);
    resolvePdf(new Response(new Uint8Array([37, 80, 68, 70]), { status: 200 }));
    await click;
  });

  it("shows an error when PDF generation fails", async () => {
    const user = userEvent.setup();
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response(null, { status: 500 })));
    render(<ExportActions listId="l1" listTitle="Work" tasks={[makeTask()]} />);
    await user.click(screen.getByTestId("list-export-pdf"));
    expect(screen.getByRole("alert")).toHaveTextContent("Не удалось сформировать PDF");
  });
});
