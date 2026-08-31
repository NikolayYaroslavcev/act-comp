import { describe, expect, it } from "vitest";
import { NextRequest } from "next/server";
import { POST } from "./route";
import { SESSION_COOKIE_NAME } from "@/features/auth/session-cookie";
import { createSession } from "@/entities/session/repository";
import { createList, findListById } from "@/entities/list/repository";
import { createTask, findTaskById } from "@/entities/task/repository";
import ExcelJS from "exceljs";

function xlsxRequest(id: string, sessionId: string | undefined, body?: unknown) {
  return new NextRequest(`http://localhost/api/tasks/${id}/export/xlsx`, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      ...(sessionId ? { cookie: `${SESSION_COOKIE_NAME}=${sessionId}` } : {}),
    },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
}

function callExport(id: string, request: NextRequest) {
  return POST(request, { params: Promise.resolve({ id }) });
}

function sessionFor(userId: "u1" | "u2" | "u3", suffix: string) {
  return createSession({
    userId,
    ip: `192.0.3.${suffix} (demo)`,
    device: "Chrome on Windows",
    rememberMe: false,
  });
}

function makeVisibleTask(suffix: string) {
  const list = createList("u1", { title: `List ${suffix}`, template: "work", deadline: null });
  const task = createTask({
    listId: list.id,
    title: "Спринт задача",
    description: "Описание",
    priority: 3,
    category: null,
    tags: [],
    parentId: null,
    deadline: null,
    estimatedMin: 30,
  });
  return { list, task };
}

describe("POST /api/tasks/[id]/export/xlsx", () => {
  it("returns 401 when no session cookie is present", async () => {
    const { task } = makeVisibleTask("1");
    const response = await callExport(task.id, xlsxRequest(task.id, undefined));
    expect(response.status).toBe(401);
  });

  it("returns 404 for a task the caller cannot see, without leaking it", async () => {
    const session = sessionFor("u2", "80");
    const { task } = makeVisibleTask("2");
    const response = await callExport(task.id, xlsxRequest(task.id, session.id));
    expect(response.status).toBe(404);
    const json = await response.json();
    expect(json.error.message).toBe("Task not found");
  });

  it("returns 404 for an unknown task id", async () => {
    const session = sessionFor("u1", "83");
    const response = await callExport("does-not-exist", xlsxRequest("does-not-exist", session.id));
    expect(response.status).toBe(404);
  });

  it("returns 404 for a soft-deleted task even for its owner", async () => {
    const session = sessionFor("u1", "84");
    const { task } = makeVisibleTask("3");
    findTaskById(task.id)!.deletedAt = new Date().toISOString();
    const response = await callExport(task.id, xlsxRequest(task.id, session.id));
    expect(response.status).toBe(404);
  });

  it("returns a real xlsx file for the owner", async () => {
    const session = sessionFor("u1", "81");
    const { task } = makeVisibleTask("4");
    const response = await callExport(task.id, xlsxRequest(task.id, session.id));
    expect(response.status).toBe(200);
    expect(response.headers.get("content-type")).toBe(
      "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    );
    const bytes = new Uint8Array(await response.arrayBuffer());
    const workbook = new ExcelJS.Workbook();
    await workbook.xlsx.load(Buffer.from(bytes) as unknown as Parameters<typeof workbook.xlsx.load>[0]);
    expect(workbook.worksheets[0].getRow(2).getCell(1).value).toBe(task.code);
  });

  it("allows a shared reader to export", async () => {
    const session = sessionFor("u2", "82");
    const { list, task } = makeVisibleTask("5");
    findListById(list.id)!.sharedWith.push({ userId: "u2", access: "read" });
    const response = await callExport(task.id, xlsxRequest(task.id, session.id));
    expect(response.status).toBe(200);
  });

  it("allows a shared editor to export", async () => {
    const session = sessionFor("u3", "86");
    const { list, task } = makeVisibleTask("6");
    findListById(list.id)!.sharedWith.push({ userId: "u3", access: "edit" });
    const response = await callExport(task.id, xlsxRequest(task.id, session.id));
    expect(response.status).toBe(200);
  });

  it("ignores a spoofed userId in the request body and still enforces real access", async () => {
    const session = sessionFor("u2", "87");
    const { task } = makeVisibleTask("7");
    const response = await callExport(task.id, xlsxRequest(task.id, session.id, { userId: "u1" }));
    expect(response.status).toBe(404);
  });
});
