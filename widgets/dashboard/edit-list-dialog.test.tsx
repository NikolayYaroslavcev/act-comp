import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";
import { EditListDialog } from "./edit-list-dialog";
import { format } from "date-fns";
import { ru } from "date-fns/locale";
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
    id: "l1",
    ownerId: "u1",
    title: "Спринт 34",
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

const BASE_LIST = { id: "l1", title: "Спринт 34", template: "work" as const, deadline: null };

async function openDialog(user: ReturnType<typeof userEvent.setup>, title = "Спринт 34") {
  await user.click(screen.getByRole("button", { name: `Редактировать список «${title}»` }));
  return screen.getByRole("dialog", { name: /редактировать список/i });
}

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("EditListDialog trigger", () => {
  it("shows an edit action naming the list", () => {
    render(<EditListDialog list={BASE_LIST} onUpdated={vi.fn()} />);

    expect(screen.getByRole("button", { name: "Редактировать список «Спринт 34»" })).toBeInTheDocument();
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  });

  it("opens the form dialog on click with prefilled current values", async () => {
    const user = userEvent.setup();
    render(
      <EditListDialog
        list={{ id: "l1", title: "Спринт 34", template: "project", deadline: "2026-10-01T12:00:00.000Z" }}
        onUpdated={vi.fn()}
      />,
    );

    await openDialog(user);

    expect(screen.getByLabelText("Название")).toHaveValue("Спринт 34");
    expect(screen.getByLabelText("Шаблон")).toHaveTextContent("Проект");
    expect(screen.getByLabelText(/Дедлайн/)).toHaveTextContent(
      format(new Date("2026-10-01T12:00:00.000Z"), "d MMM yyyy, HH:mm", { locale: ru }),
    );
  });
});

describe("EditListDialog editing fields", () => {
  it("allows changing the title", async () => {
    const user = userEvent.setup();
    const updated = makeList({ title: "Новое название" });
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(jsonResponse(200, { data: updated })));
    render(<EditListDialog list={BASE_LIST} onUpdated={vi.fn()} />);
    await openDialog(user);

    const titleInput = screen.getByLabelText("Название");
    await user.clear(titleInput);
    await user.type(titleInput, "Новое название");
    await user.click(screen.getByRole("button", { name: "Сохранить" }));

    await waitFor(() =>
      expect(fetch).toHaveBeenCalledWith(
        "/api/lists/l1",
        expect.objectContaining({
          method: "PATCH",
          body: JSON.stringify({ title: "Новое название", template: "work", deadline: null }),
        }),
      ),
    );
  });

  it("allows changing the template", async () => {
    const user = userEvent.setup();
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(jsonResponse(200, { data: makeList({ template: "personal" }) })));
    render(<EditListDialog list={BASE_LIST} onUpdated={vi.fn()} />);
    await openDialog(user);

    await chooseSelectOption(user, screen.getByLabelText("Шаблон"), "Личное");
    await user.click(screen.getByRole("button", { name: "Сохранить" }));

    await waitFor(() =>
      expect(fetch).toHaveBeenCalledWith(
        "/api/lists/l1",
        expect.objectContaining({
          body: JSON.stringify({ title: "Спринт 34", template: "personal", deadline: null }),
        }),
      ),
    );
  });

  it("allows changing the deadline", async () => {
    const user = userEvent.setup();
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(jsonResponse(200, { data: makeList({ deadline: "2026-11-05T10:30:00.000Z" }) })),
    );
    render(<EditListDialog list={BASE_LIST} onUpdated={vi.fn()} />);
    await openDialog(user);

    await user.click(screen.getByLabelText(/Дедлайн/));
    const day = new Date();
    day.setDate(15);
    day.setHours(0, 0, 0, 0);
    const dayButton = document.querySelector(`[data-day="${day.toLocaleDateString("ru")}"]`);
    expect(dayButton).toBeTruthy();
    await user.click(dayButton as HTMLElement);
    const time = screen.getByLabelText("Время");
    fireEvent.change(time, { target: { value: "10:30" } });
    await user.click(screen.getByRole("button", { name: "Сохранить" }));

    const expected = new Date(day);
    expected.setHours(10, 30, 0, 0);
    await waitFor(() =>
      expect(fetch).toHaveBeenCalledWith(
        "/api/lists/l1",
        expect.objectContaining({
          body: JSON.stringify({
            title: "Спринт 34",
            template: "work",
            deadline: expected.toISOString(),
          }),
        }),
      ),
    );
  });
});

describe("EditListDialog submission", () => {
  it("updates the card without a page reload after a successful save", async () => {
    const user = userEvent.setup();
    const updated = makeList({ id: "l1", title: "Обновлённый список" });
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(jsonResponse(200, { data: updated })));
    const onUpdated = vi.fn();
    render(<EditListDialog list={BASE_LIST} onUpdated={onUpdated} />);
    await openDialog(user);

    await user.click(screen.getByRole("button", { name: "Сохранить" }));

    await waitFor(() => expect(onUpdated).toHaveBeenCalledWith(updated));
    await waitFor(() => expect(screen.queryByRole("dialog")).not.toBeInTheDocument());
  });

  it("disables save while pending and blocks a duplicate submit", async () => {
    const user = userEvent.setup();
    let resolveFetch: (value: Response) => void = () => {};
    const pending = new Promise<Response>((resolve) => {
      resolveFetch = resolve;
    });
    const fetchMock = vi.fn().mockReturnValue(pending);
    vi.stubGlobal("fetch", fetchMock);
    render(<EditListDialog list={BASE_LIST} onUpdated={vi.fn()} />);
    await openDialog(user);

    const submitButton = screen.getByRole("button", { name: "Сохранить" });
    await user.click(submitButton);

    await waitFor(() => expect(submitButton).toBeDisabled());
    await user.click(submitButton);
    expect(fetchMock).toHaveBeenCalledTimes(1);

    resolveFetch(jsonResponse(200, { data: makeList({}) }));
    await waitFor(() => expect(screen.queryByRole("dialog")).not.toBeInTheDocument());
  });
});

describe("EditListDialog cancel and reopen", () => {
  it("does not call the API when cancelled", async () => {
    const user = userEvent.setup();
    vi.stubGlobal("fetch", vi.fn());
    render(<EditListDialog list={BASE_LIST} onUpdated={vi.fn()} />);
    await openDialog(user);

    await user.clear(screen.getByLabelText("Название"));
    await user.type(screen.getByLabelText("Название"), "Отменённое изменение");
    await user.click(screen.getByRole("button", { name: "Отмена" }));

    expect(fetch).not.toHaveBeenCalled();
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  });

  it("closes on Escape without calling the API", async () => {
    const user = userEvent.setup();
    vi.stubGlobal("fetch", vi.fn());
    render(<EditListDialog list={BASE_LIST} onUpdated={vi.fn()} />);
    await openDialog(user);

    await user.keyboard("{Escape}");

    await waitFor(() => expect(screen.queryByRole("dialog")).not.toBeInTheDocument());
    expect(fetch).not.toHaveBeenCalled();
  });

  it("shows the current list values again when reopened after props changed", async () => {
    const user = userEvent.setup();
    vi.stubGlobal("fetch", vi.fn());
    const { rerender } = render(<EditListDialog list={BASE_LIST} onUpdated={vi.fn()} />);
    await openDialog(user);
    await user.click(screen.getByRole("button", { name: "Отмена" }));

    rerender(
      <EditListDialog
        list={{ id: "l1", title: "Актуальное название", template: "project", deadline: null }}
        onUpdated={vi.fn()}
      />,
    );
    await openDialog(user, "Актуальное название");

    expect(screen.getByLabelText("Название")).toHaveValue("Актуальное название");
    expect(screen.getByLabelText("Шаблон")).toHaveTextContent("Проект");
  });
});

describe("EditListDialog error handling", () => {
  it("shows a message for a 400 response and keeps the dialog open with values intact", async () => {
    const user = userEvent.setup();
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(jsonResponse(400, { error: { message: "Bad" } })));
    render(<EditListDialog list={BASE_LIST} onUpdated={vi.fn()} />);
    await openDialog(user);

    await user.click(screen.getByRole("button", { name: "Сохранить" }));

    expect(await screen.findByText("Проверьте правильность заполнения полей")).toBeInTheDocument();
    expect(screen.getByRole("dialog")).toBeInTheDocument();
  });

  it("shows a message for a 401 response", async () => {
    const user = userEvent.setup();
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(jsonResponse(401, { error: { message: "Unauthorized" } })));
    render(<EditListDialog list={BASE_LIST} onUpdated={vi.fn()} />);
    await openDialog(user);

    await user.click(screen.getByRole("button", { name: "Сохранить" }));

    expect(await screen.findByText("Сессия истекла. Войдите снова")).toBeInTheDocument();
  });

  it("shows a message for a 403 response", async () => {
    const user = userEvent.setup();
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(jsonResponse(403, { error: { message: "You do not have permission to edit this list" } })),
    );
    render(<EditListDialog list={BASE_LIST} onUpdated={vi.fn()} />);
    await openDialog(user);

    await user.click(screen.getByRole("button", { name: "Сохранить" }));

    expect(await screen.findByRole("alert")).toHaveTextContent(/прав/i);
    expect(screen.getByRole("dialog")).toBeInTheDocument();
  });

  it("shows a message for a 404 response", async () => {
    const user = userEvent.setup();
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(jsonResponse(404, { error: { message: "List not found" } })));
    render(<EditListDialog list={BASE_LIST} onUpdated={vi.fn()} />);
    await openDialog(user);

    await user.click(screen.getByRole("button", { name: "Сохранить" }));

    expect(await screen.findByRole("alert")).toHaveTextContent(/не найден/i);
    expect(screen.getByRole("dialog")).toBeInTheDocument();
  });

  it("shows a network error message and keeps the dialog open", async () => {
    const user = userEvent.setup();
    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new TypeError("Failed to fetch")));
    render(<EditListDialog list={BASE_LIST} onUpdated={vi.fn()} />);
    await openDialog(user);

    await user.click(screen.getByRole("button", { name: "Сохранить" }));

    expect(await screen.findByText("Не удалось соединиться с сервером. Проверьте подключение к интернету")).toBeInTheDocument();
    expect(screen.getByRole("dialog")).toBeInTheDocument();
  });

  it("shows a generic message for an unexpected server error", async () => {
    const user = userEvent.setup();
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(jsonResponse(500, {})));
    render(<EditListDialog list={BASE_LIST} onUpdated={vi.fn()} />);
    await openDialog(user);

    await user.click(screen.getByRole("button", { name: "Сохранить" }));

    expect(await screen.findByText("Что-то пошло не так. Попробуйте ещё раз")).toBeInTheDocument();
  });
});
