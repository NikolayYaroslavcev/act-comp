import { describe, expect, it } from "vitest";
import { NextRequest } from "next/server";
import { POST } from "./route";
import { SESSION_COOKIE_NAME } from "@/features/auth/session-cookie";
import { createSession } from "@/entities/session/repository";
import { createList, findListById } from "@/entities/list/repository";
import { createTask, findTaskById } from "@/entities/task/repository";
import { PDFDocument } from "pdf-lib";

function pdfRequest(id: string, sessionId: string | undefined, body?: unknown) {
  return new NextRequest(`http://localhost/api/tasks/${id}/export/pdf`, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      ...(sessionId ? { cookie: `${SESSION_COOKIE_NAME}=${sessionId}` } : {}),
    },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
}

async function callExport(id: string, request: NextRequest) {
  return await POST(request, { params: Promise.resolve({ id }) });
}

async function sessionFor(userId: "u1" | "u2" | "u3", suffix: string) {
  return await createSession({
    userId,
    ip: `192.0.2.${suffix} (demo)`,
    device: "Chrome on Windows",
    rememberMe: false,
  });
}

async function makeVisibleTask(suffix: string) {
  const list = await createList("u1", { title: `List ${suffix}`, template: "work", deadline: null });
  const task = await createTask({
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

describe("POST /api/tasks/[id]/export/pdf", () => {
  it("returns 401 when no session cookie is present", async () => {
    const { task } = await makeVisibleTask("1");
    const response = await callExport(task.id, pdfRequest(task.id, undefined));
    expect(response.status).toBe(401);
  });

  it("returns 404 for a task the caller cannot see, without leaking it", async () => {
    const session = await sessionFor("u2", "80");
    const { task } = await makeVisibleTask("2");
    const response = await callExport(task.id, pdfRequest(task.id, session.id));
    expect(response.status).toBe(404);
    const json = await response.json();
    expect(json.error.message).toBe("Task not found");
  });

  it("returns 404 for an unknown task id", async () => {
    const session = await sessionFor("u1", "83");
    const response = await callExport("does-not-exist", pdfRequest("does-not-exist", session.id));
    expect(response.status).toBe(404);
  });

  it("returns 404 for a soft-deleted task even for its owner", async () => {
    const session = await sessionFor("u1", "84");
    const { task } = await makeVisibleTask("3");
    (await findTaskById(task.id))!.deletedAt = new Date().toISOString();
    const response = await callExport(task.id, pdfRequest(task.id, session.id));
    expect(response.status).toBe(404);
  });

  it("returns a PDF for the owner with the task code and title as the document title", async () => {
    const session = await sessionFor("u1", "81");
    const { task } = await makeVisibleTask("4");
    const response = await callExport(task.id, pdfRequest(task.id, session.id));
    expect(response.status).toBe(200);
    expect(response.headers.get("content-type")).toBe("application/pdf");
    const bytes = new Uint8Array(await response.arrayBuffer());
    const pdf = await PDFDocument.load(bytes);
    expect(pdf.getTitle()).toBe(`${task.code} ${task.title}`);
  });

  it("allows a shared reader to export", async () => {
    const session = await sessionFor("u2", "82");
    const { list, task } = await makeVisibleTask("5");
    (await findListById(list.id))!.sharedWith.push({ userId: "u2", access: "read" });
    const response = await callExport(task.id, pdfRequest(task.id, session.id));
    expect(response.status).toBe(200);
  });

  it("allows a shared editor to export", async () => {
    const session = await sessionFor("u3", "86");
    const { list, task } = await makeVisibleTask("6");
    (await findListById(list.id))!.sharedWith.push({ userId: "u3", access: "edit" });
    const response = await callExport(task.id, pdfRequest(task.id, session.id));
    expect(response.status).toBe(200);
  });

  it("ignores a spoofed userId in the request body and still enforces real access", async () => {
    const session = await sessionFor("u2", "87");
    const { task } = await makeVisibleTask("7");
    const response = await callExport(task.id, pdfRequest(task.id, session.id, { userId: "u1" }));
    expect(response.status).toBe(404);
  });
});
