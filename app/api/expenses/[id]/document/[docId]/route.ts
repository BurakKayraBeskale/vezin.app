/**
 * GET /api/expenses/[id]/document/[docId] — PDF'i görüntüler (?download=1 ile indirir).
 * Dosyalar public değildir; her istek formun görüntüleme yetkisinden geçer, yoksa 404.
 */
import { NextRequest, NextResponse } from "next/server";
import { withExpenseContext } from "@/lib/expense/http";
import { readExpenseDocument } from "@/lib/expense/workflow";

export async function GET(req: NextRequest, { params }: { params: { id: string; docId: string } }) {
  return withExpenseContext(async ({ actor, scope }) => {
    const { name, buffer } = await readExpenseDocument(actor, scope, params.id, params.docId);
    const disposition = new URL(req.url).searchParams.get("download") === "1" ? "attachment" : "inline";
    return new NextResponse(buffer, {
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `${disposition}; filename*=UTF-8''${encodeURIComponent(name)}`,
        "Content-Length": buffer.length.toString(),
        "X-Content-Type-Options": "nosniff",
        "Cache-Control": "private, no-store",
      },
    });
  });
}
