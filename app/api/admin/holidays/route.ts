/**
 * Sistem Ayarları → Resmî Tatiller (yalnız ADMIN).
 *   GET  /api/admin/holidays?year=2026  — liste (pasifler dahil)
 *   POST /api/admin/holidays            — yeni tatil
 *
 * Kapı: loadHolidayAdmin (DB'den güncel rol). Admin olmayan → 403.
 * Doğrulama: lib/holidays.ts → validateHolidayInput (form ile ortak).
 * Okuma (tüm kullanıcılar, yalnız aktif): /api/holidays.
 */
import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { holidayAdminSelect, listHolidaysForAdmin, loadHolidayAdmin } from "@/lib/holidays-data";
import { parseDateKey, validateHolidayInput } from "@/lib/holidays";

export const dynamic = "force-dynamic";

async function guard() {
  const session = await getServerSession(authOptions);
  const sessionUserId = (session?.user as { id?: string } | undefined)?.id;
  if (!sessionUserId) return { res: NextResponse.json({ error: "Yetkisiz" }, { status: 401 }) };
  const admin = await loadHolidayAdmin(sessionUserId);
  if (!admin) return { res: NextResponse.json({ error: "Resmî tatilleri yalnız Admin yönetebilir" }, { status: 403 }) };
  return { admin };
}

export async function GET(req: NextRequest) {
  const g = await guard();
  if (!g.admin) return g.res;
  const yearParam = new URL(req.url).searchParams.get("year");
  const year = yearParam && /^\d{4}$/.test(yearParam) ? Number(yearParam) : null;
  const holidays = await listHolidaysForAdmin(year);
  return NextResponse.json({ holidays }, { headers: { "Cache-Control": "private, no-store" } });
}

export async function POST(req: NextRequest) {
  const g = await guard();
  if (!g.admin) return g.res;
  const parsed = validateHolidayInput(await req.json().catch(() => null));
  if ("error" in parsed) return NextResponse.json({ error: parsed.error }, { status: 400 });
  const v = parsed.value;
  const created = await prisma.publicHoliday.create({
    data: {
      name: v.name,
      startDate: parseDateKey(v.startDate)!,
      endDate: parseDateKey(v.endDate)!,
      dayType: v.dayType,
      halfDayPeriod: v.halfDayPeriod,
      description: v.description,
      isRecurringAnnually: v.isRecurringAnnually,
      isActive: v.isActive,
      createdById: g.admin.id,
    },
    select: holidayAdminSelect,
  });
  return NextResponse.json(created, { status: 201 });
}
