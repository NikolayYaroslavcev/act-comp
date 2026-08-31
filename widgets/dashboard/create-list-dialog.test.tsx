import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";
import { CreateListDialog } from "./create-list-dialog";
import { chooseSelectOption } from "@/shared/test/ui";
import type { TaskList } from "@/entities/list/schema";

function jsonResponse(status: number, body: unknown) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json" },
  });
}

function makeList(overrides: Partial<TaskList>): TaskList {
  return {
    id: "l2",
    ownerId: "u1",
    title: "New list",
    template: "work",
    taskIds: [],
    deadline: null,
    sharedWith: [],
    history: [],
    deletedAt: null,
    lastActivityAt: "2026-08-01T00:00:00.000Z",
    ...overrides,
  };
}

async function openDialog(user: ReturnType<typeof userEvent.setup>) {
  await user.click(screen.getByRole("button", { name: "Создать список" }));
  return screen.getByRole("dialog", { name: "Новый список" });
}

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("CreateListDialog trigger", () => {
  it("shows a Create List CTA on render", () => {
    render(<CreateListDialog onCreated={vi.fn()} />);

    expect(screen.getByRole("button", { name: "Создать список" })).toBeInTheDocument();
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  });

  it("opens the form dialog on click", async () => {
    const user = userEvent.setup();
    render(<CreateListDialog onCreated={vi.fn()} />);

    await openDialog(user);

    expect(screen.getByLabelText("Название")).toBeInTheDocument();
    expect(screen.getByLabelText("Шаблон")).toBeInTheDocument();
    expect(screen.getByLabelText(/Дедлайн/)).toBeInTheDocument();
  });
});

describe("CreateListDialog validation", () => {
  it("blocks submit and shows an error for an empty title", async () => {
    const user = userEvent.setup();
    vi.stubGlobal("fetch", vi.fn());
    render(<CreateListDialog onCreated={vi.fn()} />);
    await openDialog(user);

    await user.click(screen.getByRole("button", { name: "Создать" }));

    expect(await screen.findAllByRole("alert")).not.toHaveLength(0);
    expect(fetch).not.toHaveBeenCalled();
  });

  it("blocks submit for a title over 200 characters", async () => {
    const user = userEvent.setup();
    vi.stubGlobal("fetch", vi.fn());
    render(<CreateListDialog onCreated={vi.fn()} />);
    await openDialog(user);

    await user.type(screen.getByLabelText("Название"), "a".repeat(201));
    await user.click(screen.getByRole("button", { name: "Создать" }));

    expect(await screen.findAllByRole("alert")).not.toHaveLength(0);
    expect(fetch).not.toHaveBeenCalled();
  });
});

describe("CreateListDialog submission", () => {
  it("submits title, template, and deadline to POST /api/lists", async () => {
    const user = userEvent.setup();
    const created = makeList({ title: "Sprint 35" });
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(jsonResponse(201, { data: created })));
    render(<CreateListDialog onCreated={vi.fn()} />);
    await openDialog(user);

    await user.type(screen.getByLabelText("Название"), "Sprint 35");
    await chooseSelectOption(user, screen.getByLabelText("Шаблон"), "Проект");
    await user.click(screen.getByRole("button", { name: "Создать" }));

    await waitFor(() =>
      expect(fetch).toHaveBeenCalledWith(
        "/api/lists",
        expect.objectContaining({
          method: "POST",
          body: JSON.stringify({ title: "Sprint 35", template: "project", deadline: null }),
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
    render(<CreateListDialog onCreated={vi.fn()} />);
    await openDialog(user);

    await user.type(screen.getByLabelText("Название"), "Sprint 35");
    const submitButton = screen.getByRole("button", { name: "Создать" });
    await user.click(submitButton);

    await waitFor(() => expect(submitButton).toBeDisabled());
    await user.click(submitButton);
    expect(fetchMock).toHaveBeenCalledTimes(1);

    resolveFetch(jsonResponse(201, { data: makeList({}) }));
    await waitFor(() => expect(screen.queryByRole("dialog")).not.toBeInTheDocument());
  });

  it("closes the dialog and reports the created list after a 201", async () => {
    const user = userEvent.setup();
    const created = makeList({ id: "l9", title: "Sprint 35" });
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(jsonResponse(201, { data: created })));
    const onCreated = vi.fn();
    render(<CreateListDialog onCreated={onCreated} />);
    await openDialog(user);

    await user.type(screen.getByLabelText("Название"), "Sprint 35");
    await user.click(screen.getByRole("button", { name: "Создать" }));

    await waitFor(() => expect(onCreated).toHaveBeenCalledWith(created));
    await waitFor(() => expect(screen.queryByRole("dialog")).not.toBeInTheDocument());
  });
});

describe("CreateListDialog error handling", () => {
  it("shows a message for a 400 response and keeps the dialog open with values intact", async () => {
    const user = userEvent.setup();
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(jsonResponse(400, { error: { message: "Bad" } })));
    render(<CreateListDialog onCreated={vi.fn()} />);
    await openDialog(user);

    await user.type(screen.getByLabelText("Название"), "Sprint 35");
    await user.click(screen.getByRole("button", { name: "Создать" }));

    expect(await screen.findByText("Проверьте правильность заполнения полей")).toBeInTheDocument();
    expect(screen.getByRole("dialog")).toBeInTheDocument();
    expect(screen.getByLabelText("Название")).toHaveValue("Sprint 35");
  });

  it("shows a message for a 401 response", async () => {
    const user = userEvent.setup();
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(jsonResponse(401, { error: { message: "Unauthorized" } })));
    render(<CreateListDialog onCreated={vi.fn()} />);
    await openDialog(user);

    await user.type(screen.getByLabelText("Название"), "Sprint 35");
    await user.click(screen.getByRole("button", { name: "Создать" }));

    expect(await screen.findByText("Сессия истекла. Войдите снова")).toBeInTheDocument();
  });

  it("shows a network error message and keeps values intact", async () => {
    const user = userEvent.setup();
    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new TypeError("Failed to fetch")));
    render(<CreateListDialog onCreated={vi.fn()} />);
    await openDialog(user);

    await user.type(screen.getByLabelText("Название"), "Sprint 35");
    await user.click(screen.getByRole("button", { name: "Создать" }));

    expect(
      await screen.findByText("Не удалось соединиться с сервером. Проверьте подключение к интернету"),
    ).toBeInTheDocument();
    expect(screen.getByLabelText("Название")).toHaveValue("Sprint 35");
  });

  it("shows a generic message for an unexpected server error", async () => {
    const user = userEvent.setup();
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(jsonResponse(500, {})));
    render(<CreateListDialog onCreated={vi.fn()} />);
    await openDialog(user);

    await user.type(screen.getByLabelText("Название"), "Sprint 35");
    await user.click(screen.getByRole("button", { name: "Создать" }));

    expect(await screen.findByText("Что-то пошло не так. Попробуйте ещё раз")).toBeInTheDocument();
  });
});

describe("CreateListDialog cancel and reopen", () => {
  it("does not call the API when cancelled", async () => {
    const user = userEvent.setup();
    vi.stubGlobal("fetch", vi.fn());
    render(<CreateListDialog onCreated={vi.fn()} />);
    await openDialog(user);

    await user.type(screen.getByLabelText("Название"), "Sprint 35");
    await user.click(screen.getByRole("button", { name: "Отмена" }));

    expect(fetch).not.toHaveBeenCalled();
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  });

  it("does not retain old values when reopened", async () => {
    const user = userEvent.setup();
    vi.stubGlobal("fetch", vi.fn());
    render(<CreateListDialog onCreated={vi.fn()} />);
    await openDialog(user);

    await user.type(screen.getByLabelText("Название"), "Sprint 35");
    await user.click(screen.getByRole("button", { name: "Отмена" }));

    await openDialog(user);
    expect(screen.getByLabelText("Название")).toHaveValue("");
  });

  it("closes on Escape", async () => {
    const user = userEvent.setup();
    render(<CreateListDialog onCreated={vi.fn()} />);
    await openDialog(user);

    await user.keyboard("{Escape}");

    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  });
});
