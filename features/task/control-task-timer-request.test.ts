import { afterEach, describe, expect, it, vi } from "vitest";
import {
  FORBIDDEN_MESSAGE,
  INVALID_TRANSITION_MESSAGE,
  NETWORK_ERROR_MESSAGE,
  NOT_FOUND_MESSAGE,
  SESSION_EXPIRED_MESSAGE,
  TASK_COMPLETED_MESSAGE,
  requestControlTaskTimer,
} from "@/features/task/control-task-timer-request";
import type { Task } from "@/entities/task/schema";

function jsonResponse(status: number, body: unknown) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json" },
  });
}

function makeTask(overrides: Partial<Task> = {}): Task {
  return {
    id: "t1",
    listId: "l1",
    code: "TEST-1",
    title: "Task",
    description: "",
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
    timerStartedAt: "2026-08-29T10:00:00.000Z",
    timerPausedAt: null,
    extensions: [],
    history: [],
    deletedAt: null,
    ...overrides,
  };
}

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("requestControlTaskTimer", () => {
  it("POSTs the action and returns the updated task", async () => {
    const task = makeTask();
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(jsonResponse(200, { data: task })));

    const result = await requestControlTaskTimer("t1", "start");

    expect(result).toEqual({ status: "ok", task });
    expect(fetch).toHaveBeenCalledWith(
      "/api/tasks/t1/timer",
      expect.objectContaining({ method: "POST", body: JSON.stringify({ action: "start" }) }),
    );
  });

  it.each([
    [401, SESSION_EXPIRED_MESSAGE],
    [403, FORBIDDEN_MESSAGE],
    [404, NOT_FOUND_MESSAGE],
  ])("maps %i to an error message", async (status, message) => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(jsonResponse(status, { error: { message: "x" } })));

    expect(await requestControlTaskTimer("t1", "start")).toEqual({ status: "error", message });
  });

  it("maps a completed-task 409 to a dedicated message", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(jsonResponse(409, { error: { message: "Task is completed" } })),
    );

    expect(await requestControlTaskTimer("t1", "start")).toEqual({
      status: "error",
      message: TASK_COMPLETED_MESSAGE,
    });
  });

  it("maps an invalid-transition 409 to a dedicated message", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(jsonResponse(409, { error: { message: "Invalid timer transition" } })),
    );

    expect(await requestControlTaskTimer("t1", "pause")).toEqual({
      status: "error",
      message: INVALID_TRANSITION_MESSAGE,
    });
  });

  it("returns a network error when fetch throws", async () => {
    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new TypeError("Failed to fetch")));

    expect(await requestControlTaskTimer("t1", "start")).toEqual({
      status: "error",
      message: NETWORK_ERROR_MESSAGE,
    });
  });
});
