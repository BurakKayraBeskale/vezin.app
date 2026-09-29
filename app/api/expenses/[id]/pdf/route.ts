/**
 * GET /api/expenses/[id]/pdf — sistemin ürettiği "Personel Harcama Formu" PDF'i.
 *   ?documents=1 → form + personelin yüklediği harcama belgeleri, TEK PDF
 *   ?download=1  → indir (varsayılan: tarayıcıda görüntüle/yazdır)
 *
 * Yetki: formu görebilen kullanıcı (canViewExpenseForm) — değilse 404.
 * Birleşik PDF talep anında üretilir, storage'a yazılmaz. Harcama belgesi
 * sunucudan kaldırılmışsa yalnız form PDF'i döner (içinde arşiv notu yer alır)
 * ve X-Expense-Document: archived başlığı eklenir.
 */
import { NextRequest, NextResponse } from "next/server";
import { withExpenseContext } from "@/lib/expense/http";
import { getExpenseDetail } from "@/lib/expense/data";
import { renderExpenseFormPdf } from "@/lib/expense/pdf";
import { readExpenseDocument } from "@/lib/expense/workflow";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest, { params }: { params: { id: string } }) {
  return withExpenseContext(async ({ actor, scope }) => {
    const sp = new URL(req.url).searchParams;
    const withDocuments = sp.get("documents") === "1";
    const detail = await getExpenseDetail(params.id, actor, scope);

    let documentPdf: Buffer | null = null;
    let documentState: "none" | "included" | "archived" = "none";
    if (withDocuments) {
      if (detail.activeDocument) {
        documentPdf = (await readExpenseDocument(actor, scope, params.id, detail.activeDocument.id)).buffer;
        documentState = "included";
      } else if (detail.archivedDocuments.length > 0) {
        documentState = "archived";
      }
    }

    const { buffer } = await renderExpenseFormPdf(detail, { documentPdf });
    const name = `${detail.formNo}${documentState === "included" ? "-belgeler" : ""}.pdf`;
    const disposition = sp.get("download") === "1" ? "attachment" : "inline";
    return new NextResponse(buffer as unknown as BodyInit, {
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `${disposition}; filename*=UTF-8''${encodeURIComponent(name)}`,
        "Content-Length": buffer.length.toString(),
        "X-Content-Type-Options": "nosniff",
        "Cache-Control": "private, no-store",
        "X-Expense-Document": documentState,
      },
    });
  });
}
