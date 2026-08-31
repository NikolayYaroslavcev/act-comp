import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { jsonError } from "@/shared/lib/api-response";
import { requireAuth } from "@/features/auth/require-auth";
import { exportListPdf, exportPdfBodySchema } from "@/features/export/export-list-pdf";

type RouteContext = { params: Promise<{ id: string }> };

export async function POST(request: NextRequest, { params }: RouteContext) {
  const auth = await requireAuth(request);
  if (!auth.authorized) {
    return jsonError(401, "Unauthorized");
  }

  const { id } = await params;
  const body = await request.json().catch(() => ({}));
  const parsed = exportPdfBodySchema.safeParse(body);
  if (!parsed.success) {
    return jsonError(400, "Validation failed", parsed.error.issues);
  }

  const result = await exportListPdf(auth.user.id, id, parsed.data.taskIds);
  if (result.status === "not_found") {
    return jsonError(404, "List not found");
  }

  const copy = new ArrayBuffer(result.bytes.byteLength);
  new Uint8Array(copy).set(result.bytes);
  return new NextResponse(copy, {
    status: 200,
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `attachment; filename*=UTF-8''${encodeURIComponent(result.filename)}`,
    },
  });
}
