import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { jsonError } from "@/shared/lib/api-response";
import { requireAuth } from "@/features/auth/require-auth";
import { exportListXlsx, exportXlsxBodySchema } from "@/features/export/export-list-xlsx";

type RouteContext = { params: Promise<{ id: string }> };

export async function POST(request: NextRequest, { params }: RouteContext) {
  const auth = await requireAuth(request);
  if (!auth.authorized) {
    return jsonError(401, "Unauthorized");
  }

  const { id } = await params;
  const body = await request.json().catch(() => ({}));
  const parsed = exportXlsxBodySchema.safeParse(body);
  if (!parsed.success) {
    return jsonError(400, "Validation failed", parsed.error.issues);
  }

  const result = await exportListXlsx(auth.user.id, id, parsed.data.taskIds);
  if (result.status === "not_found") {
    return jsonError(404, "List not found");
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
