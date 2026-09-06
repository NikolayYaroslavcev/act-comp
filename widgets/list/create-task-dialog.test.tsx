import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";
import { CreateTaskDialog } from "./create-task-dialog";
import type { Task } from "@/entities/task/schema";

function jsonResponse(status: number, body: unknown) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json" },
  });
}

function makeTask(overrides: Partial<Task>): Task {
  return {
    id: "t2",
    listId: "l1",
    code: "TEST-2",
    title: "New task",
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

async function openDialog(user: ReturnType<typeof userEvent.setup>) {
  await user.click(screen.getByRole("button", { name: "Создать задачу" }));
  return screen.getByRole("dialog", { name: "Новая задача" });
}

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("CreateTaskDialog trigger", () => {
  it("shows a Create Task CTA on render", () => {
    render(<CreateTaskDialog listId="l1" onCreated={vi.fn()} />);

    expect(screen.getByRole("button", { name: "Создать задачу" })).toBeInTheDocument();
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  });

  it("opens the form dialog on click", async () => {
    const user = userEvent.setup();
    render(<CreateTaskDialog listId="l1" onCreated={vi.fn()} />);

    await openDialog(user);

    expect(screen.getByLabelText("Название")).toBeInTheDocument();
    expect(screen.getByLabelText("Описание")).toBeInTheDocument();
  });
});

describe("CreateTaskDialog validation", () => {
  it("blocks submit and shows an error for an empty title", async () => {
    const user = userEvent.setup();
    vi.stubGlobal("fetch", vi.fn());
    render(<CreateTaskDialog listId="l1" onCreated={vi.fn()} />);
    await openDialog(user);

    await user.click(screen.getByRole("button", { name: "Создать" }));

    expect(await screen.findAllByRole("alert")).not.toHaveLength(0);
    expect(fetch).not.toHaveBeenCalled();
  });
});

describe("CreateTaskDialog submission", () => {
  it("submits title and listId to POST /api/tasks", async () => {
    const user = userEvent.setup();
    const created = makeTask({ title: "Write report" });
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(jsonResponse(201, { data: created })));
    render(<CreateTaskDialog listId="l1" onCreated={vi.fn()} />);
    await openDialog(user);

    await user.type(screen.getByLabelText("Название"), "Write report");
    await user.click(screen.getByRole("button", { name: "Создать" }));

    await waitFor(() =>
      expect(fetch).toHaveBeenCalledWith(
        "/api/tasks",
        expect.objectContaining({
          method: "POST",
          body: JSON.stringify({
            listId: "l1",
            title: "Write report",
            description: "",
            tags: [],
            parentId: null,
            deadline: null,
          }),
        }),
      ),
    );
  });

  it("disables submit while the request is pending and blocks a duplicate submit", async () => {
    const user = userEvent.setup();
    let resolveFetch: (value: Response) => void = () => {};
    const pending = new Promise<Response>((resolve) => {
      resolveFetch = resolve;
    });
    const fetchMock = vi.fn().mockReturnValue(pending);
    vi.stubGlobal("fetch", fetchMock);
    render(<CreateTaskDialog listId="l1" onCreated={vi.fn()} />);
    await openDialog(user);

    await user.type(screen.getByLabelText("Название"), "Write report");
    const submitButton = screen.getByRole("button", { name: "Создать" });
    await user.click(submitButton);

    await waitFor(() => expect(submitButton).toBeDisabled());
    await user.click(submitButton);
    expect(fetchMock).toHaveBeenCalledTimes(1);

    resolveFetch(jsonResponse(201, { data: makeTask({}) }));
    await waitFor(() => expect(screen.queryByRole("dialog")).not.toBeInTheDocument());
  });

  it("closes the dialog and reports the created task after a 201", async () => {
    const user = userEvent.setup();
    const created = makeTask({ id: "t9", title: "Write report" });
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(jsonResponse(201, { data: created })));
    const onCreated = vi.fn();
    render(<CreateTaskDialog listId="l1" onCreated={onCreated} />);
    await openDialog(user);

    await user.type(screen.getByLabelText("Название"), "Write report");
    await user.click(screen.getByRole("button", { name: "Создать" }));

    await waitFor(() => expect(onCreated).toHaveBeenCalledWith(created));
    await waitFor(() => expect(screen.queryByRole("dialog")).not.toBeInTheDocument());
  });
});

describe("CreateTaskDialog error handling", () => {
  it("shows a message for a 400 response and keeps the dialog open with values intact", async () => {
    const user = userEvent.setup();
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(jsonResponse(400, { error: { message: "Bad" } })));
    render(<CreateTaskDialog listId="l1" onCreated={vi.fn()} />);
    await openDialog(user);

    await user.type(screen.getByLabelText("Название"), "Write report");
    await user.click(screen.getByRole("button", { name: "Создать" }));

    expect(await screen.findByText("Проверьте правильность заполнения полей")).toBeInTheDocument();
    expect(screen.getByRole("dialog")).toBeInTheDocument();
    expect(screen.getByLabelText("Название")).toHaveValue("Write report");
  });

  it("shows a generic message for an unexpected server error", async () => {
    const user = userEvent.setup();
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(jsonResponse(500, {})));
    render(<CreateTaskDialog listId="l1" onCreated={vi.fn()} />);
    await openDialog(user);

    await user.type(screen.getByLabelText("Название"), "Write report");
    await user.click(screen.getByRole("button", { name: "Создать" }));

    expect(await screen.findByText("Что-то пошло не так. Попробуйте ещё раз")).toBeInTheDocument();
  });
});

describe("CreateTaskDialog cancel and reopen", () => {
  it("does not call the API when cancelled", async () => {
    const user = userEvent.setup();
    vi.stubGlobal("fetch", vi.fn());
    render(<CreateTaskDialog listId="l1" onCreated={vi.fn()} />);
    await openDialog(user);

    await user.type(screen.getByLabelText("Название"), "Write report");
    await user.click(screen.getByRole("button", { name: "Отмена" }));

    expect(fetch).not.toHaveBeenCalled();
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  });

  it("does not retain old values when reopened", async () => {
    const user = userEvent.setup();
    vi.stubGlobal("fetch", vi.fn());
    render(<CreateTaskDialog listId="l1" onCreated={vi.fn()} />);
    await openDialog(user);

    await user.type(screen.getByLabelText("Название"), "Write report");
    await user.click(screen.getByRole("button", { name: "Отмена" }));

    await openDialog(user);
    expect(screen.getByLabelText("Название")).toHaveValue("");
  });

  it("closes on Escape", async () => {
    const user = userEvent.setup();
    render(<CreateTaskDialog listId="l1" onCreated={vi.fn()} />);
    await openDialog(user);

    await user.keyboard("{Escape}");

    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  });
});
