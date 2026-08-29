import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { createSession } from "@/entities/session/repository";
import { createList, findListById } from "@/entities/list/repository";
import { createTask, insertTasks } from "@/entities/task/repository";
import type { CreateTaskInput } from "@/entities/task/requests";
import { SESSION_COOKIE_NAME } from "@/features/auth/session-cookie";
import ListDetailPage from "./page";

const redirectMock = vi.fn();
const cookiesMock = vi.fn();

vi.mock("next/navigation", () => ({
  redirect: (target: string) => redirectMock(target),
}));

vi.mock("next/headers", () => ({
  cookies: () => cookiesMock(),
}));

function cookieJar(sessionId?: string) {
  return {
    get: (name: string) => (name === SESSION_COOKIE_NAME && sessionId ? { name, value: sessionId } : undefined),
  };
}

function sessionFor(userId: string) {
  return createSession({ userId, ip: "192.0.2.5 (demo)", device: "Chrome on Windows", rememberMe: false });
}

// getCurrentSession resolves the session's userId against the seeded users
// table, so tests must use real seeded user ids (data.json: u1/u2/u3) rather
// than made-up ones — a fabricated id would make getCurrentSession return
// null and every page render redirect to /login regardless of the scenario.
const OWNER = "u1";
const OTHER = "u2";
const THIRD = "u3";

function makeTaskIn(listId: string, overrides: Partial<CreateTaskInput> = {}) {
  return createTask({
    listId,
    title: "Task",
    description: "",
    priority: 3,
    category: null,
    tags: [],
    parentId: null,
    deadline: null,
    estimatedMin: 0,
    ...overrides,
  });
}

async function renderPage(listId: string) {
  return render(await ListDetailPage({ params: Promise.resolve({ id: listId }) }));
}

describe("ListDetailPage — anonymous visitor", () => {
  it("redirects to /login when there is no session cookie", async () => {
    cookiesMock.mockResolvedValue(cookieJar());
    const list = createList(OWNER, { title: "Owned", template: "work", deadline: null });

    await ListDetailPage({ params: Promise.resolve({ id: list.id }) });

    expect(redirectMock).toHaveBeenCalledWith("/login");
  });

  it("redirects to /login for an unknown session id", async () => {
    cookiesMock.mockResolvedValue(cookieJar("does-not-exist"));
    const list = createList(OWNER, { title: "Owned", template: "work", deadline: null });

    await ListDetailPage({ params: Promise.resolve({ id: list.id }) });

    expect(redirectMock).toHaveBeenCalledWith("/login");
  });
});

describe("ListDetailPage — access control", () => {
  it("shows a not-found message for a list the user cannot access", async () => {
    const list = createList(OWNER, { title: "Private list", template: "work", deadline: null });
    const session = sessionFor(OTHER);
    cookiesMock.mockResolvedValue(cookieJar(session.id));

    await renderPage(list.id);

    expect(screen.getByTestId("list-not-found")).toBeInTheDocument();
    expect(screen.queryByTestId("list-export")).not.toBeInTheDocument();
  });

  it("shows a not-found message for an unknown list id", async () => {
    const session = sessionFor(OWNER);
    cookiesMock.mockResolvedValue(cookieJar(session.id));

    await renderPage("does-not-exist");

    expect(screen.getByTestId("list-not-found")).toBeInTheDocument();
  });

  it("shows a not-found message for a soft-deleted list, even for its owner", async () => {
    const list = createList(OWNER, { title: "Deleted list", template: "work", deadline: null });
    findListById(list.id)!.deletedAt = "2026-08-01T00:00:00.000Z";
    const session = sessionFor(OWNER);
    cookiesMock.mockResolvedValue(cookieJar(session.id));

    await renderPage(list.id);

    expect(screen.getByTestId("list-not-found")).toBeInTheDocument();
  });
});

describe("ListDetailPage — accessible lists", () => {
  it("renders the list detail for its owner", async () => {
    const list = createList(OWNER, { title: "Sprint tasks", template: "work", deadline: null });
    makeTaskIn(list.id, { title: "First task" });
    const session = sessionFor(OWNER);
    cookiesMock.mockResolvedValue(cookieJar(session.id));

    await renderPage(list.id);

    expect(screen.getByRole("heading", { name: "Sprint tasks" })).toBeInTheDocument();
    expect(screen.getByText("First task")).toBeInTheDocument();
    expect(screen.getByTestId("list-access-badge")).toHaveTextContent("Владелец");
    expect(screen.getByTestId("list-export")).toBeInTheDocument();
  });

  it("renders the list detail for a shared read-only viewer", async () => {
    const list = createList(OWNER, { title: "Shared list", template: "personal", deadline: null });
    findListById(list.id)!.sharedWith.push({ userId: OTHER, access: "read" });
    makeTaskIn(list.id, { title: "Shared task" });
    const session = sessionFor(OTHER);
    cookiesMock.mockResolvedValue(cookieJar(session.id));

    await renderPage(list.id);

    expect(screen.getByRole("heading", { name: "Shared list" })).toBeInTheDocument();
    expect(screen.getByText("Shared task")).toBeInTheDocument();
    expect(screen.getByTestId("list-access-badge")).toHaveTextContent("Только чтение");
    expect(screen.getByTestId("list-export")).toBeInTheDocument();
  });

  it("renders the list detail for a shared editor", async () => {
    const list = createList(OWNER, { title: "Editable list", template: "project", deadline: null });
    findListById(list.id)!.sharedWith.push({ userId: THIRD, access: "edit" });
    const session = sessionFor(THIRD);
    cookiesMock.mockResolvedValue(cookieJar(session.id));

    await renderPage(list.id);

    expect(screen.getByTestId("list-access-badge")).toHaveTextContent("Редактирование");
    expect(screen.getByTestId("list-export")).toBeInTheDocument();
  });

  it("does not render soft-deleted tasks", async () => {
    const list = createList(OWNER, { title: "List with deleted task", template: "work", deadline: null });
    makeTaskIn(list.id, { title: "Visible task" });
    const deletedTask = makeTaskIn(list.id, { title: "Deleted task" });
    insertTasks([{ ...deletedTask, deletedAt: "2026-08-01T00:00:00.000Z" }]);
    const session = sessionFor(OWNER);
    cookiesMock.mockResolvedValue(cookieJar(session.id));

    await renderPage(list.id);

    expect(screen.getByText("Visible task")).toBeInTheDocument();
    expect(screen.queryByText("Deleted task")).not.toBeInTheDocument();
    expect(screen.getByTestId("list-task-count")).toHaveTextContent(String(1));
  });

  it("shows the empty state for a list with no active tasks", async () => {
    const list = createList(OWNER, { title: "Empty list", template: "work", deadline: null });
    const session = sessionFor(OWNER);
    cookiesMock.mockResolvedValue(cookieJar(session.id));

    await renderPage(list.id);

    expect(screen.getByTestId("task-list-empty-state")).toBeInTheDocument();
  });
});
