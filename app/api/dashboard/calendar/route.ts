/**
 * GET /api/dashboard/calendar?userId=<id>&from=YYYY-MM-DD&to=YYYY-MM-DD — Akıllı Takvim.
 *
 * Kişi kapısı /api/dashboard ile AYNI (loadDashboardTarget → seçilemeyen kişi 404);
 * kişi seçmek yetki vermez. Görev/izin/tatil verisi viewer'ın görünürlüğüyle
 * filtrelenir: lib/dashboard/calendar-service.ts. Aralık en fazla
 * CALENDAR_MAX_RANGE_DAYS gün (6 haftalık ay ızgarası).
 */
import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { loadDashboardTarget, loadDashboardViewer } from "@/lib/dashboard/people";
import { getDashboardCalendar } from "@/lib/dashboard/calendar-service";
import { CALENDAR_MAX_RANGE_DAYS } from "@/lib/dashboard/calendar";
import { parseDateKey } from "@/lib/holidays";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const session = await getServerSession(authOptions);
  const sessionUserId = (session?.user as { id?: string } | undefined)?.id;
  if (!sessionUserId) return NextResponse.json({ error: "Yetkisiz" }, { status: 401 });

  const viewer = await loadDashboardViewer(sessionUserId);
  if (!viewer) return NextResponse.json({ error: "Yetkisiz" }, { status: 401 });

  const params = new URL(req.url).searchParams;
  const fromKey = params.get("from") ?? "";
  const toKey = params.get("to") ?? "";
  const from = parseDateKey(fromKey);
  const to = parseDateKey(toKey);
  if (!from || !to || to < from || (to.getTime() - from.getTime()) / 86_400_000 >= CALENDAR_MAX_RANGE_DAYS) {
    return NextResponse.json({ error: "Geçerli bir tarih aralığı girin" }, { status: 400 });
  }

  const target = await loadDashboardTarget(viewer, params.get("userId") || viewer.id);
  if (!target) return NextResponse.json({ error: "Personel bulunamadı" }, { status: 404 });

  const calendar = await getDashboardCalendar(viewer, target, fromKey, toKey);
  return NextResponse.json(calendar, { headers: { "Cache-Control": "private, no-store" } });
}
