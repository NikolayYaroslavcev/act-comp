import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";
import { DeletedListsSection } from "./deleted-lists-section";
import type { DeletedListSummary } from "@/features/dashboard/dashboard-lists";
import type { TaskList } from "@/entities/list/schema";

function makeDeletedSummary(overrides: Partial<DeletedListSummary>): DeletedListSummary {
  return {
    id: "l4",
    title: "Старый список",
    deletedAt: "2026-08-10T09:00:00.000Z",
    ...overrides,
  };
}

function makeRestoredList(overrides: Partial<TaskList>): TaskList {
  return {
    id: "l4",
    ownerId: "u1",
    title: "Старый список",
    template: "work",
    taskIds: [],
    deadline: null,
    sharedWith: [],
    history: [],
    deletedAt: null,
    lastActivityAt: "2026-08-27T00:00:00.000Z",
    ...overrides,
  };
}

function jsonResponse(status: number, body: unknown) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json" },
  });
}

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("DeletedListsSection", () => {
  it("renders nothing when there are no deleted lists", () => {
    const { container } = render(<DeletedListsSection lists={[]} onRestored={vi.fn()} />);
    expect(container).toBeEmptyDOMElement();
  });

  it("shows a restore action for each deleted list", () => {
    render(
      <DeletedListsSection
        lists={[makeDeletedSummary({ id: "l4", title: "Старый список" })]}
        onRestored={vi.fn()}
      />,
    );

    expect(screen.getByText("Старый список")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /восстановить/i })).toBeInTheDocument();
    expect(screen.queryByTestId("deleted-lists-pagination")).not.toBeInTheDocument();
  });

  it("paginates when there are more deleted lists than one page", async () => {
    const user = userEvent.setup();
    const lists = Array.from({ length: 11 }, (_, index) =>
      makeDeletedSummary({ id: `l${index + 1}`, title: `Удалённый ${index + 1}` }),
    );
    render(<DeletedListsSection lists={lists} onRestored={vi.fn()} />);

    expect(screen.getByText("Удалённый 1", { exact: true })).toBeInTheDocument();
    expect(screen.queryByText("Удалённый 11", { exact: true })).not.toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "Следующая страница" }));

    expect(screen.getByText("Удалённый 11", { exact: true })).toBeInTheDocument();
    expect(screen.queryByText("Удалённый 1", { exact: true })).not.toBeInTheDocument();
  });

  it("calls the restore API when the restore action is clicked", async () => {
    const user = userEvent.setup();
    const restored = makeRestoredList({ id: "l4" });
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(jsonResponse(200, { data: restored })));
    const onRestored = vi.fn();

    render(<DeletedListsSection lists={[makeDeletedSummary({ id: "l4" })]} onRestored={onRestored} />);
    await user.click(screen.getByRole("button", { name: /восстановить/i }));

    await waitFor(() =>
      expect(fetch).toHaveBeenCalledWith("/api/lists/l4/restore", expect.objectContaining({ method: "POST" })),
    );
    await waitFor(() => expect(onRestored).toHaveBeenCalledWith(restored));
  });

  it("disables the restore button and blocks a second submit while pending", async () => {
    const user = userEvent.setup();
    let resolveFetch!: (value: Response) => void;
    const pending = new Promise<Response>((resolve) => {
      resolveFetch = resolve;
    });
    const fetchMock = vi.fn().mockReturnValue(pending);
    vi.stubGlobal("fetch", fetchMock);

    render(<DeletedListsSection lists={[makeDeletedSummary({ id: "l4" })]} onRestored={vi.fn()} />);
    const button = screen.getByRole("button", { name: /восстановить/i });
    await user.click(button);

    expect(screen.getByRole("button", { name: /восстановление/i })).toBeDisabled();
    await user.click(screen.getByRole("button", { name: /восстановление/i }));
    expect(fetchMock).toHaveBeenCalledTimes(1);

    resolveFetch(jsonResponse(200, { data: makeRestoredList({}) }));
    await waitFor(() => expect(screen.getByRole("button", { name: /восстановить/i })).not.toBeDisabled());
  });

  it("shows an error without losing the row when restore fails", async () => {
    const user = userEvent.setup();
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(jsonResponse(409, { error: { message: "The 30-day restore window for this list has expired" } })),
    );
    const onRestored = vi.fn();

    render(<DeletedListsSection lists={[makeDeletedSummary({ id: "l4" })]} onRestored={onRestored} />);
    await user.click(screen.getByRole("button", { name: /восстановить/i }));

    expect(await screen.findByRole("alert")).toHaveTextContent(/30/);
    expect(screen.getByText("Старый список")).toBeInTheDocument();
    expect(onRestored).not.toHaveBeenCalled();
  });
});
