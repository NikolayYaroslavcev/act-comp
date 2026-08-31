import { screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";
import { TaskComments } from "./task-comments";
import type { CommentWithAuthor } from "@/entities/comment/dto";
import { renderWithStore as render } from "@/shared/store/test-utils";

function jsonResponse(status: number, body: unknown) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json" },
  });
}

function makeComment(overrides: Partial<CommentWithAuthor>): CommentWithAuthor {
  return {
    id: "c1",
    taskId: "t1",
    authorId: "u1",
    authorEmail: "admin@example.com",
    text: "Привет",
    createdAt: "2026-08-19T14:00:00.000Z",
    ...overrides,
  };
}

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("TaskComments (list)", () => {
  it("shows a loading state before comments arrive", () => {
    vi.stubGlobal("fetch", vi.fn().mockReturnValue(new Promise(() => {})));

    render(<TaskComments taskId="t1" canComment />);

    expect(screen.getByTestId("task-comments-loading")).toBeInTheDocument();
  });

  it("renders author, timestamp and text for each comment", async () => {
    const comment = makeComment({ authorEmail: "user@example.com", text: "Нужны фикстуры" });
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(jsonResponse(200, { data: [comment] })));

    render(<TaskComments taskId="t1" canComment />);

    await waitFor(() => expect(screen.queryByTestId("task-comments-loading")).not.toBeInTheDocument());

    const row = screen.getByTestId("task-comment");
    expect(row).toHaveTextContent("user@example.com");
    expect(row).toHaveTextContent("Нужны фикстуры");
    expect(screen.getByTestId("task-comment-time")).not.toBeEmptyDOMElement();
    expect(screen.queryByTestId("task-comments-pagination")).not.toBeInTheDocument();
  });

  it("paginates when there are more comments than one page", async () => {
    const user = userEvent.setup();
    const comments = Array.from({ length: 11 }, (_, index) =>
      makeComment({ id: `c${index + 1}`, text: `Комментарий ${index + 1}` }),
    );
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(jsonResponse(200, { data: comments })));

    render(<TaskComments taskId="t1" />);

    await waitFor(() => expect(screen.queryByTestId("task-comments-loading")).not.toBeInTheDocument());
    expect(screen.getAllByTestId("task-comment")).toHaveLength(10);
    expect(screen.queryByText("Комментарий 11", { exact: true })).not.toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "Следующая страница" }));

    expect(screen.getByText("Комментарий 11", { exact: true })).toBeInTheDocument();
    expect(screen.getAllByTestId("task-comment")).toHaveLength(1);
  });

  it("shows an empty-state message when there are no comments", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(jsonResponse(200, { data: [] })));

    render(<TaskComments taskId="t1" canComment />);

    await waitFor(() => expect(screen.queryByTestId("task-comments-loading")).not.toBeInTheDocument());
    expect(screen.getByTestId("task-comments-empty")).toBeInTheDocument();
  });

  it("shows a load error via role=alert", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(jsonResponse(404, { error: { message: "Task not found" } })));

    render(<TaskComments taskId="t1" canComment />);

    expect(await screen.findByRole("alert")).toHaveTextContent("Комментарии: задача недоступна или была удалена");
  });
});

describe("TaskComments (form visibility)", () => {
  it("shows the comment form when the user can comment", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(jsonResponse(200, { data: [] })));

    render(<TaskComments taskId="t1" canComment />);

    expect(screen.getByLabelText("Ваш комментарий...")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Добавить комментарий" })).toBeInTheDocument();
  });

  it("hides the comment form for a read-only user", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(jsonResponse(200, { data: [] })));

    render(<TaskComments taskId="t1" canComment={false} />);

    expect(screen.queryByLabelText("Ваш комментарий...")).not.toBeInTheDocument();
  });
});

describe("TaskComments (creating a comment)", () => {
  it("submits the typed text, appends the new comment, and clears the input", async () => {
    const user = userEvent.setup();
    const created = makeComment({ id: "c2", text: "Новый комментарий" });
    const fetchMock = vi.fn();
    fetchMock.mockResolvedValueOnce(jsonResponse(200, { data: [] }));
    fetchMock.mockResolvedValueOnce(jsonResponse(201, { data: created }));
    vi.stubGlobal("fetch", fetchMock);

    render(<TaskComments taskId="t1" canComment />);
    await waitFor(() => expect(screen.queryByTestId("task-comments-loading")).not.toBeInTheDocument());

    const textarea = screen.getByLabelText("Ваш комментарий...");
    await user.type(textarea, "Новый комментарий");
    await user.click(screen.getByRole("button", { name: "Добавить комментарий" }));

    await waitFor(() => expect(screen.getByTestId("task-comment")).toHaveTextContent("Новый комментарий"));
    expect(textarea).toHaveValue("");
  });

  it("disables the submit button while pending and does not send a duplicate request", async () => {
    const user = userEvent.setup();
    let resolvePost: (value: Response) => void = () => {};
    const pending = new Promise<Response>((resolve) => {
      resolvePost = resolve;
    });
    const fetchMock = vi.fn();
    fetchMock.mockResolvedValueOnce(jsonResponse(200, { data: [] }));
    fetchMock.mockReturnValueOnce(pending);
    vi.stubGlobal("fetch", fetchMock);

    render(<TaskComments taskId="t1" canComment />);
    await waitFor(() => expect(screen.queryByTestId("task-comments-loading")).not.toBeInTheDocument());

    const textarea = screen.getByLabelText("Ваш комментарий...");
    await user.type(textarea, "Hi");
    const submitButton = screen.getByRole("button", { name: "Добавить комментарий" });
    await user.click(submitButton);

    expect(submitButton).toBeDisabled();
    const submitCallsBefore = fetchMock.mock.calls.length;
    await user.click(submitButton);
    expect(fetchMock.mock.calls.length).toBe(submitCallsBefore);

    resolvePost(jsonResponse(201, { data: makeComment({ id: "c3", text: "Hi" }) }));
    await waitFor(() => expect(screen.getByRole("button", { name: "Добавить комментарий" })).toBeInTheDocument());
  });

  it("shows a submit error via role=alert and keeps the typed text", async () => {
    const user = userEvent.setup();
    const fetchMock = vi.fn();
    fetchMock.mockResolvedValueOnce(jsonResponse(200, { data: [] }));
    fetchMock.mockResolvedValueOnce(
      jsonResponse(403, { error: { message: "You do not have permission to comment on this task" } }),
    );
    vi.stubGlobal("fetch", fetchMock);

    render(<TaskComments taskId="t1" canComment />);
    await waitFor(() => expect(screen.queryByTestId("task-comments-loading")).not.toBeInTheDocument());

    const textarea = screen.getByLabelText("Ваш комментарий...");
    await user.type(textarea, "Мой текст");
    await user.click(screen.getByRole("button", { name: "Добавить комментарий" }));

    expect(await screen.findByRole("alert")).toHaveTextContent(
      "У вас нет прав добавлять комментарии к этой задаче",
    );
    expect(textarea).toHaveValue("Мой текст");
  });
});
