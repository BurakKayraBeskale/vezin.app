/**
 * GET /api/tasks/board — Görev Takip (Kanban) ekranının veri ucu.
 *
 * Görünürlük tamamen mevcut Task Core'dan gelir (lib/task-board.ts →
 * buildTaskVisibilityWhereForUser + filterRelatedTaskVisibility). Bu uç
 * yalnızca sorgu/sayfalama/sıralama katmanıdır; yeni bir permission kuralı
 * ÜRETMEZ.
 *
 * Sorgu parametreleri (tümü opsiyonel):
 *   view=mine|given|all               (varsayılan mine)
 *   q=<arama metni>
 *   projectId=<id>|none               (boş = tümü)
 *   personId=<userId>                 (boş = tümü)
 *   priority=LOW|MEDIUM|HIGH          (boş = tümü)
 *   overdue=yes|no                    (boş = tümü)
 *   department=OUTSOURCE|BAGIMSIZ_DENETIM|MUHASEBE|YMM   (yalnızca ADMIN; diğerlerinde yok sayılır)
 *   completedRange=30d|all            (varsayılan 30d — yalnızca DONE kolonunu etkiler)
 *
 *   column=TODO|IN_PROGRESS|REVIEW|DONE + offset=<n>
 *     → yalnızca o kolonun sonraki sayfasını döner ("Daha Fazla Göster").
 *     Verilmezse panonun tamamı (4 kolon + filtre seçenekleri) döner.
 */
import { NextRequest, NextResponse } from "next/server";
import { getToken } from "next-auth/jwt";
import {
  BOARD_STATUSES,
  BoardStatus,
  fetchBoardColumn,
  fetchBoardData,
  parseBoardFilters,
} from "@/lib/task-board";

export async function GET(req: NextRequest) {
  const token = await getToken({ req, secret: process.env.NEXTAUTH_SECRET });
  if (!token) return NextResponse.json({ error: "Yetkisiz" }, { status: 401 });

  const params = new URL(req.url).searchParams;
  const filters = parseBoardFilters(params);

  const user = {
    id: token.id as string,
    role: (token as any).role as string,
    department: (token as any).department as string | undefined,
    seniorityLevel: (token as any).seniorityLevel as number | undefined,
    canViewAllProjects: ((token as any).canViewAllProjects as boolean) ?? false,
    overseesDepartment: ((token as any).overseesDepartment as string | null) ?? null,
    isAdmin: (token as any).role === "ADMIN",
  };

  const columnParam = params.get("column");
  if (columnParam) {
    if (!(BOARD_STATUSES as readonly string[]).includes(columnParam)) {
      return NextResponse.json({ error: "Geçersiz kolon" }, { status: 400 });
    }
    const offset = Math.max(0, Number(params.get("offset")) || 0);
    const column = await fetchBoardColumn(user, filters, columnParam as BoardStatus, offset);
    return NextResponse.json(column);
  }

  const board = await fetchBoardData(user, filters);
  return NextResponse.json(board);
}
