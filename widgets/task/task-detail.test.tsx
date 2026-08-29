import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";
import { TaskDetail } from "./task-detail";
import type { Task } from "@/entities/task/schema";

function jsonResponse(status: number, body: unknown) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json" },
  });
}

// TaskDetail now mounts TaskComments alongside the rest of its view, which
// fetches `/api/tasks/:id/comments` on its own as soon as the dialog opens.
// Tests below exercise task-level mutations (save/clone) and stub a single
// canned Response for those — but a Response body can only be read once, so
// routing the comments request to its own fresh response (rather than
// letting it consume the same body the task-level hook needs) keeps that
// unrelated background request from starving the assertion under test.
function stubFetchForTaskAction(handler: (url: string, init?: RequestInit) => Promise<Response> | Response) {
  const fetchMock = vi.fn((url: string, init?: RequestInit) => {
    if (url.endsWith("/comments")) {
      return Promise.resolve(jsonResponse(200, { data: [] }));
    }
    return handler(url, init);
  });
  vi.stubGlobal("fetch", fetchMock);
  return fetchMock;
}

afterEach(() => {
  vi.unstubAllGlobals();
});

function makeTask(overrides: Partial<Task>): Task {
  return {
    id: "t1",
    listId: "l1",
    code: "TEST-1",
    title: "Написать тесты",
    description: "Покрыть модель тестами",
    status: "new",
    priority: 3,
    category: null,
    tags: [],
    dependsOn: [],
    parentId: null,
    subtaskIds: [],
    deadline: null,
    createdAt: "2026-08-01T00:00:00.000Z",
    estimatedMin: 0,
    timeSpentMin: 0,
    timerStartedAt: null,
    timerPausedAt: null,
    extensions: [],
    history: [],
    deletedAt: null,
    ...overrides,
  };
}

describe("TaskDetail", () => {
  it("does not render dialog content when closed", () => {
    render(
      <TaskDetail
        task={makeTask({})}
        dependencyCodes={[]}
        open={false}
        onOpenChange={vi.fn()}
      />,
    );

    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  });

  it("shows an accessible dialog with the task code and title", () => {
    render(
      <TaskDetail
        task={makeTask({ code: "TEST-7", title: "Настроить CI" })}
        dependencyCodes={[]}
        open
        onOpenChange={vi.fn()}
      />,
    );

    expect(screen.getByRole("dialog", { name: /TEST-7/ })).toBeInTheDocument();
    expect(screen.getByRole("dialog", { name: /Настроить CI/ })).toBeInTheDocument();
  });

  it("shows the description", () => {
    render(
      <TaskDetail
        task={makeTask({ description: "Подробное описание задачи" })}
        dependencyCodes={[]}
        open
        onOpenChange={vi.fn()}
      />,
    );

    expect(screen.getByTestId("task-detail-description")).toHaveTextContent("Подробное описание задачи");
  });

  it("shows a placeholder when description is empty", () => {
    render(
      <TaskDetail
        task={makeTask({ description: "" })}
        dependencyCodes={[]}
        open
        onOpenChange={vi.fn()}
      />,
    );

    expect(screen.getByTestId("task-detail-description")).toHaveTextContent("Без описания");
  });

  it("shows the status", () => {
    render(
      <TaskDetail
        task={makeTask({ status: "in_progress" })}
        dependencyCodes={[]}
        open
        onOpenChange={vi.fn()}
      />,
    );

    expect(screen.getByTestId("task-detail-status")).toHaveTextContent("В работе");
  });

  it("shows the priority", () => {
    render(
      <TaskDetail
        task={makeTask({ priority: 5 })}
        dependencyCodes={[]}
        open
        onOpenChange={vi.fn()}
      />,
    );

    expect(screen.getByTestId("task-detail-priority")).toHaveTextContent("5");
  });

  it("shows the category when present", () => {
    render(
      <TaskDetail
        task={makeTask({ category: "Backend" })}
        dependencyCodes={[]}
        open
        onOpenChange={vi.fn()}
      />,
    );

    expect(screen.getByTestId("task-detail-category")).toHaveTextContent("Backend");
  });

  it("shows a placeholder when category is null", () => {
    render(
      <TaskDetail
        task={makeTask({ category: null })}
        dependencyCodes={[]}
        open
        onOpenChange={vi.fn()}
      />,
    );

    expect(screen.getByTestId("task-detail-category")).toHaveTextContent("Без категории");
  });

  it("shows tags", () => {
    render(
      <TaskDetail
        task={makeTask({ tags: ["urgent", "backend"] })}
        dependencyCodes={[]}
        open
        onOpenChange={vi.fn()}
      />,
    );

    expect(screen.getByText("#urgent")).toBeInTheDocument();
    expect(screen.getByText("#backend")).toBeInTheDocument();
  });

  it("shows a placeholder when there are no tags", () => {
    render(
      <TaskDetail
        task={makeTask({ tags: [] })}
        dependencyCodes={[]}
        open
        onOpenChange={vi.fn()}
      />,
    );

    expect(screen.getByTestId("task-detail-tags")).toHaveTextContent("Без тегов");
  });

  it("shows the formatted deadline", () => {
    render(
      <TaskDetail
        task={makeTask({ deadline: "2026-09-01T00:00:00.000Z" })}
        dependencyCodes={[]}
        open
        onOpenChange={vi.fn()}
      />,
    );

    expect(screen.getByTestId("task-detail-deadline")).not.toHaveTextContent("Без дедлайна");
  });

  it("shows a placeholder when there is no deadline", () => {
    render(
      <TaskDetail
        task={makeTask({ deadline: null })}
        dependencyCodes={[]}
        open
        onOpenChange={vi.fn()}
      />,
    );

    expect(screen.getByTestId("task-detail-deadline")).toHaveTextContent("Без дедлайна");
  });

  it("shows estimated and actual time in minutes", () => {
    render(
      <TaskDetail
        task={makeTask({ estimatedMin: 120, timeSpentMin: 45 })}
        dependencyCodes={[]}
        open
        onOpenChange={vi.fn()}
      />,
    );

    expect(screen.getByTestId("task-detail-estimated")).toHaveTextContent("120");
    expect(screen.getByTestId("task-detail-time-spent")).toHaveTextContent("45");
  });

  it("shows the creation date", () => {
    render(
      <TaskDetail
        task={makeTask({ createdAt: "2026-08-01T00:00:00.000Z" })}
        dependencyCodes={[]}
        open
        onOpenChange={vi.fn()}
      />,
    );

    expect(screen.getByTestId("task-detail-created")).not.toBeEmptyDOMElement();
  });

  it("shows resolved dependency codes", () => {
    render(
      <TaskDetail
        task={makeTask({ dependsOn: ["t2", "t3"] })}
        dependencyCodes={["TEST-2", "TEST-3"]}
        open
        onOpenChange={vi.fn()}
      />,
    );

    expect(screen.getByTestId("task-detail-dependencies")).toHaveTextContent("TEST-2");
    expect(screen.getByTestId("task-detail-dependencies")).toHaveTextContent("TEST-3");
  });

  it("shows a placeholder when there are no dependencies", () => {
    render(
      <TaskDetail task={makeTask({ dependsOn: [] })} dependencyCodes={[]} open onOpenChange={vi.fn()} />,
    );

    expect(screen.getByTestId("task-detail-dependencies")).toHaveTextContent("Нет зависимостей");
  });

  it("shows the parent code and title when the parent is available", () => {
    const parent = makeTask({ id: "p1", code: "TEST-0", title: "Родительская задача" });
    render(
      <TaskDetail
        task={makeTask({ parentId: "p1" })}
        dependencyCodes={[]}
        open
        onOpenChange={vi.fn()}
        listTasks={[parent]}
      />,
    );

    expect(screen.getByTestId("task-detail-parent")).toHaveTextContent("TEST-0");
    expect(screen.getByTestId("task-detail-parent")).toHaveTextContent("Родительская задача");
  });

  it("omits the parent row when the task has no parent", () => {
    render(
      <TaskDetail task={makeTask({ parentId: null })} dependencyCodes={[]} open onOpenChange={vi.fn()} />,
    );

    expect(screen.queryByTestId("task-detail-parent")).not.toBeInTheDocument();
  });

  it("omits the parent row when the parent task is not in the available task set (deleted or missing)", () => {
    render(
      <TaskDetail
        task={makeTask({ parentId: "p-gone" })}
        dependencyCodes={[]}
        open
        onOpenChange={vi.fn()}
        listTasks={[]}
      />,
    );

    expect(screen.queryByTestId("task-detail-parent")).not.toBeInTheDocument();
  });

  it("calls onOpenChange(false) when the close button is clicked", async () => {
    const user = userEvent.setup();
    const onOpenChange = vi.fn();
    render(
      <TaskDetail task={makeTask({})} dependencyCodes={[]} open onOpenChange={onOpenChange} />,
    );

    await user.click(screen.getByTestId("task-detail-close"));

    expect(onOpenChange).toHaveBeenCalledWith(false);
  });
});

describe("TaskDetail subtasks", () => {
  it("shows no subtask list when the task has no subtasks", () => {
    render(
      <TaskDetail task={makeTask({ subtaskIds: [] })} dependencyCodes={[]} open onOpenChange={vi.fn()} />,
    );

    expect(screen.queryByTestId("task-detail-subtask-list")).not.toBeInTheDocument();
  });

  it("lists active subtasks with code, title and status", () => {
    const s1 = makeTask({ id: "s1", code: "TEST-5", title: "Написать API", status: "done" });
    const s2 = makeTask({ id: "s2", code: "TEST-6", title: "Написать UI", status: "in_progress" });
    render(
      <TaskDetail
        task={makeTask({ subtaskIds: ["s1", "s2"] })}
        dependencyCodes={[]}
        open
        onOpenChange={vi.fn()}
        listTasks={[s1, s2]}
      />,
    );

    const rows = screen.getAllByTestId("task-detail-subtask-row");
    expect(rows).toHaveLength(2);
    expect(rows[0]).toHaveTextContent("TEST-5");
    expect(rows[0]).toHaveTextContent("Написать API");
    expect(rows[0]).toHaveTextContent("Готово");
    expect(rows[1]).toHaveTextContent("TEST-6");
    expect(rows[1]).toHaveTextContent("Написать UI");
    expect(rows[1]).toHaveTextContent("В работе");
  });

  it("excludes soft-deleted subtasks from the list", () => {
    const active = makeTask({ id: "s1", code: "TEST-5" });
    const deleted = makeTask({ id: "s2", code: "TEST-6", deletedAt: "2026-08-01T00:00:00.000Z" });
    render(
      <TaskDetail
        task={makeTask({ subtaskIds: ["s1", "s2"] })}
        dependencyCodes={[]}
        open
        onOpenChange={vi.fn()}
        listTasks={[active, deleted]}
      />,
    );

    expect(screen.getAllByTestId("task-detail-subtask-row")).toHaveLength(1);
    expect(screen.queryByText("TEST-6")).not.toBeInTheDocument();
  });

  it("shows no subtask list when every referenced subtask is missing or deleted", () => {
    const deleted = makeTask({ id: "s1", deletedAt: "2026-08-01T00:00:00.000Z" });
    render(
      <TaskDetail
        task={makeTask({ subtaskIds: ["s1", "missing"] })}
        dependencyCodes={[]}
        open
        onOpenChange={vi.fn()}
        listTasks={[deleted]}
      />,
    );

    expect(screen.queryByTestId("task-detail-subtask-list")).not.toBeInTheDocument();
  });
});

describe("TaskDetail subtask progress", () => {
  it("does not show a progress block when the task has no active subtasks", () => {
    render(
      <TaskDetail task={makeTask({ subtaskIds: [] })} dependencyCodes={[]} open onOpenChange={vi.fn()} />,
    );

    expect(screen.queryByTestId("task-detail-subtask-progress")).not.toBeInTheDocument();
  });

  it("does not show a false 0% when every referenced subtask is deleted", () => {
    const deleted = makeTask({ id: "s1", deletedAt: "2026-08-01T00:00:00.000Z" });
    render(
      <TaskDetail
        task={makeTask({ subtaskIds: ["s1"] })}
        dependencyCodes={[]}
        open
        onOpenChange={vi.fn()}
        listTasks={[deleted]}
      />,
    );

    expect(screen.queryByTestId("task-detail-subtask-progress")).not.toBeInTheDocument();
    expect(screen.queryByText("0%")).not.toBeInTheDocument();
  });

  it("shows progress for a single active subtask", () => {
    const s1 = makeTask({ id: "s1", status: "new" });
    render(
      <TaskDetail
        task={makeTask({ subtaskIds: ["s1"] })}
        dependencyCodes={[]}
        open
        onOpenChange={vi.fn()}
        listTasks={[s1]}
      />,
    );

    expect(screen.getByTestId("task-detail-subtask-progress")).toHaveTextContent("0 / 1");
    expect(screen.getByText("0%")).toBeInTheDocument();
  });

  it("shows the count and percent computed for a mix of subtask statuses", () => {
    const s1 = makeTask({ id: "s1", status: "done" });
    const s2 = makeTask({ id: "s2", status: "done" });
    const s3 = makeTask({ id: "s3", status: "in_progress" });
    render(
      <TaskDetail
        task={makeTask({ subtaskIds: ["s1", "s2", "s3"] })}
        dependencyCodes={[]}
        open
        onOpenChange={vi.fn()}
        listTasks={[s1, s2, s3]}
      />,
    );

    expect(screen.getByTestId("task-detail-subtask-progress")).toHaveTextContent("2 / 3");
    expect(screen.getByText("67%")).toBeInTheDocument();
  });

  it("shows 100% when all active subtasks are done", () => {
    const s1 = makeTask({ id: "s1", status: "done" });
    const s2 = makeTask({ id: "s2", status: "done" });
    render(
      <TaskDetail
        task={makeTask({ subtaskIds: ["s1", "s2"] })}
        dependencyCodes={[]}
        open
        onOpenChange={vi.fn()}
        listTasks={[s1, s2]}
      />,
    );

    expect(screen.getByText("100%")).toBeInTheDocument();
  });
});

describe("TaskDetail edit mode", () => {
  it("does not show an Edit button when the user cannot edit", () => {
    render(
      <TaskDetail task={makeTask({})} dependencyCodes={[]} open onOpenChange={vi.fn()} canEdit={false} />,
    );

    expect(screen.queryByTestId("task-detail-edit")).not.toBeInTheDocument();
  });

  it("shows an Edit button when the user can edit", () => {
    render(
      <TaskDetail task={makeTask({})} dependencyCodes={[]} open onOpenChange={vi.fn()} canEdit />,
    );

    expect(screen.getByTestId("task-detail-edit")).toBeInTheDocument();
  });

  it("switches to the edit form when Edit is clicked", async () => {
    const user = userEvent.setup();
    render(
      <TaskDetail task={makeTask({ title: "Заголовок" })} dependencyCodes={[]} open onOpenChange={vi.fn()} canEdit />,
    );

    await user.click(screen.getByTestId("task-detail-edit"));

    expect(screen.getByTestId("task-edit-form")).toBeInTheDocument();
    expect(screen.queryByTestId("task-detail-status")).not.toBeInTheDocument();
    expect(screen.getByLabelText("Название")).toHaveValue("Заголовок");
  });

  it("returns to read-only mode without saving when Cancel is clicked", async () => {
    const user = userEvent.setup();
    const fetchMock = stubFetchForTaskAction(() => {
      throw new Error("no task mutation should be sent");
    });
    render(
      <TaskDetail task={makeTask({ title: "Исходное" })} dependencyCodes={[]} open onOpenChange={vi.fn()} canEdit />,
    );

    await user.click(screen.getByTestId("task-detail-edit"));
    await user.clear(screen.getByLabelText("Название"));
    await user.type(screen.getByLabelText("Название"), "Изменённое");
    await user.click(screen.getByTestId("task-edit-cancel"));

    expect(screen.queryByTestId("task-edit-form")).not.toBeInTheDocument();
    expect(screen.getByRole("dialog")).toHaveTextContent("Исходное");
    expect(fetchMock.mock.calls.every(([url]) => url.endsWith("/comments"))).toBe(true);
  });

  it("does not send a PATCH when Save is clicked without any changes", async () => {
    const user = userEvent.setup();
    const fetchMock = stubFetchForTaskAction(() => {
      throw new Error("no task mutation should be sent");
    });
    render(
      <TaskDetail task={makeTask({})} dependencyCodes={[]} open onOpenChange={vi.fn()} canEdit />,
    );

    await user.click(screen.getByTestId("task-detail-edit"));
    await user.click(screen.getByTestId("task-edit-save"));

    await waitFor(() => expect(screen.queryByTestId("task-edit-form")).not.toBeInTheDocument());
    expect(fetchMock.mock.calls.every(([url]) => url.endsWith("/comments"))).toBe(true);
  });
});

describe("TaskDetail save", () => {
  it("saves the edited field via PATCH and shows the updated value in read-only mode", async () => {
    const user = userEvent.setup();
    const updatedTask = makeTask({ id: "t1", title: "Новое название" });
    stubFetchForTaskAction(() => jsonResponse(200, { data: { task: updatedTask, cascade: [] } }));
    const onTaskUpdated = vi.fn();
    render(
      <TaskDetail
        task={makeTask({ id: "t1", title: "Старое название" })}
        dependencyCodes={[]}
        open
        onOpenChange={vi.fn()}
        canEdit
        onTaskUpdated={onTaskUpdated}
      />,
    );

    await user.click(screen.getByTestId("task-detail-edit"));
    await user.clear(screen.getByLabelText("Название"));
    await user.type(screen.getByLabelText("Название"), "Новое название");
    await user.click(screen.getByTestId("task-edit-save"));

    await waitFor(() =>
      expect(fetch).toHaveBeenCalledWith(
        "/api/tasks/t1",
        expect.objectContaining({ method: "PATCH", body: JSON.stringify({ title: "Новое название" }) }),
      ),
    );
    await waitFor(() => expect(screen.queryByTestId("task-edit-form")).not.toBeInTheDocument());
    expect(onTaskUpdated).toHaveBeenCalledWith(updatedTask);
  });

  it("disables Save while pending and does not send a duplicate PATCH", async () => {
    const user = userEvent.setup();
    let resolveFetch: (value: Response) => void = () => {};
    const pending = new Promise<Response>((resolve) => {
      resolveFetch = resolve;
    });
    const fetchMock = stubFetchForTaskAction(() => pending);
    render(
      <TaskDetail task={makeTask({ id: "t1", title: "Старое" })} dependencyCodes={[]} open onOpenChange={vi.fn()} canEdit />,
    );

    await user.click(screen.getByTestId("task-detail-edit"));
    await user.clear(screen.getByLabelText("Название"));
    await user.type(screen.getByLabelText("Название"), "Новое");
    const saveButton = screen.getByTestId("task-edit-save");
    await user.click(saveButton);

    await waitFor(() => expect(saveButton).toBeDisabled());
    await user.click(saveButton);
    const patchCalls = fetchMock.mock.calls.filter(([, init]) => init?.method === "PATCH");
    expect(patchCalls).toHaveLength(1);

    resolveFetch(jsonResponse(200, { data: { task: makeTask({ id: "t1", title: "Новое" }), cascade: [] } }));
    await waitFor(() => expect(screen.queryByTestId("task-edit-form")).not.toBeInTheDocument());
  });

  it.each([
    [400, "Проверьте правильность заполнения полей"],
    [401, "Сессия истекла. Войдите снова"],
    [403, "У вас нет прав на редактирование этой задачи"],
    [404, "Задача недоступна или была удалена"],
    [409, "Изменение создаёт цикл зависимостей. Проверьте выбранные зависимости"],
  ])("shows the API error for a %i response and keeps the modal open with the typed values", async (status, message) => {
    const user = userEvent.setup();
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(jsonResponse(status, { error: { message: "x" } })));
    render(
      <TaskDetail task={makeTask({ id: "t1", title: "Старое" })} dependencyCodes={[]} open onOpenChange={vi.fn()} canEdit />,
    );

    await user.click(screen.getByTestId("task-detail-edit"));
    await user.clear(screen.getByLabelText("Название"));
    await user.type(screen.getByLabelText("Название"), "Новое");
    await user.click(screen.getByTestId("task-edit-save"));

    expect(await screen.findByText(message)).toBeInTheDocument();
    expect(screen.getByRole("dialog")).toBeInTheDocument();
    expect(screen.getByTestId("task-edit-form")).toBeInTheDocument();
    expect(screen.getByLabelText("Название")).toHaveValue("Новое");
  });

  it("shows a network error message and keeps the modal open", async () => {
    const user = userEvent.setup();
    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new TypeError("Failed to fetch")));
    render(
      <TaskDetail task={makeTask({ id: "t1", title: "Старое" })} dependencyCodes={[]} open onOpenChange={vi.fn()} canEdit />,
    );

    await user.click(screen.getByTestId("task-detail-edit"));
    await user.clear(screen.getByLabelText("Название"));
    await user.type(screen.getByLabelText("Название"), "Новое");
    await user.click(screen.getByTestId("task-edit-save"));

    expect(
      await screen.findByText("Не удалось соединиться с сервером. Проверьте подключение к интернету"),
    ).toBeInTheDocument();
    expect(screen.getByRole("dialog")).toBeInTheDocument();
  });
});

describe("TaskDetail clone", () => {
  it("does not show a Clone button when the user cannot edit", () => {
    render(
      <TaskDetail task={makeTask({})} dependencyCodes={[]} open onOpenChange={vi.fn()} canEdit={false} />,
    );

    expect(screen.queryByTestId("task-detail-clone")).not.toBeInTheDocument();
  });

  it("shows a Clone button when the user can edit", () => {
    render(<TaskDetail task={makeTask({})} dependencyCodes={[]} open onOpenChange={vi.fn()} canEdit />);

    expect(screen.getByTestId("task-detail-clone")).toBeInTheDocument();
  });

  it("clones the task via POST, closes the dialog and reports the created task", async () => {
    const user = userEvent.setup();
    const clonedTask = makeTask({ id: "t2", code: "TEST-2", title: "Написать тесты" });
    stubFetchForTaskAction(() => jsonResponse(201, { data: clonedTask }));
    const onTaskCloned = vi.fn();
    const onOpenChange = vi.fn();
    render(
      <TaskDetail
        task={makeTask({ id: "t1" })}
        dependencyCodes={[]}
        open
        onOpenChange={onOpenChange}
        canEdit
        onTaskCloned={onTaskCloned}
      />,
    );

    await user.click(screen.getByTestId("task-detail-clone"));

    expect(fetch).toHaveBeenCalledWith("/api/tasks/t1/clone", expect.objectContaining({ method: "POST" }));
    await waitFor(() => expect(onTaskCloned).toHaveBeenCalledWith(clonedTask));
    expect(onOpenChange).toHaveBeenCalledWith(false);
  });

  it("disables the Clone button while pending and does not send a duplicate request", async () => {
    const user = userEvent.setup();
    let resolveFetch: (value: Response) => void = () => {};
    const pending = new Promise<Response>((resolve) => {
      resolveFetch = resolve;
    });
    const fetchMock = stubFetchForTaskAction(() => pending);
    render(<TaskDetail task={makeTask({ id: "t1" })} dependencyCodes={[]} open onOpenChange={vi.fn()} canEdit />);

    const cloneButton = screen.getByTestId("task-detail-clone");
    await user.click(cloneButton);

    await waitFor(() => expect(cloneButton).toBeDisabled());
    await user.click(cloneButton);
    const cloneCalls = fetchMock.mock.calls.filter(([url]) => url === "/api/tasks/t1/clone");
    expect(cloneCalls).toHaveLength(1);

    resolveFetch(jsonResponse(201, { data: makeTask({ id: "t2" }) }));
    await waitFor(() => expect(cloneButton).not.toBeDisabled());
  });

  it("shows an error and keeps the modal open when clone is forbidden, preserving existing state", async () => {
    const user = userEvent.setup();
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(jsonResponse(403, { error: { message: "You do not have permission to clone this task" } })),
    );
    const onOpenChange = vi.fn();
    render(
      <TaskDetail
        task={makeTask({ id: "t1", title: "Оставить как есть" })}
        dependencyCodes={[]}
        open
        onOpenChange={onOpenChange}
        canEdit
      />,
    );

    await user.click(screen.getByTestId("task-detail-clone"));

    expect(await screen.findByTestId("task-detail-clone-error")).toHaveTextContent(
      "У вас нет прав на клонирование этой задачи",
    );
    expect(onOpenChange).not.toHaveBeenCalled();
    expect(screen.getByRole("dialog")).toHaveTextContent("Оставить как есть");
  });

  it("shows a network error message when cloning fails outright", async () => {
    const user = userEvent.setup();
    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new TypeError("Failed to fetch")));
    render(<TaskDetail task={makeTask({ id: "t1" })} dependencyCodes={[]} open onOpenChange={vi.fn()} canEdit />);

    await user.click(screen.getByTestId("task-detail-clone"));

    expect(
      await screen.findByText("Не удалось соединиться с сервером. Проверьте подключение к интернету"),
    ).toBeInTheDocument();
    expect(screen.getByRole("dialog")).toBeInTheDocument();
  });
});

describe("TaskDetail timer", () => {
  it("embeds the timer in view mode", () => {
    render(<TaskDetail task={makeTask({})} dependencyCodes={[]} open onOpenChange={vi.fn()} canEdit />);

    expect(screen.getByTestId("task-timer")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Запустить таймер" })).toBeEnabled();
  });

  it("does not show timer controls in edit mode", async () => {
    const user = userEvent.setup();
    render(<TaskDetail task={makeTask({})} dependencyCodes={[]} open onOpenChange={vi.fn()} canEdit />);

    await user.click(screen.getByTestId("task-detail-edit"));

    expect(screen.queryByTestId("task-timer")).not.toBeInTheDocument();
    expect(screen.getByTestId("task-edit-form")).toBeInTheDocument();
  });

  it("keeps comments, clone and close available alongside the timer", () => {
    render(<TaskDetail task={makeTask({})} dependencyCodes={[]} open onOpenChange={vi.fn()} canEdit />);

    expect(screen.getByTestId("task-timer")).toBeInTheDocument();
    expect(screen.getByTestId("task-comments")).toBeInTheDocument();
    expect(screen.getByTestId("task-detail-clone")).toBeInTheDocument();
    expect(screen.getByTestId("task-detail-close")).toBeInTheDocument();
  });
});
