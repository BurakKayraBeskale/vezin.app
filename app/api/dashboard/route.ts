/**
 * GET /api/dashboard?userId=<id> — Dashboard özeti (tek yanıt):
 *   KPI'lar, Görev Dağılımı, Bekleyen İşlemler, Bugün & Yaklaşan İşler,
 *   Öne Çıkan Projeler, (yetkiliyse) şahsi harcama özeti.
 *
 * userId verilmezse viewer'ın kendisi. Viewer'ın seçemeyeceği kişi → 404
 * (getDashboardSelectableUsers — lib/dashboard/people.ts). Kişi seçmek yetki
 * vermez: tüm veriler viewer'ın görünürlüğüyle filtrelenir (lib/dashboard/service.ts).
 */
import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { canViewDashboardOf, loadDashboardViewer } from "@/lib/dashboard/people";
import { getDashboardSummary } from "@/lib/dashboard/service";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const session = await getServerSession(authOptions);
  const sessionUserId = (session?.user as { id?: string } | undefined)?.id;
  if (!sessionUserId) return NextResponse.json({ error: "Yetkisiz" }, { status: 401 });

  const viewer = await loadDashboardViewer(sessionUserId);
  if (!viewer) return NextResponse.json({ error: "Yetkisiz" }, { status: 401 });

  const targetId = new URL(req.url).searchParams.get("userId") || viewer.id;
  if (!(await canViewDashboardOf(viewer, targetId))) {
    return NextResponse.json({ error: "Personel bulunamadı" }, { status: 404 });
  }
  const target = await prisma.user.findUnique({
    where: { id: targetId },
    select: { id: true, name: true, role: true, email: true, department: true, status: true },
  });
  if (!target || target.status !== "ACTIVE") {
    return NextResponse.json({ error: "Personel bulunamadı" }, { status: 404 });
  }

  const summary = await getDashboardSummary(viewer, target);
  return NextResponse.json(summary, { headers: { "Cache-Control": "private, no-store" } });
}
