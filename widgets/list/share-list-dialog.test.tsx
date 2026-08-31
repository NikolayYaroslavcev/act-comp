import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";
import { ShareListDialog } from "./share-list-dialog";
import { chooseSelectOption } from "@/shared/test/ui";
import type { TaskList } from "@/entities/list/schema";

function jsonResponse(status: number, body: unknown) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json" },
  });
}

function makeList(overrides: Partial<TaskList> = {}): TaskList {
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

async function openDialog(user: ReturnType<typeof userEvent.setup>) {
  await user.click(screen.getByRole("button", { name: "Поделиться" }));
  return screen.getByRole("dialog", { name: "Поделиться списком" });
}

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("ShareListDialog trigger", () => {
  it("opens the sharing dialog", async () => {
    const user = userEvent.setup();
    render(<ShareListDialog list={makeList()} />);

    await openDialog(user);

    expect(screen.getByLabelText(/email или идентификатор/i)).toBeInTheDocument();
    expect(screen.getByLabelText("Доступ")).toBeInTheDocument();
  });
});

describe("ShareListDialog existing shares", () => {
  it("shows current collaborators and their access", async () => {
    const user = userEvent.setup();
    render(
      <ShareListDialog
        list={makeList({
          sharedWith: [
            { userId: "u2", access: "read" },
            { userId: "u3", access: "edit" },
          ],
        })}
      />,
    );

    await openDialog(user);

    expect(screen.getByTestId("share-row-u2")).toHaveTextContent("u2");
    expect(screen.getByTestId("share-access-u2")).toHaveTextContent("Только чтение");
    expect(screen.getByTestId("share-row-u3")).toHaveTextContent("u3");
    expect(screen.getByTestId("share-access-u3")).toHaveTextContent("Редактирование");
    expect(screen.queryByTestId("share-list-pagination")).not.toBeInTheDocument();
  });

  it("paginates when there are more collaborators than one page", async () => {
    const user = userEvent.setup();
    const sharedWith = Array.from({ length: 11 }, (_, index) => ({
      userId: `u${index + 2}`,
      access: "read" as const,
    }));
    render(<ShareListDialog list={makeList({ sharedWith })} />);
    await openDialog(user);

    expect(screen.getByTestId("share-row-u2")).toBeInTheDocument();
    expect(screen.queryByTestId("share-row-u12")).not.toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "Следующая страница" }));

    expect(screen.getByTestId("share-row-u12")).toBeInTheDocument();
    expect(screen.queryByTestId("share-row-u2")).not.toBeInTheDocument();
  });

  it("shows an empty state when nobody is shared with", async () => {
    const user = userEvent.setup();
    render(<ShareListDialog list={makeList({ sharedWith: [] })} />);

    await openDialog(user);

    expect(screen.getByTestId("share-list-empty")).toBeInTheDocument();
  });
});

describe("ShareListDialog add user", () => {
  it("POSTs a new collaborator by email", async () => {
    const user = userEvent.setup();
    const updated = makeList({ sharedWith: [{ userId: "u2", access: "read" }] });
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(jsonResponse(200, { data: updated })));
    render(<ShareListDialog list={makeList()} />);
    await openDialog(user);

    await user.type(screen.getByLabelText(/email или идентификатор/i), "user@example.com");
    await chooseSelectOption(user, screen.getByLabelText("Доступ"), "Только чтение");
    await user.click(screen.getByRole("button", { name: "Добавить" }));

    await waitFor(() =>
      expect(fetch).toHaveBeenCalledWith(
        "/api/lists/l1/share",
        expect.objectContaining({
          method: "POST",
          body: JSON.stringify({ email: "user@example.com", access: "read" }),
        }),
      ),
    );
    expect(await screen.findByTestId("share-row-u2")).toBeInTheDocument();
  });

  it("POSTs a new collaborator by userId when the value is not an email", async () => {
    const user = userEvent.setup();
    const updated = makeList({ sharedWith: [{ userId: "u3", access: "edit" }] });
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(jsonResponse(200, { data: updated })));
    render(<ShareListDialog list={makeList()} />);
    await openDialog(user);

    await user.type(screen.getByLabelText(/email или идентификатор/i), "u3");
    await chooseSelectOption(user, screen.getByLabelText("Доступ"), "Редактирование");
    await user.click(screen.getByRole("button", { name: "Добавить" }));

    await waitFor(() =>
      expect(fetch).toHaveBeenCalledWith(
        "/api/lists/l1/share",
        expect.objectContaining({
          body: JSON.stringify({ userId: "u3", access: "edit" }),
        }),
      ),
    );
  });
});

describe("ShareListDialog change access", () => {
  it("updates access for an existing collaborator", async () => {
    const user = userEvent.setup();
    const updated = makeList({ sharedWith: [{ userId: "u2", access: "edit" }] });
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(jsonResponse(200, { data: updated })));
    render(<ShareListDialog list={makeList({ sharedWith: [{ userId: "u2", access: "read" }] })} />);
    await openDialog(user);

    await chooseSelectOption(user, screen.getByTestId("share-access-u2"), "Редактирование");

    await waitFor(() =>
      expect(fetch).toHaveBeenCalledWith(
        "/api/lists/l1/share",
        expect.objectContaining({
          body: JSON.stringify({ userId: "u2", access: "edit" }),
        }),
      ),
    );
    expect(screen.getByTestId("share-access-u2")).toHaveTextContent("Редактирование");
  });
});

describe("ShareListDialog validation", () => {
  it("blocks submit and shows an error for an empty recipient", async () => {
    const user = userEvent.setup();
    vi.stubGlobal("fetch", vi.fn());
    render(<ShareListDialog list={makeList()} />);
    await openDialog(user);

    await user.click(screen.getByRole("button", { name: "Добавить" }));

    expect(await screen.findAllByRole("alert")).not.toHaveLength(0);
    expect(fetch).not.toHaveBeenCalled();
  });

  it("blocks submit for an invalid email", async () => {
    const user = userEvent.setup();
    vi.stubGlobal("fetch", vi.fn());
    render(<ShareListDialog list={makeList()} />);
    await openDialog(user);

    await user.type(screen.getByLabelText(/email или идентификатор/i), "not-an-email@");
    await user.click(screen.getByRole("button", { name: "Добавить" }));

    expect(await screen.findAllByRole("alert")).not.toHaveLength(0);
    expect(fetch).not.toHaveBeenCalled();
  });
});

describe("ShareListDialog API errors", () => {
  it("shows an API error inline and keeps the typed recipient", async () => {
    const user = userEvent.setup();
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(
        jsonResponse(400, { error: { message: "Unable to share this list with the specified user" } }),
      ),
    );
    render(<ShareListDialog list={makeList()} />);
    await openDialog(user);

    await user.type(screen.getByLabelText(/email или идентификатор/i), "ghost@example.com");
    await user.click(screen.getByRole("button", { name: "Добавить" }));

    expect(await screen.findByRole("alert")).toHaveTextContent(/не удалось выдать доступ/i);
    expect(screen.getByRole("dialog")).toBeInTheDocument();
    expect(screen.getByLabelText(/email или идентификатор/i)).toHaveValue("ghost@example.com");
  });
});

describe("ShareListDialog pending state", () => {
  it("disables add while the request is pending and blocks a duplicate submit", async () => {
    const user = userEvent.setup();
    let resolveFetch: (value: Response) => void = () => {};
    const pending = new Promise<Response>((resolve) => {
      resolveFetch = resolve;
    });
    const fetchMock = vi.fn().mockReturnValue(pending);
    vi.stubGlobal("fetch", fetchMock);
    render(<ShareListDialog list={makeList()} />);
    await openDialog(user);

    await user.type(screen.getByLabelText(/email или идентификатор/i), "user@example.com");
    await user.click(screen.getByRole("button", { name: "Добавить" }));

    expect(screen.getByRole("button", { name: /добавление/i })).toBeDisabled();
    await user.click(screen.getByRole("button", { name: /добавление/i }));
    expect(fetchMock).toHaveBeenCalledTimes(1);

    resolveFetch(jsonResponse(200, { data: makeList({ sharedWith: [{ userId: "u2", access: "read" }] }) }));
    await waitFor(() => expect(screen.getByRole("button", { name: "Добавить" })).toBeEnabled());
  });
});

describe("ShareListDialog cancel and reopen", () => {
  it("does not call the API when cancelled", async () => {
    const user = userEvent.setup();
    vi.stubGlobal("fetch", vi.fn());
    render(<ShareListDialog list={makeList()} />);
    await openDialog(user);

    await user.type(screen.getByLabelText(/email или идентификатор/i), "user@example.com");
    await user.click(screen.getByRole("button", { name: "Отмена" }));

    expect(fetch).not.toHaveBeenCalled();
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  });

  it("shows shares from the latest successful mutation when reopened", async () => {
    const user = userEvent.setup();
    const updated = makeList({
      sharedWith: [
        { userId: "u2", access: "read" },
        { userId: "u3", access: "edit" },
      ],
    });
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(jsonResponse(200, { data: updated })));
    render(<ShareListDialog list={makeList({ sharedWith: [{ userId: "u2", access: "read" }] })} />);
    await openDialog(user);

    await user.type(screen.getByLabelText(/email или идентификатор/i), "u3");
    await chooseSelectOption(user, screen.getByLabelText("Доступ"), "Редактирование");
    await user.click(screen.getByRole("button", { name: "Добавить" }));
    await screen.findByTestId("share-row-u3");

    await user.click(screen.getByRole("button", { name: "Отмена" }));
    await openDialog(user);

    expect(screen.getByTestId("share-row-u2")).toBeInTheDocument();
    expect(screen.getByTestId("share-row-u3")).toBeInTheDocument();
  });

  it("shows updated shares from parent props when reopened after a rerender", async () => {
    const user = userEvent.setup();
    const { rerender } = render(
      <ShareListDialog list={makeList({ sharedWith: [{ userId: "u2", access: "read" }] })} />,
    );
    await openDialog(user);
    await user.click(screen.getByRole("button", { name: "Отмена" }));

    rerender(
      <ShareListDialog
        list={makeList({
          sharedWith: [{ userId: "u3", access: "edit" }],
        })}
      />,
    );
    await openDialog(user);

    expect(screen.queryByTestId("share-row-u2")).not.toBeInTheDocument();
    expect(screen.getByTestId("share-row-u3")).toBeInTheDocument();
  });
});

describe("ShareListDialog revoke", () => {
  it("does not offer a revoke control because the backend has no unshare endpoint", async () => {
    const user = userEvent.setup();
    render(<ShareListDialog list={makeList({ sharedWith: [{ userId: "u2", access: "read" }] })} />);
    await openDialog(user);

    expect(screen.queryByRole("button", { name: /отозвать|удалить доступ/i })).not.toBeInTheDocument();
  });
});

describe("ShareListDialog layout", () => {
  it("keeps the dialog wrapping at 390px without a horizontal overflow class on the user id", async () => {
    const user = userEvent.setup();
    const longId = "user-with-a-very-long-identifier-that-should-wrap";
    const { container } = render(
      <div style={{ width: 390 }}>
        <ShareListDialog list={makeList({ sharedWith: [{ userId: longId, access: "read" }] })} />
      </div>,
    );

    await openDialog(user);

    expect(container.firstChild).toHaveStyle({ width: "390px" });
    expect(screen.getByTestId(`share-user-${longId}`)).toHaveClass("break-words");
  });
});
