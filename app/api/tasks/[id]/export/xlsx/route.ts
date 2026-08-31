import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { jsonError } from "@/shared/lib/api-response";
import { requireAuth } from "@/features/auth/require-auth";
import { exportTaskXlsx } from "@/features/export/export-task-xlsx";

type RouteContext = { params: Promise<{ id: string }> };

export async function POST(request: NextRequest, { params }: RouteContext) {
  const auth = requireAuth(request);
  if (!auth.authorized) {
    return jsonError(401, "Unauthorized");
  }

  const { id } = await params;
  const result = await exportTaskXlsx(auth.user.id, id);
  if (result.status === "not_found") {
    return jsonError(404, "Task not found");
  }

  const copy = new ArrayBuffer(result.bytes.byteLength);
  new Uint8Array(copy).set(result.bytes);
  return new NextResponse(copy, {
    status: 200,
    headers: {
      "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Content-Disposition": `attachment; filename*=UTF-8''${encodeURIComponent(result.filename)}`,
    },
  });
}
