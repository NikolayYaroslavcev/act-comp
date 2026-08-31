import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { jsonError } from "@/shared/lib/api-response";
import { requireAuth } from "@/features/auth/require-auth";
import { downloadTaskAttachmentForUser } from "@/features/attachment/download-task-attachment";
import { deleteTaskAttachmentForUser } from "@/features/attachment/delete-task-attachment";

type RouteContext = { params: Promise<{ id: string; fileId: string }> };

export async function GET(request: NextRequest, { params }: RouteContext) {
  const auth = await requireAuth(request);
  if (!auth.authorized) {
    return jsonError(401, "Unauthorized");
  }

  const { id, fileId } = await params;
  const result = await downloadTaskAttachmentForUser(auth.user.id, id, fileId);
  if (result.status === "not_found") {
    return jsonError(404, "File not found");
  }

  const copy = new ArrayBuffer(result.bytes.byteLength);
  new Uint8Array(copy).set(result.bytes);
  return new NextResponse(copy, {
    status: 200,
    headers: {
      "Content-Type": "application/octet-stream",
      "Content-Disposition": `attachment; filename*=UTF-8''${encodeURIComponent(result.attachment.filename)}`,
      "Content-Length": String(result.bytes.byteLength),
    },
  });
}

export async function DELETE(request: NextRequest, { params }: RouteContext) {
  const auth = await requireAuth(request);
  if (!auth.authorized) {
    return jsonError(401, "Unauthorized");
  }

  const { id, fileId } = await params;
  const result = await deleteTaskAttachmentForUser(auth.user.id, id, fileId);
  switch (result.status) {
    case "not_found":
      return jsonError(404, "File not found");
    case "forbidden":
      return jsonError(403, "You do not have permission to delete files from this task");
    case "ok":
      return new NextResponse(null, { status: 204 });
  }
}
