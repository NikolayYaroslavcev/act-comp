import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";
import { DuplicateListDialog } from "./duplicate-list-dialog";

function jsonResponse(status: number, body: unknown) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json" },
  });
}

const LIST = { id: "l1", title: "Спринт 34" };

async function openDialog(user: ReturnType<typeof userEvent.setup>) {
  await user.click(screen.getByRole("button", { name: "Дублировать список «Спринт 34»" }));
  return screen.getByRole("dialog", { name: "Дублировать список" });
}

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("DuplicateListDialog trigger", () => {
  it("opens the duplicate dialog with content-selection checkboxes", async () => {
    const user = userEvent.setup();
    vi.stubGlobal("fetch", vi.fn());
    render(<DuplicateListDialog list={LIST} />);

    await openDialog(user);

    expect(screen.getByRole("checkbox", { name: /скопировать задачи/i })).toBeInTheDocument();
    expect(screen.getByRole("checkbox", { name: /скопировать доступ/i })).toBeInTheDocument();
  });

  it("does not treat Duplicate as a primary button", async () => {
    render(<DuplicateListDialog list={LIST} />);
    const trigger = screen.getByRole("button", { name: "Дублировать список «Спринт 34»" });
    expect(trigger.className).toMatch(/outline|ghost/);
  });
});

describe("DuplicateListDialog submission", () => {
  it("shows a loading state while the request is in flight", async () => {
    const user = userEvent.setup();
    let resolveFetch: (value: Response) => void = () => {};
    const pending = new Promise<Response>((resolve) => {
      resolveFetch = resolve;
    });
    vi.stubGlobal("fetch", vi.fn().mockReturnValue(pending));
    render(<DuplicateListDialog list={LIST} />);
    await openDialog(user);

    await user.click(screen.getByRole("button", { name: "Дублировать" }));

    expect(screen.getByRole("button", { name: /дублирование/i })).toBeDisabled();

    resolveFetch(jsonResponse(201, { data: { ...LIST, id: "l1-copy", title: "Спринт 34 (копия)" } }));
    await waitFor(() => expect(screen.queryByText(/дублирование\.\.\./i)).not.toBeInTheDocument());
  });

  it("shows a success state with a link to the new list", async () => {
    const user = userEvent.setup();
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(jsonResponse(201, { data: { ...LIST, id: "l1-copy", title: "Спринт 34 (копия)" } })),
    );
    render(<DuplicateListDialog list={LIST} />);
    await openDialog(user);

    await user.click(screen.getByRole("button", { name: "Дублировать" }));

    await waitFor(() => expect(screen.getByTestId("duplicate-list-success")).toBeInTheDocument());
    expect(screen.getByRole("link", { name: /спринт 34 \(копия\)/i })).toHaveAttribute("href", "/lists/l1-copy");
  });

  it("calls onDuplicated with the new list", async () => {
    const user = userEvent.setup();
    const created = { ...LIST, id: "l1-copy", title: "Спринт 34 (копия)" };
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(jsonResponse(201, { data: created })));
    const onDuplicated = vi.fn();
    render(<DuplicateListDialog list={LIST} onDuplicated={onDuplicated} />);
    await openDialog(user);

    await user.click(screen.getByRole("button", { name: "Дублировать" }));

    await waitFor(() => expect(onDuplicated).toHaveBeenCalledWith(expect.objectContaining({ id: "l1-copy" })));
  });

  it("sends the checked content-selection flags", async () => {
    const user = userEvent.setup();
    const fetchMock = vi
      .fn()
      .mockResolvedValue(jsonResponse(201, { data: { ...LIST, id: "l1-copy", title: "Спринт 34 (копия)" } }));
    vi.stubGlobal("fetch", fetchMock);
    render(<DuplicateListDialog list={LIST} />);
    await openDialog(user);

    await user.click(screen.getByRole("checkbox", { name: /скопировать задачи/i }));
    await user.click(screen.getByRole("button", { name: "Дублировать" }));

    await waitFor(() =>
      expect(fetchMock).toHaveBeenCalledWith(
        "/api/lists/l1/duplicate",
        expect.objectContaining({ body: JSON.stringify({ copyTasks: true, copySharedWith: false }) }),
      ),
    );
  });

  it("shows an error message on failure and keeps the dialog usable", async () => {
    const user = userEvent.setup();
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(jsonResponse(403, { error: { message: "You do not have permission to duplicate this list" } })),
    );
    render(<DuplicateListDialog list={LIST} />);
    await openDialog(user);

    await user.click(screen.getByRole("button", { name: "Дублировать" }));

    expect(await screen.findByRole("alert")).toHaveTextContent(/прав/i);
    expect(screen.getByRole("button", { name: "Дублировать" })).toBeInTheDocument();
  });

  it("resets to a fresh form the next time it is opened after a success", async () => {
    const user = userEvent.setup();
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(jsonResponse(201, { data: { ...LIST, id: "l1-copy", title: "Спринт 34 (копия)" } })),
    );
    render(<DuplicateListDialog list={LIST} />);
    await openDialog(user);
    await user.click(screen.getByRole("button", { name: "Дублировать" }));
    await waitFor(() => expect(screen.getByTestId("duplicate-list-success")).toBeInTheDocument());

    await user.click(screen.getByRole("button", { name: "Готово" }));
    await openDialog(user);

    expect(screen.queryByTestId("duplicate-list-success")).not.toBeInTheDocument();
    expect(screen.getByRole("checkbox", { name: /скопировать задачи/i })).not.toBeChecked();
  });
});
