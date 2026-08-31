import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it } from "vitest";
import { ListHistoryDialog } from "./list-history-dialog";
import type { ListHistoryItem } from "@/features/list/list-history";

function makeEntry(overrides: Partial<ListHistoryItem>): ListHistoryItem {
  return {
    field: "title",
    old: "Old title",
    new: "New title",
    at: "2026-08-20T10:00:00.000Z",
    byUserId: "u1",
    actorEmail: "admin@example.com",
    ...overrides,
  };
}

async function openDialog(user: ReturnType<typeof userEvent.setup>) {
  await user.click(screen.getByRole("button", { name: "История" }));
  return screen.getByRole("dialog", { name: "История изменений списка" });
}

describe("ListHistoryDialog", () => {
  it("shows an empty state when there is no recorded history", async () => {
    const user = userEvent.setup();
    render(<ListHistoryDialog history={[]} />);

    await openDialog(user);

    expect(screen.getByText(/пока нет изменений/i)).toBeInTheDocument();
  });

  it("shows the field, old/new values, actor, and date for a change", async () => {
    const user = userEvent.setup();
    render(<ListHistoryDialog history={[makeEntry({})]} />);

    await openDialog(user);

    expect(screen.getByText(/название/i)).toBeInTheDocument();
    expect(screen.getByText(/Old title/)).toBeInTheDocument();
    expect(screen.getByText(/New title/)).toBeInTheDocument();
    expect(screen.getByText(/admin@example\.com/)).toBeInTheDocument();
  });

  it("describes a deletion (deletedAt going from null to a timestamp)", async () => {
    const user = userEvent.setup();
    render(
      <ListHistoryDialog
        history={[makeEntry({ field: "deletedAt", old: null, new: "2026-08-25T00:00:00.000Z" })]}
      />,
    );

    await openDialog(user);

    expect(screen.getByText(/удалил список/i)).toBeInTheDocument();
  });

  it("describes a restoration (deletedAt going from a timestamp to null)", async () => {
    const user = userEvent.setup();
    render(
      <ListHistoryDialog
        history={[makeEntry({ field: "deletedAt", old: "2026-08-25T00:00:00.000Z", new: null })]}
      />,
    );

    await openDialog(user);

    expect(screen.getByText(/восстановил список/i)).toBeInTheDocument();
  });

  it("lists multiple entries in the order given (already newest-first from the server)", async () => {
    const user = userEvent.setup();
    render(
      <ListHistoryDialog
        history={[
          makeEntry({ field: "title", old: "B", new: "C", at: "2026-08-21T00:00:00.000Z" }),
          makeEntry({ field: "title", old: "A", new: "B", at: "2026-08-20T00:00:00.000Z" }),
        ]}
      />,
    );

    await openDialog(user);

    const rows = screen.getAllByTestId("list-history-entry");
    expect(rows).toHaveLength(2);
    expect(rows[0]).toHaveTextContent("B → C");
    expect(rows[1]).toHaveTextContent("A → B");
  });
});
