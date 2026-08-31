import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";
import { DeleteListDialog } from "./delete-list-dialog";
import type { TaskList } from "@/entities/list/schema";

function jsonResponse(status: number, body: unknown) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json" },
  });
}

function makeDeletedList(overrides: Partial<TaskList>): TaskList {
  return {
    id: "l7",
    ownerId: "u1",
    title: "Спринт 34",
    template: "work",
    taskIds: [],
    deadline: null,
    sharedWith: [],
    history: [],
    deletedAt: "2026-08-29T12:00:00.000Z",
    lastActivityAt: "2026-08-01T00:00:00.000Z",
    ...overrides,
  };
}

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("DeleteListDialog", () => {
  it("opens a confirmation dialog naming the list when the trigger is clicked", async () => {
    const user = userEvent.setup();
    render(<DeleteListDialog list={{ id: "l1", title: "Спринт 34" }} onDeleted={vi.fn()} />);

    await user.click(screen.getByRole("button", { name: "Удалить список «Спринт 34»" }));

    expect(screen.getByRole("dialog", { name: /удалить список/i })).toBeInTheDocument();
    expect(screen.getByText(/Спринт 34/)).toBeInTheDocument();
  });

  it("does not call the API and closes the dialog when Cancel is clicked", async () => {
    const user = userEvent.setup();
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);
    render(<DeleteListDialog list={{ id: "l1", title: "Спринт 34" }} onDeleted={vi.fn()} />);

    await user.click(screen.getByRole("button", { name: "Удалить список «Спринт 34»" }));
    await user.click(screen.getByRole("button", { name: "Отмена" }));

    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("does not call the API and closes the dialog when Escape is pressed", async () => {
    const user = userEvent.setup();
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);
    render(<DeleteListDialog list={{ id: "l1", title: "Спринт 34" }} onDeleted={vi.fn()} />);

    await user.click(screen.getByRole("button", { name: "Удалить список «Спринт 34»" }));
    await user.keyboard("{Escape}");

    await waitFor(() => expect(screen.queryByRole("dialog")).not.toBeInTheDocument());
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("calls DELETE for the list when Delete is confirmed", async () => {
    const user = userEvent.setup();
    const onDeleted = vi.fn();
    const deleted = makeDeletedList({ id: "l7" });
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(jsonResponse(200, { data: deleted })));
    render(<DeleteListDialog list={{ id: "l7", title: "Спринт 34" }} onDeleted={onDeleted} />);

    await user.click(screen.getByRole("button", { name: "Удалить список «Спринт 34»" }));
    await user.click(screen.getByRole("button", { name: "Удалить" }));

    await waitFor(() =>
      expect(fetch).toHaveBeenCalledWith("/api/lists/l7", expect.objectContaining({ method: "DELETE" })),
    );
    await waitFor(() => expect(onDeleted).toHaveBeenCalledWith(deleted));
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  });

  it("disables the confirm button and prevents a second submit while deleting", async () => {
    const user = userEvent.setup();
    let resolveFetch!: (value: Response) => void;
    const pending = new Promise<Response>((resolve) => {
      resolveFetch = resolve;
    });
    const fetchMock = vi.fn().mockReturnValue(pending);
    vi.stubGlobal("fetch", fetchMock);
    render(<DeleteListDialog list={{ id: "l7", title: "Спринт 34" }} onDeleted={vi.fn()} />);

    await user.click(screen.getByRole("button", { name: "Удалить список «Спринт 34»" }));
    await user.click(screen.getByRole("button", { name: "Удалить" }));

    const pendingButton = screen.getByRole("button", { name: /Удаление/i });
    expect(pendingButton).toBeDisabled();

    await user.click(pendingButton);
    expect(fetchMock).toHaveBeenCalledTimes(1);

    resolveFetch(jsonResponse(200, { data: {} }));
    await waitFor(() => expect(screen.queryByRole("dialog")).not.toBeInTheDocument());
  });

  it("shows an error and keeps the dialog open for a 401 response", async () => {
    const user = userEvent.setup();
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(jsonResponse(401, { error: { message: "Unauthorized" } })));
    render(<DeleteListDialog list={{ id: "l7", title: "Спринт 34" }} onDeleted={vi.fn()} />);

    await user.click(screen.getByRole("button", { name: "Удалить список «Спринт 34»" }));
    await user.click(screen.getByRole("button", { name: "Удалить" }));

    expect(await screen.findByRole("alert")).toHaveTextContent("Сессия истекла");
    expect(screen.getByRole("dialog")).toBeInTheDocument();
  });

  it("shows an error and keeps the dialog open for a 403 response", async () => {
    const user = userEvent.setup();
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(jsonResponse(403, { error: { message: "You do not have permission to delete this list" } })),
    );
    render(<DeleteListDialog list={{ id: "l7", title: "Спринт 34" }} onDeleted={vi.fn()} />);

    await user.click(screen.getByRole("button", { name: "Удалить список «Спринт 34»" }));
    await user.click(screen.getByRole("button", { name: "Удалить" }));

    expect(await screen.findByRole("alert")).toHaveTextContent(/прав/i);
    expect(screen.getByRole("dialog")).toBeInTheDocument();
  });

  it("shows an error and keeps the dialog open for a 404 response", async () => {
    const user = userEvent.setup();
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(jsonResponse(404, { error: { message: "List not found" } })));
    render(<DeleteListDialog list={{ id: "l7", title: "Спринт 34" }} onDeleted={vi.fn()} />);

    await user.click(screen.getByRole("button", { name: "Удалить список «Спринт 34»" }));
    await user.click(screen.getByRole("button", { name: "Удалить" }));

    expect(await screen.findByRole("alert")).toHaveTextContent(/не найден/i);
    expect(screen.getByRole("dialog")).toBeInTheDocument();
  });

  it("shows an error and keeps the dialog open for a network error", async () => {
    const user = userEvent.setup();
    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new TypeError("Failed to fetch")));
    render(<DeleteListDialog list={{ id: "l7", title: "Спринт 34" }} onDeleted={vi.fn()} />);

    await user.click(screen.getByRole("button", { name: "Удалить список «Спринт 34»" }));
    await user.click(screen.getByRole("button", { name: "Удалить" }));

    expect(await screen.findByRole("alert")).toHaveTextContent(/соединиться/i);
    expect(screen.getByRole("dialog")).toBeInTheDocument();
  });

  it("shows an error and keeps the dialog open for an unexpected server error", async () => {
    const user = userEvent.setup();
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(jsonResponse(500, {})));
    render(<DeleteListDialog list={{ id: "l7", title: "Спринт 34" }} onDeleted={vi.fn()} />);

    await user.click(screen.getByRole("button", { name: "Удалить список «Спринт 34»" }));
    await user.click(screen.getByRole("button", { name: "Удалить" }));

    expect(await screen.findByRole("alert")).toHaveTextContent(/что-то пошло не так/i);
    expect(screen.getByRole("dialog")).toBeInTheDocument();
  });
});
