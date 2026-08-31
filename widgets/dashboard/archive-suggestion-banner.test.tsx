import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";
import { ArchiveSuggestionBanner } from "./archive-suggestion-banner";
import type { TaskList } from "@/entities/list/schema";

function jsonResponse(status: number, body: unknown) {
  return new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json" } });
}

function makeDeletedList(): TaskList {
  return {
    id: "l1",
    ownerId: "u1",
    title: "Спринт 34",
    template: "work",
    taskIds: [],
    deadline: null,
    sharedWith: [],
    history: [],
    deletedAt: "2026-08-30T00:00:00.000Z",
    lastActivityAt: "2026-07-01T00:00:00.000Z",
  };
}

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("ArchiveSuggestionBanner", () => {
  it("suggests archiving with the expected copy", () => {
    render(<ArchiveSuggestionBanner list={{ id: "l1", title: "Спринт 34" }} />);
    expect(screen.getByText(/давно не активен/i)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Архивировать" })).toBeInTheDocument();
  });

  it("does not archive without an explicit confirmation", async () => {
    const user = userEvent.setup();
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);
    render(<ArchiveSuggestionBanner list={{ id: "l1", title: "Спринт 34" }} />);

    await user.click(screen.getByRole("button", { name: "Архивировать" }));

    expect(fetchMock).not.toHaveBeenCalled();
    expect(screen.getByRole("dialog")).toBeInTheDocument();
  });

  it("archives (soft-deletes) the list on confirmation and calls onArchived", async () => {
    const user = userEvent.setup();
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(jsonResponse(200, { data: makeDeletedList() })));
    const onArchived = vi.fn();
    render(<ArchiveSuggestionBanner list={{ id: "l1", title: "Спринт 34" }} onArchived={onArchived} />);

    await user.click(screen.getByRole("button", { name: "Архивировать" }));
    await user.click(screen.getByRole("button", { name: "Подтвердить" }));

    await waitFor(() => expect(onArchived).toHaveBeenCalledWith(expect.objectContaining({ id: "l1" })));
  });

  it("can be dismissed for this view without archiving", async () => {
    const user = userEvent.setup();
    render(<ArchiveSuggestionBanner list={{ id: "l1", title: "Спринт 34" }} />);

    await user.click(screen.getByRole("button", { name: "Не сейчас" }));

    expect(screen.queryByText(/давно не активен/i)).not.toBeInTheDocument();
  });

  it("shows an error message when archiving fails", async () => {
    const user = userEvent.setup();
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(jsonResponse(403, { error: { message: "You do not have permission to delete this list" } })),
    );
    render(<ArchiveSuggestionBanner list={{ id: "l1", title: "Спринт 34" }} />);

    await user.click(screen.getByRole("button", { name: "Архивировать" }));
    await user.click(screen.getByRole("button", { name: "Подтвердить" }));

    expect(await screen.findByRole("alert")).toBeInTheDocument();
  });
});
