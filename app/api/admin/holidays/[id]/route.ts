/**
 * PATCH /api/admin/holidays/[id] — resmî tatil düzenle / aktif-pasif (yalnız ADMIN).
 * Kısmi gövde kabul edilir (ör. yalnız { isActive: false }); mevcut kayıtla
 * birleştirilip TAMAMI yeniden doğrulanır. Silme yok — kayıt pasife alınır
 * (geçmiş izin hesapları için iz kalsın).
 */
import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { holidayAdminSelect, loadHolidayAdmin } from "@/lib/holidays-data";
import { parseDateKey, utcDateKey, validateHolidayInput } from "@/lib/holidays";

export const dynamic = "force-dynamic";

export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  const session = await getServerSession(authOptions);
  const sessionUserId = (session?.user as { id?: string } | undefined)?.id;
  if (!sessionUserId) return NextResponse.json({ error: "Yetkisiz" }, { status: 401 });
  if (!(await loadHolidayAdmin(sessionUserId))) {
    return NextResponse.json({ error: "Resmî tatilleri yalnız Admin yönetebilir" }, { status: 403 });
  }

  const existing = await prisma.publicHoliday.findUnique({ where: { id: params.id } });
  if (!existing) return NextResponse.json({ error: "Tatil bulunamadı" }, { status: 404 });

  const body = (await req.json().catch(() => null)) ?? {};
  const merged = {
    name: existing.name,
    startDate: utcDateKey(existing.startDate),
    endDate: utcDateKey(existing.endDate),
    dayType: existing.dayType,
    halfDayPeriod: existing.halfDayPeriod,
    description: existing.description,
    isRecurringAnnually: existing.isRecurringAnnually,
    isActive: existing.isActive,
    ...body,
  };
  const parsed = validateHolidayInput(merged);
  if ("error" in parsed) return NextResponse.json({ error: parsed.error }, { status: 400 });
  const v = parsed.value;

  const updated = await prisma.publicHoliday.update({
    where: { id: params.id },
    data: {
      name: v.name,
      startDate: parseDateKey(v.startDate)!,
      endDate: parseDateKey(v.endDate)!,
      dayType: v.dayType,
      halfDayPeriod: v.halfDayPeriod,
      description: v.description,
      isRecurringAnnually: v.isRecurringAnnually,
      isActive: v.isActive,
    },
    select: holidayAdminSelect,
  });
  return NextResponse.json(updated);
}
