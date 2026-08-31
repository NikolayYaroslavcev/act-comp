import { act, fireEvent, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { TaskDetail } from "./task-detail";
import type { Task } from "@/entities/task/schema";
import { INLINE_TASK_AUTOSAVE_MS } from "@/features/task/use-inline-task-edit";
import { renderWithStore as render } from "@/shared/store/test-utils";

function jsonResponse(status: number, body: unknown) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json" },
  });
}

// TaskDetail mounts TaskComments/TaskActivity/TaskAttachments alongside the
// rest of its view, each of which fetches its own endpoint as soon as the
// dialog opens. Tests below exercise task-level mutations (save/clone) and
// stub a single canned Response for those — but a Response body can only be
// read once, so routing these unrelated background requests to their own
// fresh response (rather than letting them consume the same body the
// task-level hook needs) keeps them from starving the assertion under test.
// TaskComments' fetch calls fetchFn(request) with a single Request object
// (fetchBaseQuery's own convention), while every other task-level hook here
// still calls plain fetch(url, init) with a string — normalize both shapes
// to a URL string for routing/assertions below.
function urlOf(arg: unknown): string {
  return arg instanceof Request ? arg.url : String(arg);
}

function stubFetchForTaskAction(handler: (url: string, init?: RequestInit) => Promise<Response> | Response) {
  const fetchMock = vi.fn((input: string | Request, init?: RequestInit) => {
    const url = urlOf(input);
    if (url.endsWith("/comments") || url.endsWith("/activity") || url.endsWith("/files")) {
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

  it("shows the smart priority equal to the plain priority when no factor boosts it", () => {
    render(
      <TaskDetail
        task={makeTask({ priority: 3, status: "new" })}
        dependencyCodes={[]}
        open
        onOpenChange={vi.fn()}
        now={new Date("2026-08-27T12:00:00.000Z")}
      />,
    );

    expect(screen.getByTestId("task-detail-priority")).toHaveTextContent("3");
    expect(screen.getByTestId("task-detail-smart-priority")).toHaveTextContent("3");
  });

  it("shows a smart priority distinct from the plain priority for an overdue task", () => {
    render(
      <TaskDetail
        task={makeTask({ priority: 2, status: "in_progress", deadline: "2026-08-20T00:00:00.000Z" })}
        dependencyCodes={[]}
        open
        onOpenChange={vi.fn()}
        now={new Date("2026-08-27T12:00:00.000Z")}
      />,
    );

    expect(screen.getByTestId("task-detail-priority")).toHaveTextContent("2");
    expect(screen.getByTestId("task-detail-smart-priority")).toHaveTextContent("12");
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

  it("shows estimated and actual time in a human-readable duration format", () => {
    render(
      <TaskDetail
        task={makeTask({ estimatedMin: 120, timeSpentMin: 45 })}
        dependencyCodes={[]}
        open
        onOpenChange={vi.fn()}
      />,
    );

    expect(screen.getByTestId("task-detail-estimated")).toHaveTextContent("2h");
    expect(screen.getByTestId("task-detail-time-spent")).toHaveTextContent("45m");
  });

  it("shows a completion prediction based on the estimate when running behind", () => {
    render(
      <TaskDetail
        task={makeTask({ status: "in_progress", estimatedMin: 120, timeSpentMin: 45 })}
        dependencyCodes={[]}
        open
        onOpenChange={vi.fn()}
        now={new Date("2026-08-27T10:00:00.000Z")}
      />,
    );

    expect(screen.getByTestId("task-detail-completion-prediction")).toHaveTextContent("75 мин");
  });

  it("shows a no-data message when there is no estimate and no history", () => {
    render(
      <TaskDetail
        task={makeTask({ status: "in_progress", estimatedMin: 0, category: null })}
        dependencyCodes={[]}
        open
        onOpenChange={vi.fn()}
      />,
    );

    expect(screen.getByTestId("task-detail-completion-prediction")).toHaveTextContent(
      "Недостаточно данных для прогноза",
    );
  });

  it("shows the task as complete once it is done, without a projected date", () => {
    render(
      <TaskDetail
        task={makeTask({ status: "done", estimatedMin: 60, timeSpentMin: 55 })}
        dependencyCodes={[]}
        open
        onOpenChange={vi.fn()}
      />,
    );

    expect(screen.getByTestId("task-detail-completion-prediction")).toHaveTextContent("Задача завершена");
  });

  it("shrinks remaining time using the calendar-aware running timer, not wall-clock alone", () => {
    render(
      <TaskDetail
        task={makeTask({
          status: "in_progress",
          estimatedMin: 200,
          timeSpentMin: 40,
          timerStartedAt: "2026-08-27T10:00:00.000Z",
        })}
        dependencyCodes={[]}
        open
        onOpenChange={vi.fn()}
        now={new Date("2026-08-27T10:01:30.000Z")}
      />,
    );

    expect(screen.getByTestId("task-detail-completion-prediction")).toHaveTextContent("159 мин");
  });

  it("predicts a later completion date when workDayHours is lower than the default", () => {
    const task = makeTask({ status: "in_progress", estimatedMin: 600, timeSpentMin: 0 });
    const now = new Date("2026-08-27T10:00:00.000Z");

    const { unmount } = render(
      <TaskDetail task={task} dependencyCodes={[]} open onOpenChange={vi.fn()} now={now} workDayHours={8} />,
    );
    const withEightHourDay = screen.getByTestId("task-detail-completion-prediction").textContent;
    unmount();

    render(
      <TaskDetail task={task} dependencyCodes={[]} open onOpenChange={vi.fn()} now={now} workDayHours={4} />,
    );
    const withFourHourDay = screen.getByTestId("task-detail-completion-prediction").textContent;

    expect(withFourHourDay).not.toBe(withEightHourDay);
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

    await user.click(screen.getByTestId("dialog-close"));

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
    expect(screen.queryByTestId("task-detail-subtask-pagination")).not.toBeInTheDocument();
  });

  it("paginates when there are more subtasks than one page", async () => {
    const user = userEvent.setup();
    const subtasks = Array.from({ length: 11 }, (_, index) =>
      makeTask({
        id: `s${index + 1}`,
        code: `SUB-${index + 1}`,
        title: `Подзадача ${index + 1}`,
      }),
    );
    render(
      <TaskDetail
        task={makeTask({ subtaskIds: subtasks.map((task) => task.id) })}
        dependencyCodes={[]}
        open
        onOpenChange={vi.fn()}
        listTasks={subtasks}
      />,
    );

    expect(screen.getAllByTestId("task-detail-subtask-row")).toHaveLength(10);
    expect(screen.queryByText("SUB-11")).not.toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "Следующая страница" }));

    expect(screen.getByText("SUB-11")).toBeInTheDocument();
    expect(screen.getAllByTestId("task-detail-subtask-row")).toHaveLength(1);
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
    expect(fetchMock.mock.calls.every(([url]) => urlOf(url).endsWith("/comments") || urlOf(url).endsWith("/activity") || urlOf(url).endsWith("/files"))).toBe(true);
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
    expect(fetchMock.mock.calls.every(([url]) => urlOf(url).endsWith("/comments") || urlOf(url).endsWith("/activity") || urlOf(url).endsWith("/files"))).toBe(true);
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

    await waitFor(() => {
      expect(
        vi.mocked(fetch).mock.calls.some(([input]) => input instanceof Request && input.method === "PATCH"),
      ).toBe(true);
    });
    const patchRequest = vi
      .mocked(fetch)
      .mock.calls.map(([input]) => input)
      .find((input): input is Request => input instanceof Request && input.method === "PATCH")!;
    expect(await patchRequest.clone().json()).toEqual({ title: "Новое название" });

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
    const patchCalls = fetchMock.mock.calls.filter(([input]) => input instanceof Request && input.method === "PATCH");
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
    // A single blanket mock (one Response instance for every URL) would have
    // TaskComments' background /comments fetch and this PATCH race to
    // consume the same Response body — stubFetchForTaskAction gives the
    // background requests their own response instead.
    stubFetchForTaskAction(() => jsonResponse(status, { error: { message: "x" } }));
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

describe("TaskDetail rollback", () => {
  const HISTORY_AT = "2026-08-10T10:00:00.000Z";

  function taskWithTitleHistory(overrides: Partial<Task> = {}) {
    return makeTask({
      id: "t1",
      title: "Новое",
      history: [{ field: "title", old: "Старое", new: "Новое", at: HISTORY_AT, byUserId: "u1" }],
      ...overrides,
    });
  }

  it("does not show a rollback action when the user cannot edit", () => {
    render(
      <TaskDetail task={taskWithTitleHistory()} dependencyCodes={[]} open onOpenChange={vi.fn()} canEdit={false} />,
    );

    expect(screen.queryByTestId("task-detail-history")).not.toBeInTheDocument();
  });

  it("lists restorable versions when the user can edit", async () => {
    const user = userEvent.setup();
    render(<TaskDetail task={taskWithTitleHistory()} dependencyCodes={[]} open onOpenChange={vi.fn()} canEdit />);

    await user.click(await screen.findByRole("button", { name: "История изменений" }));

    expect(screen.getByRole("listbox", { name: "Предыдущие версии" })).toBeInTheDocument();
    expect(screen.getByRole("option")).toBeInTheDocument();
  });

  it("shows a preview of fields that would be restored", async () => {
    const user = userEvent.setup();
    render(<TaskDetail task={taskWithTitleHistory()} dependencyCodes={[]} open onOpenChange={vi.fn()} canEdit />);

    await user.click(await screen.findByRole("button", { name: "История изменений" }));
    await user.click(screen.getByRole("option"));

    const preview = screen.getByTestId("task-rollback-preview");
    expect(preview).toHaveTextContent("Название");
    expect(preview).toHaveTextContent("Новое");
    expect(preview).toHaveTextContent("Старое");
  });

  it("does not call the API when confirmation is cancelled", async () => {
    const user = userEvent.setup();
    const fetchMock = stubFetchForTaskAction(() => {
      throw new Error("rollback should not be sent");
    });
    render(<TaskDetail task={taskWithTitleHistory()} dependencyCodes={[]} open onOpenChange={vi.fn()} canEdit />);

    await user.click(await screen.findByRole("button", { name: "История изменений" }));
    await user.click(screen.getByRole("option"));
    await user.click(screen.getByRole("button", { name: "Откатить к этой версии" }));
    await user.click(screen.getByRole("button", { name: "Отмена" }));

    expect(screen.queryByRole("dialog", { name: "Откатить задачу?" })).not.toBeInTheDocument();
    expect(fetchMock.mock.calls.every(([url]) => urlOf(url).endsWith("/comments") || urlOf(url).endsWith("/activity") || urlOf(url).endsWith("/files"))).toBe(true);
  });

  it("posts rollback on confirmation and updates the task without closing the modal", async () => {
    const user = userEvent.setup();
    const restored = taskWithTitleHistory({ title: "Старое" });
    stubFetchForTaskAction((url) => {
      if (String(url).endsWith("/rollback")) {
        return jsonResponse(200, { data: { task: restored, cascade: [] } });
      }
      throw new Error(`unexpected ${url}`);
    });
    const onTaskUpdated = vi.fn();
    const onOpenChange = vi.fn();
    render(
      <TaskDetail
        task={taskWithTitleHistory()}
        dependencyCodes={[]}
        open
        onOpenChange={onOpenChange}
        canEdit
        onTaskUpdated={onTaskUpdated}
      />,
    );

    await user.click(await screen.findByRole("button", { name: "История изменений" }));
    await user.click(screen.getByRole("option"));
    await user.click(screen.getByRole("button", { name: "Откатить к этой версии" }));
    await user.click(screen.getByRole("button", { name: "Откатить" }));

    await waitFor(() =>
      expect(fetch).toHaveBeenCalledWith(
        "/api/tasks/t1/rollback",
        expect.objectContaining({ method: "POST", body: JSON.stringify({ historyIndex: 0 }) }),
      ),
    );
    await waitFor(() => expect(onTaskUpdated).toHaveBeenCalledWith(restored));
    expect(onOpenChange).not.toHaveBeenCalled();
    expect(screen.getByRole("dialog")).toBeInTheDocument();
  });

  it("disables confirm while pending and does not send a duplicate request", async () => {
    const user = userEvent.setup();
    let resolveFetch: (value: Response) => void = () => {};
    const pending = new Promise<Response>((resolve) => {
      resolveFetch = resolve;
    });
    const fetchMock = stubFetchForTaskAction((url) => {
      if (String(url).endsWith("/rollback")) {
        return pending;
      }
      throw new Error(`unexpected ${url}`);
    });
    render(<TaskDetail task={taskWithTitleHistory()} dependencyCodes={[]} open onOpenChange={vi.fn()} canEdit />);

    await user.click(await screen.findByRole("button", { name: "История изменений" }));
    await user.click(screen.getByRole("option"));
    await user.click(screen.getByRole("button", { name: "Откатить к этой версии" }));
    const confirm = screen.getByRole("button", { name: "Откатить" });
    await user.click(confirm);

    await waitFor(() => expect(confirm).toBeDisabled());
    await user.click(confirm);
    expect(fetchMock.mock.calls.filter(([url]) => String(url).endsWith("/rollback"))).toHaveLength(1);

    resolveFetch(jsonResponse(200, { data: { task: taskWithTitleHistory({ title: "Старое" }), cascade: [] } }));
    await waitFor(() => expect(screen.queryByRole("dialog", { name: "Откатить задачу?" })).not.toBeInTheDocument());
  });

  it("keeps the modal open and shows an error when rollback fails", async () => {
    const user = userEvent.setup();
    stubFetchForTaskAction((url) => {
      if (String(url).endsWith("/rollback")) {
        return jsonResponse(404, { error: { message: "Task not found" } });
      }
      throw new Error(`unexpected ${url}`);
    });
    const onOpenChange = vi.fn();
    render(
      <TaskDetail
        task={taskWithTitleHistory()}
        dependencyCodes={[]}
        open
        onOpenChange={onOpenChange}
        canEdit
      />,
    );

    await user.click(await screen.findByRole("button", { name: "История изменений" }));
    await user.click(screen.getByRole("option"));
    await user.click(screen.getByRole("button", { name: "Откатить к этой версии" }));
    await user.click(screen.getByRole("button", { name: "Откатить" }));

    expect(await screen.findByRole("alert")).toHaveTextContent("Задача недоступна или была удалена");
    expect(onOpenChange).not.toHaveBeenCalled();
    expect(screen.getByRole("dialog", { name: /TEST-1/ })).toHaveTextContent("Новое");
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
    expect(screen.getByTestId("task-activity")).toBeInTheDocument();
    expect(screen.getByTestId("task-detail-clone")).toBeInTheDocument();
    expect(screen.getByTestId("dialog-close")).toBeInTheDocument();
  });
});

describe("TaskDetail inline edit", () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("shows the current field values without editable controls for shared-read", () => {
    render(
      <TaskDetail
        task={makeTask({ title: "Только чтение", description: "Текст", priority: 4, category: "qa", tags: ["beta"] })}
        dependencyCodes={[]}
        open
        onOpenChange={vi.fn()}
        canEdit={false}
      />,
    );

    expect(screen.getByRole("dialog", { name: /Только чтение/ })).toBeInTheDocument();
    expect(screen.getByTestId("task-detail-description")).toHaveTextContent("Текст");
    expect(screen.getByTestId("task-detail-priority")).toHaveTextContent("4");
    expect(screen.getByTestId("task-detail-category")).toHaveTextContent("qa");
    expect(screen.getByTestId("task-detail-tags")).toHaveTextContent("#beta");
    expect(screen.queryByRole("textbox", { name: "Название" })).not.toBeInTheDocument();
    expect(screen.queryByRole("textbox", { name: "Описание" })).not.toBeInTheDocument();
  });

  it("lets an owner or shared-edit user inline-edit title, description, priority, category, tags, deadline, estimate and status", () => {
    render(
      <TaskDetail
        task={makeTask({
          title: "Редактируемая",
          description: "Было",
          priority: 2,
          category: "dev",
          tags: ["alpha"],
          deadline: "2026-10-01T12:00:00.000Z",
          estimatedMin: 45,
          status: "new",
        })}
        dependencyCodes={[]}
        open
        onOpenChange={vi.fn()}
        canEdit
      />,
    );

    expect(screen.getByRole("textbox", { name: "Название" })).toHaveValue("Редактируемая");
    expect(screen.getByRole("textbox", { name: "Описание" })).toHaveValue("Было");
    expect(screen.getByLabelText("Приоритет")).toHaveValue(2);
    expect(screen.getByRole("textbox", { name: "Категория" })).toHaveValue("dev");
    expect(screen.getByRole("textbox", { name: /Теги/ })).toHaveValue("alpha");
    expect(screen.getByLabelText("Дедлайн")).toBeInTheDocument();
    expect(screen.getByLabelText("Оценка времени")).toHaveValue(45);
    expect(screen.getByRole("radio", { name: "Новая" })).toBeChecked();
  });

  it("autosaves a title change after debounce and shows saved status", async () => {
    const updated = makeTask({ title: "Новое" });
    stubFetchForTaskAction(() => jsonResponse(200, { data: { task: updated, cascade: [] } }));
    const onTaskUpdated = vi.fn();
    render(
      <TaskDetail
        task={makeTask({ title: "Старое" })}
        dependencyCodes={[]}
        open
        onOpenChange={vi.fn()}
        canEdit
        onTaskUpdated={onTaskUpdated}
      />,
    );

    const title = screen.getByRole("textbox", { name: "Название" });
    fireEvent.change(title, { target: { value: "Новое" } });
    expect(screen.queryByTestId("task-inline-title-status")).not.toHaveTextContent("Сохранение");

    await act(async () => {
      vi.advanceTimersByTime(INLINE_TASK_AUTOSAVE_MS);
    });
    await act(async () => {
      await Promise.resolve();
    });

    expect(fetch).toHaveBeenCalledWith(
      "/api/tasks/t1",
      expect.objectContaining({ method: "PATCH", body: JSON.stringify({ title: "Новое" }) }),
    );
    expect(screen.getByTestId("task-inline-title-status")).toHaveTextContent("Сохранено");
    expect(onTaskUpdated).toHaveBeenCalledWith(updated);
  });

  it("does not send a PATCH on each keypress", async () => {
    const fetchMock = stubFetchForTaskAction(() =>
      jsonResponse(200, { data: { task: makeTask({ title: "Абв" }), cascade: [] } }),
    );
    render(
      <TaskDetail task={makeTask({ title: "А" })} dependencyCodes={[]} open onOpenChange={vi.fn()} canEdit />,
    );

    fireEvent.change(screen.getByRole("textbox", { name: "Название" }), { target: { value: "Аб" } });
    fireEvent.change(screen.getByRole("textbox", { name: "Название" }), { target: { value: "Абв" } });
    await act(async () => {
      vi.advanceTimersByTime(INLINE_TASK_AUTOSAVE_MS - 1);
    });
    expect(fetchMock.mock.calls.filter(([, init]) => init?.method === "PATCH")).toHaveLength(0);

    await act(async () => {
      vi.advanceTimersByTime(1);
    });
    await act(async () => {
      await Promise.resolve();
    });
    expect(fetchMock.mock.calls.filter(([, init]) => init?.method === "PATCH")).toHaveLength(1);
  });

  it("autosaves description, priority, category, tags, deadline, estimate and status", async () => {
    const fetchMock = stubFetchForTaskAction((_url, init) => {
      const body = JSON.parse(String(init?.body ?? "{}"));
      return jsonResponse(200, { data: { task: { ...makeTask({}), ...body }, cascade: [] } });
    });
    render(
      <TaskDetail
        task={makeTask({
          description: "d",
          priority: 1,
          category: "old",
          tags: ["t"],
          deadline: null,
          estimatedMin: 10,
          status: "new",
        })}
        dependencyCodes={[]}
        open
        onOpenChange={vi.fn()}
        canEdit
      />,
    );

    fireEvent.change(screen.getByRole("textbox", { name: "Описание" }), { target: { value: "новое" } });
    fireEvent.change(screen.getByLabelText("Приоритет"), { target: { value: "5" } });
    fireEvent.change(screen.getByRole("textbox", { name: "Категория" }), { target: { value: "ops" } });
    fireEvent.change(screen.getByRole("textbox", { name: /Теги/ }), { target: { value: "x, y" } });
    fireEvent.change(screen.getByLabelText("Оценка времени"), { target: { value: "80" } });
    fireEvent.click(screen.getByRole("radio", { name: "Готово" }));
    fireEvent.click(screen.getByLabelText("Дедлайн"));
    await act(async () => {
      vi.advanceTimersByTime(50);
    });
    const dayButtons = document.querySelectorAll("button[data-day]:not([disabled])");
    fireEvent.click(dayButtons[dayButtons.length - 1]);

    await act(async () => {
      vi.advanceTimersByTime(INLINE_TASK_AUTOSAVE_MS);
    });
    await act(async () => {
      await Promise.resolve();
    });

    const bodies = fetchMock.mock.calls
      .filter(([, init]) => init?.method === "PATCH")
      .map(([, init]) => JSON.parse(String(init?.body)));
    expect(bodies).toEqual(
      expect.arrayContaining([
        { description: "новое" },
        { priority: 5 },
        { category: "ops" },
        { tags: ["x", "y"] },
        { estimatedMin: 80 },
        { status: "done" },
      ]),
    );
    expect(bodies.some((body) => typeof body.deadline === "string")).toBe(true);
  });

  it("shows inline validation and does not PATCH an empty title", async () => {
    const fetchMock = stubFetchForTaskAction(() => {
      throw new Error("no task mutation should be sent");
    });
    render(
      <TaskDetail task={makeTask({ title: "Нужное" })} dependencyCodes={[]} open onOpenChange={vi.fn()} canEdit />,
    );

    fireEvent.change(screen.getByRole("textbox", { name: "Название" }), { target: { value: "" } });
    await act(async () => {
      vi.advanceTimersByTime(INLINE_TASK_AUTOSAVE_MS);
    });

    expect(screen.getByTestId("task-inline-title-status")).toHaveTextContent("Укажите название задачи");
    expect(fetchMock.mock.calls.every(([url]) => urlOf(url).endsWith("/comments") || urlOf(url).endsWith("/activity") || urlOf(url).endsWith("/files"))).toBe(true);
    expect(screen.getByRole("textbox", { name: "Название" })).toHaveValue("");
  });

  it.each([
    [400, "Проверьте правильность заполнения полей"],
    [401, "Сессия истекла. Войдите снова"],
    [403, "У вас нет прав на редактирование этой задачи"],
    [404, "Задача недоступна или была удалена"],
    [409, "Изменение создаёт цикл зависимостей. Проверьте выбранные зависимости"],
    [500, "Что-то пошло не так. Попробуйте ещё раз"],
  ])("shows API error %i on the field and restores the last valid title", async (status, message) => {
    stubFetchForTaskAction(() => jsonResponse(status, { error: { message: "x" } }));
    render(
      <TaskDetail task={makeTask({ title: "Было" })} dependencyCodes={[]} open onOpenChange={vi.fn()} canEdit />,
    );

    fireEvent.change(screen.getByRole("textbox", { name: "Название" }), { target: { value: "Станет" } });
    await act(async () => {
      vi.advanceTimersByTime(INLINE_TASK_AUTOSAVE_MS);
    });
    await act(async () => {
      await Promise.resolve();
    });

    expect(screen.getByTestId("task-inline-title-status")).toHaveTextContent(message);
    expect(screen.getByRole("textbox", { name: "Название" })).toHaveValue("Было");
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
  });

  it("shows a network error on the field without an alert", async () => {
    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new TypeError("Failed to fetch")));
    render(
      <TaskDetail task={makeTask({ title: "Было" })} dependencyCodes={[]} open onOpenChange={vi.fn()} canEdit />,
    );

    fireEvent.change(screen.getByRole("textbox", { name: "Название" }), { target: { value: "Офлайн" } });
    await act(async () => {
      vi.advanceTimersByTime(INLINE_TASK_AUTOSAVE_MS);
    });
    await act(async () => {
      await Promise.resolve();
    });

    expect(screen.getByTestId("task-inline-title-status")).toHaveTextContent(
      "Не удалось соединиться с сервером. Проверьте подключение к интернету",
    );
    expect(screen.getByRole("textbox", { name: "Название" })).toHaveValue("Было");
  });

  it("keeps the existing Edit workflow available next to inline fields", async () => {
    vi.useRealTimers();
    const user = userEvent.setup();
    render(
      <TaskDetail task={makeTask({ title: "Заголовок" })} dependencyCodes={[]} open onOpenChange={vi.fn()} canEdit />,
    );

    expect(screen.getByTestId("task-detail-edit")).toBeInTheDocument();
    await user.click(screen.getByTestId("task-detail-edit"));
    expect(screen.getByTestId("task-edit-form")).toBeInTheDocument();
    expect(screen.queryByRole("textbox", { name: "Название" })).toBeInTheDocument();
  });

  it("cancels only the current inline field on Escape, without closing the Task Detail dialog or continuing autosave", async () => {
    const fetchMock = stubFetchForTaskAction(() => {
      throw new Error("no task mutation should be sent after Escape");
    });
    const onOpenChange = vi.fn();
    render(
      <TaskDetail
        task={makeTask({ title: "Исходное" })}
        dependencyCodes={[]}
        open
        onOpenChange={onOpenChange}
        canEdit
      />,
    );

    const title = screen.getByRole("textbox", { name: "Название" });
    fireEvent.change(title, { target: { value: "Черновик" } });
    expect(title).toHaveValue("Черновик");

    fireEvent.keyDown(title, { key: "Escape", bubbles: true });

    expect(title).toHaveValue("Исходное");
    expect(onOpenChange).not.toHaveBeenCalled();
    expect(screen.getByRole("dialog")).toBeInTheDocument();

    await act(async () => {
      vi.advanceTimersByTime(INLINE_TASK_AUTOSAVE_MS);
    });
    await act(async () => {
      await Promise.resolve();
    });

    expect(
      fetchMock.mock.calls.every(
        ([url]) => urlOf(url).endsWith("/comments") || urlOf(url).endsWith("/activity") || urlOf(url).endsWith("/files"),
      ),
    ).toBe(true);
  });
});

describe("TaskDetail activity refresh", () => {
  it("refreshes the Activity Log after an attachment upload, without reopening the dialog", async () => {
    const user = userEvent.setup();
    const uploaded = {
      id: "att-1",
      taskId: "t1",
      filename: "new.txt",
      size: 5,
      mimeType: "text/plain",
      uploadedAt: "2026-08-30T10:00:00.000Z",
      uploadedBy: "u1",
      uploaderEmail: "admin@example.com",
    };
    const activityAfterUpload = [
      {
        id: "act-1",
        entityType: "task",
        entityId: "t1",
        action: "attachment_added",
        at: "2026-08-30T10:00:00.000Z",
        byUserId: "u1",
        actorEmail: "admin@example.com",
        metadata: { attachmentId: "att-1", filename: "new.txt" },
      },
    ];
    let activityCallCount = 0;

    const fetchMock = vi.fn((input: string | Request, init?: RequestInit) => {
      const url = urlOf(input);
      if (url.endsWith("/comments")) {
        return Promise.resolve(jsonResponse(200, { data: [] }));
      }
      if (url.endsWith("/activity")) {
        activityCallCount += 1;
        return Promise.resolve(jsonResponse(200, { data: activityCallCount === 1 ? [] : activityAfterUpload }));
      }
      if (url.endsWith("/files") && init?.method === "POST") {
        return Promise.resolve(jsonResponse(201, { data: uploaded }));
      }
      if (url.endsWith("/files")) {
        return Promise.resolve(jsonResponse(200, { data: [] }));
      }
      throw new Error(`unexpected fetch: ${url}`);
    });
    vi.stubGlobal("fetch", fetchMock);

    render(<TaskDetail task={makeTask({})} dependencyCodes={[]} open onOpenChange={vi.fn()} canEdit />);

    await waitFor(() => expect(screen.getByTestId("task-activity-empty")).toBeInTheDocument());

    const input = screen.getByTestId("task-attachment-input");
    const file = new File(["hello"], "new.txt", { type: "text/plain" });
    await user.upload(input, file);

    await waitFor(() => expect(screen.getByTestId("task-activity-list")).toBeInTheDocument());
    expect(screen.getByTestId("task-activity-summary")).toHaveTextContent("добавил файл «new.txt»");
    expect(screen.getByRole("dialog")).toBeInTheDocument();
  });
});

describe("TaskDetail export", () => {
  it("shows CSV, PDF and Excel export actions in view mode", async () => {
    const user = userEvent.setup();
    render(<TaskDetail task={makeTask({})} dependencyCodes={[]} open onOpenChange={vi.fn()} />);

    expect(await screen.findByTestId("task-export-trigger")).toBeInTheDocument();
    await user.click(screen.getByTestId("task-export-trigger"));
    expect(await screen.findByTestId("task-export-csv")).toBeInTheDocument();
    expect(screen.getByTestId("task-export-pdf")).toBeInTheDocument();
    expect(screen.getByTestId("task-export-xlsx")).toBeInTheDocument();
  });

  it("shows the export actions for a read-only viewer, not only an editor", async () => {
    render(<TaskDetail task={makeTask({})} dependencyCodes={[]} open onOpenChange={vi.fn()} canEdit={false} />);

    expect(await screen.findByTestId("task-export")).toBeInTheDocument();
  });

  it("hides export actions in edit mode", async () => {
    const user = userEvent.setup();
    render(<TaskDetail task={makeTask({})} dependencyCodes={[]} open onOpenChange={vi.fn()} canEdit />);

    await user.click(screen.getByTestId("task-detail-edit"));

    expect(screen.queryByTestId("task-export")).not.toBeInTheDocument();
  });
});

function changesResponse(overrides: Partial<{
  changed: boolean;
  actorEmail: string | null;
  summary: string | null;
}> = {}) {
  return jsonResponse(200, {
    data: {
      taskId: "t1",
      listId: "l1",
      changed: false,
      latestAt: null,
      actorUserId: null,
      actorEmail: null,
      changedFields: [],
      summary: null,
      ...overrides,
    },
  });
}

describe("TaskDetail external change notification", () => {
  it("does not poll for external changes when otherUserChangesEnabled is not set (default)", async () => {
    const fetchMock = stubFetchForTaskAction(() => jsonResponse(200, { data: [] }));
    render(<TaskDetail task={makeTask({ id: "t1" })} dependencyCodes={[]} open onOpenChange={vi.fn()} canEdit />);

    await waitFor(() => expect(screen.getByTestId("task-activity-empty")).toBeInTheDocument());
    expect(fetchMock.mock.calls.some(([input]) => urlOf(input).includes("/changes"))).toBe(false);
  });

  it("shows a notification banner with the server-provided summary when another user changed the open task", async () => {
    const fetchMock = vi.fn((input: string | Request) => {
      const url = urlOf(input);
      if (url.includes("/changes")) {
        return Promise.resolve(
          changesResponse({
            changed: true,
            actorEmail: "other@example.com",
            summary: "other@example.com изменил приоритет: 3 → 9",
          }),
        );
      }
      if (url.endsWith("/comments") || url.endsWith("/activity") || url.endsWith("/files")) {
        return Promise.resolve(jsonResponse(200, { data: [] }));
      }
      throw new Error(`unexpected fetch: ${url}`);
    });
    vi.stubGlobal("fetch", fetchMock);

    render(
      <TaskDetail
        task={makeTask({ id: "t1" })}
        dependencyCodes={[]}
        open
        onOpenChange={vi.fn()}
        canEdit
        otherUserChangesEnabled
      />,
    );

    expect(await screen.findByTestId("task-detail-external-change")).toHaveTextContent(
      "other@example.com изменил приоритет: 3 → 9",
    );
  });

  it("does not show a banner when there is no external change", async () => {
    const fetchMock = vi.fn((input: string | Request) => {
      const url = urlOf(input);
      if (url.includes("/changes")) {
        return Promise.resolve(changesResponse({ changed: false }));
      }
      if (url.endsWith("/comments") || url.endsWith("/activity") || url.endsWith("/files")) {
        return Promise.resolve(jsonResponse(200, { data: [] }));
      }
      throw new Error(`unexpected fetch: ${url}`);
    });
    vi.stubGlobal("fetch", fetchMock);

    render(
      <TaskDetail
        task={makeTask({ id: "t1" })}
        dependencyCodes={[]}
        open
        onOpenChange={vi.fn()}
        canEdit
        otherUserChangesEnabled
      />,
    );

    await waitFor(() => expect(screen.getByTestId("task-activity-empty")).toBeInTheDocument());
    expect(screen.queryByTestId("task-detail-external-change")).not.toBeInTheDocument();
  });

  it("clicking Обновить merges the external change without discarding an unsaved inline draft", async () => {
    const user = userEvent.setup();
    const fresh = makeTask({ id: "t1", title: "Внешнее", priority: 9 });
    const fetchMock = vi.fn((input: string | Request, init?: RequestInit) => {
      const url = urlOf(input);
      if (url.includes("/changes")) {
        return Promise.resolve(
          changesResponse({
            changed: true,
            actorEmail: "other@example.com",
            summary: "other@example.com изменил приоритет: 3 → 9",
          }),
        );
      }
      if (url.endsWith("/comments") || url.endsWith("/activity") || url.endsWith("/files")) {
        return Promise.resolve(jsonResponse(200, { data: [] }));
      }
      if (url.endsWith("/api/tasks/t1")) {
        if (init?.method === "PATCH") {
          return Promise.resolve(
            jsonResponse(200, { data: { task: { ...fresh, ...JSON.parse(String(init.body)) }, cascade: [] } }),
          );
        }
        return Promise.resolve(jsonResponse(200, { data: fresh }));
      }
      throw new Error(`unexpected fetch: ${url}`);
    });
    vi.stubGlobal("fetch", fetchMock);

    render(
      <TaskDetail
        task={makeTask({ id: "t1", title: "Старое", priority: 3 })}
        dependencyCodes={[]}
        open
        onOpenChange={vi.fn()}
        canEdit
        otherUserChangesEnabled
      />,
    );

    await screen.findByTestId("task-detail-external-change");

    fireEvent.change(screen.getByLabelText("Название"), { target: { value: "Черновик пользователя" } });

    await user.click(screen.getByTestId("task-detail-external-change-refresh"));

    await waitFor(() => expect(screen.getByLabelText("Приоритет")).toHaveValue(9));
    expect(screen.getByLabelText("Название")).toHaveValue("Черновик пользователя");
  });

  it("hides the refresh action while the full edit form is open, so it cannot discard an in-progress edit", async () => {
    const user = userEvent.setup();
    const fetchMock = vi.fn((input: string | Request) => {
      const url = urlOf(input);
      if (url.includes("/changes")) {
        return Promise.resolve(changesResponse({ changed: true, actorEmail: "other@example.com", summary: null }));
      }
      if (url.endsWith("/comments") || url.endsWith("/activity") || url.endsWith("/files")) {
        return Promise.resolve(jsonResponse(200, { data: [] }));
      }
      throw new Error(`unexpected fetch: ${url}`);
    });
    vi.stubGlobal("fetch", fetchMock);

    render(
      <TaskDetail
        task={makeTask({ id: "t1" })}
        dependencyCodes={[]}
        open
        onOpenChange={vi.fn()}
        canEdit
        otherUserChangesEnabled
      />,
    );

    await screen.findByTestId("task-detail-external-change");
    await user.click(screen.getByTestId("task-detail-edit"));

    expect(screen.getByTestId("task-detail-external-change")).toBeInTheDocument();
    expect(screen.queryByTestId("task-detail-external-change-refresh")).not.toBeInTheDocument();
  });
});
