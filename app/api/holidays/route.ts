/**
 * GET /api/holidays?from=YYYY-MM-DD&to=YYYY-MM-DD — aktif resmî tatil günleri.
 *
 * Tüm oturum sahipleri okuyabilir (resmî tatil gizli veri değildir); yalnız
 * AKTİF kayıtlar, günlere açılmış hâlde döner (lib/holidays-data.ts). Yönetim
 * (oluştur/düzenle/pasif) yalnız Admin: /api/admin/holidays.
 * Kullanım: izin talebi formunda gün sayısı önizlemesi.
 */
import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { loadHolidayOccurrences } from "@/lib/holidays-data";
import { parseDateKey } from "@/lib/holidays";

export const dynamic = "force-dynamic";

const MAX_RANGE_DAYS = 400;

export async function GET(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "Yetkisiz" }, { status: 401 });

  const params = new URL(req.url).searchParams;
  const fromKey = params.get("from") ?? "";
  const toKey = params.get("to") ?? "";
  const from = parseDateKey(fromKey);
  const to = parseDateKey(toKey);
  if (!from || !to || to < from) {
    return NextResponse.json({ error: "Geçerli bir tarih aralığı girin (from, to)" }, { status: 400 });
  }
  if ((to.getTime() - from.getTime()) / 86_400_000 > MAX_RANGE_DAYS) {
    return NextResponse.json({ error: "Tarih aralığı çok geniş" }, { status: 400 });
  }

  const holidays = await loadHolidayOccurrences(fromKey, toKey);
  return NextResponse.json({ holidays });
}
