import type { NextRequest } from "next/server";
import { jsonError, jsonOk } from "@/shared/lib/api-response";
import { requireAuth } from "@/features/auth/require-auth";
import { listTaskAttachmentsForUser } from "@/features/attachment/list-task-attachments";
import { uploadTaskAttachmentForUser } from "@/features/attachment/upload-task-attachment";

type RouteContext = { params: Promise<{ id: string }> };

export async function GET(request: NextRequest, { params }: RouteContext) {
  const auth = requireAuth(request);
  if (!auth.authorized) {
    return jsonError(401, "Unauthorized");
  }

  const { id } = await params;
  const result = listTaskAttachmentsForUser(auth.user.id, id);
  if (result.status === "not_found") {
    return jsonError(404, "Task not found");
  }

  return jsonOk(result.attachments);
}

export async function POST(request: NextRequest, { params }: RouteContext) {
  const auth = requireAuth(request);
  if (!auth.authorized) {
    return jsonError(401, "Unauthorized");
  }

  const { id } = await params;

  const formData = await request.formData().catch(() => null);
  if (!formData) {
    return jsonError(400, "Invalid multipart form data");
  }

  const file = formData.get("file");
  // `FormData#get` only ever returns `string | File | null` — ruling out the
  // other two identifies a File without `instanceof File`, which can give a
  // false negative across realms (e.g. jsdom's File vs. undici's inside
  // NextRequest's own formData() parsing).
  if (file === null || typeof file === "string") {
    return jsonError(400, "Missing file");
  }

  const bytes = new Uint8Array(await file.arrayBuffer());
  const filename = file.name.trim() !== "" ? file.name : "file";
  const mimeType = file.type !== "" ? file.type : "application/octet-stream";

  const result = uploadTaskAttachmentForUser(auth.user.id, id, { filename, mimeType, bytes });
  switch (result.status) {
    case "not_found":
      return jsonError(404, "Task not found");
    case "forbidden":
      return jsonError(403, "You do not have permission to upload files to this task");
    case "empty_file":
      return jsonError(400, "File is empty");
    case "too_large":
      return jsonError(413, "File exceeds the maximum allowed size");
    case "ok":
      return jsonOk(result.attachment, 201);
  }
}
