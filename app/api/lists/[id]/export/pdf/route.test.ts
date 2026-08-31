import { describe, expect, it } from "vitest";
import { NextRequest } from "next/server";
import { POST } from "./route";
import { SESSION_COOKIE_NAME } from "@/features/auth/session-cookie";
import { createSession } from "@/entities/session/repository";
import { createList, findListById } from "@/entities/list/repository";
import { createTask } from "@/entities/task/repository";
import { PDFDocument } from "pdf-lib";

function pdfRequest(id: string, sessionId: string | undefined, body?: unknown) {
  return new NextRequest(`http://localhost/api/lists/${id}/export/pdf`, {
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

describe("POST /api/lists/[id]/export/pdf", () => {
  it("returns 401 when no session cookie is present", async () => {
    const list = await createList("u1", { title: "Owned", template: "work", deadline: null });
    const response = await callExport(list.id, pdfRequest(list.id, undefined, {}));
    expect(response.status).toBe(401);
  });

  it("returns 404 for an inaccessible list without leaking it", async () => {
    const session = await sessionFor("u2", "80");
    const list = await createList("u1", { title: "Private", template: "work", deadline: null });
    const response = await callExport(list.id, pdfRequest(list.id, session.id, {}));
    expect(response.status).toBe(404);
    const json = await response.json();
    expect(json.error.message).toBe("List not found");
  });

  it("returns a PDF for the owner containing only requested visible tasks", async () => {
    const session = await sessionFor("u1", "81");
    const list = await createList("u1", { title: "Спринт", template: "work", deadline: null });
    const keep = await createTask({
      listId: list.id,
      title: "Keep me",
      description: "",
      priority: 3,
      category: null,
      tags: [],
      parentId: null,
      deadline: null,
      estimatedMin: 0,
    });
    const skip = await createTask({
      listId: list.id,
      title: "Skip me",
      description: "",
      priority: 3,
      category: null,
      tags: [],
      parentId: null,
      deadline: null,
      estimatedMin: 0,
    });

    const response = await callExport(list.id, pdfRequest(list.id, session.id, { taskIds: [keep.id, "not-a-task"] }));
    expect(response.status).toBe(200);
    expect(response.headers.get("content-type")).toBe("application/pdf");
    const bytes = new Uint8Array(await response.arrayBuffer());
    const pdf = await PDFDocument.load(bytes);
    expect(pdf.getTitle()).toBe("Спринт");
    expect(pdf.getKeywords()).toContain(keep.code);
    expect(pdf.getKeywords()).not.toContain(skip.code);
  });

  it("allows a shared reader to export", async () => {
    const session = await sessionFor("u2", "82");
    const list = await createList("u1", { title: "Shared", template: "work", deadline: null });
    (await findListById(list.id))!.sharedWith.push({ userId: "u2", access: "read" });
    const response = await callExport(list.id, pdfRequest(list.id, session.id, {}));
    expect(response.status).toBe(200);
  });
});
