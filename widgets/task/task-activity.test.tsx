import { screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";
import { renderWithStore as render } from "@/shared/store/test-utils";
import { TaskActivity } from "./task-activity";
import type { TaskActivityItem } from "@/entities/activity/dto";

function jsonResponse(status: number, body: unknown) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json" },
  });
}

function makeItem(overrides: Partial<TaskActivityItem> = {}): TaskActivityItem {
  return {
    id: "a1",
    entityType: "task",
    entityId: "t1",
    action: "updated",
    at: "2026-08-30T10:00:00.000Z",
    byUserId: "u1",
    actorEmail: "admin@example.com",
    metadata: { field: "priority", old: 3, new: 5 },
    ...overrides,
  };
}

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("TaskActivity", () => {
  it("shows a loading state before activity arrives", () => {
    vi.stubGlobal("fetch", vi.fn().mockReturnValue(new Promise(() => {})));

    render(<TaskActivity taskId="t1" />);

    expect(screen.getByTestId("task-activity-loading")).toBeInTheDocument();
  });

  it("shows an empty-state message when there is no activity", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(jsonResponse(200, { data: [] })));

    render(<TaskActivity taskId="t1" />);

    await waitFor(() => expect(screen.queryByTestId("task-activity-loading")).not.toBeInTheDocument());
    expect(screen.getByTestId("task-activity-empty")).toBeInTheDocument();
  });

  it("renders actor, timestamp, type, field change and rollback events", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(
        jsonResponse(200, {
          data: [
            makeItem(),
            makeItem({
              id: "a2",
              action: "rolled_back",
              actorEmail: "user@example.com",
              metadata: { historyIndex: 0 },
            }),
          ],
        }),
      ),
    );

    render(<TaskActivity taskId="t1" />);

    await waitFor(() => expect(screen.queryByTestId("task-activity-loading")).not.toBeInTheDocument());

    const items = screen.getAllByTestId("task-activity-item");
    expect(items[0]).toHaveTextContent("admin@example.com");
    expect(items[0]).toHaveTextContent("изменил приоритет: 3 → 5");
    expect(screen.getAllByTestId("task-activity-time")[0]).not.toBeEmptyDOMElement();
    expect(items[1]).toHaveTextContent("user@example.com");
    expect(items[1]).toHaveTextContent("откатил задачу к предыдущей версии");
    expect(screen.queryByTestId("task-activity-pagination")).not.toBeInTheDocument();
  });

  it("paginates when there are more activity items than one page", async () => {
    const user = userEvent.setup();
    const data = Array.from({ length: 11 }, (_, index) =>
      makeItem({ id: `a${index + 1}`, actorEmail: `user${index + 1}@example.com` }),
    );
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(jsonResponse(200, { data })));

    render(<TaskActivity taskId="t1" />);

    await waitFor(() => expect(screen.queryByTestId("task-activity-loading")).not.toBeInTheDocument());
    expect(screen.getAllByTestId("task-activity-item")).toHaveLength(10);
    expect(screen.queryByText("user11@example.com")).not.toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "Следующая страница" }));

    expect(screen.getByText("user11@example.com")).toBeInTheDocument();
    expect(screen.getAllByTestId("task-activity-item")).toHaveLength(1);
  });

  it("shows a load error via role=alert and retries", async () => {
    const user = userEvent.setup();
    const fetchMock = vi.fn();
    fetchMock.mockResolvedValueOnce(jsonResponse(404, { error: { message: "Task not found" } }));
    fetchMock.mockResolvedValueOnce(jsonResponse(200, { data: [makeItem()] }));
    vi.stubGlobal("fetch", fetchMock);

    render(<TaskActivity taskId="t1" />);

    expect(await screen.findByRole("alert")).toHaveTextContent("История: задача недоступна или была удалена");

    await user.click(screen.getByRole("button", { name: "Повторить" }));

    await waitFor(() => expect(screen.getByTestId("task-activity-item")).toBeInTheDocument());
  });

  it("keeps a long details string wrapping at 390px", async () => {
    const longTitle = "Очень длинное название задачи ".repeat(8);
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(
        jsonResponse(200, {
          data: [makeItem({ metadata: { field: "title", old: longTitle, new: `${longTitle} обновлено` } })],
        }),
      ),
    );

    const { container } = render(
      <div style={{ width: 390 }}>
        <TaskActivity taskId="t1" />
      </div>,
    );

    await waitFor(() => expect(screen.queryByTestId("task-activity-loading")).not.toBeInTheDocument());

    expect(container.firstChild).toHaveStyle({ width: "390px" });
    expect(screen.getByTestId("task-activity-summary")).toHaveClass("break-words");
    expect(screen.getByTestId("task-activity-details")).toHaveClass("break-words");
  });

  it("exposes an accessible heading for the activity region", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(jsonResponse(200, { data: [] })));

    render(<TaskActivity taskId="t1" />);

    expect(await screen.findByRole("heading", { name: "История активности" })).toBeInTheDocument();
    expect(screen.getByTestId("task-activity")).toHaveAttribute("aria-labelledby", "task-activity-heading");
  });
});
