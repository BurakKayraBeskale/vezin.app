/**
 * Akıllı Takvim veri servisi — permission-aware AGGREGATOR (GET /api/dashboard/calendar).
 *
 * A bloğundaki kural aynen geçerli: seçili kişi (target) yalnız FİLTREDİR,
 * görünürlük daima VIEWER'a göredir. Kaynaklar:
 *   Görevler  → Görev Takip sorgu motoru (buildBoardBaseWhere, içinde Task Core
 *               görünürlüğü) + tarih kesişimi. Eşleme: lib/dashboard/calendar.ts
 *   İzinler   → mevcut leave workflow; YALNIZ nihai APPROVED + silinmemiş.
 *               Ayrıntı (tür, durum, link) yalnız izin modülünün kendi görünürlük
 *               kuralı (getLeaveViewScope) izin veriyorsa; aksi halde yalnız "İzinli".
 *   Tatiller  → merkezi Resmî Tatiller (lib/holidays-data.ts), herkese açık.
 */

import { prisma } from "@/lib/prisma";
import { getLeaveViewScope } from "@/lib/access";
import { buildBoardBaseWhere } from "@/lib/task-board";
import { LEAVE_STATUS_LABELS, LEAVE_TYPE_LABELS, type LeaveStatus, type LeaveType } from "@/lib/leave";
import { addDaysKey, parseDateKey, utcDateKey } from "@/lib/holidays";
import { loadHolidayOccurrences } from "@/lib/holidays-data";
import { calendarBoardFilters } from "./links";
import { CALENDAR_TASK_CAP, taskCalendarSpan, type CalendarLeaveDTO, type CalendarTaskDTO, type DashboardCalendarDTO } from "./calendar";
import type { DashboardViewer } from "./people";
import { boardUserOf, type DashboardTarget } from "./service";

/**
 * Viewer bu izin kaydının ayrıntısını görebilir mi? İzin modülünün kendi kuralı
 * (GET /api/leave/[id] → canSeeRequest ile aynı): sahibi veya kapsamındaki onaylayıcı/Admin.
 */
export function canSeeLeaveDetail(
  viewer: { id: string; role: string; email?: string | null },
  leave: { userId: string; userDepartment: string }
): boolean {
  if (leave.userId === viewer.id) return true;
  const scope = getLeaveViewScope(viewer);
  return scope === "ALL" || scope.includes(leave.userDepartment);
}

/** Tarih kesişimi: [from, toExclusive) aralığına değen ve en az bir tarihi olan görevler. */
function taskDateOverlapWhere(from: Date, toExclusive: Date): object {
  return {
    OR: [
      { startDate: { not: null, lt: toExclusive }, dueDate: { gte: from } },
      { startDate: null, dueDate: { gte: from, lt: toExclusive } },
      { dueDate: null, startDate: { gte: from, lt: toExclusive } },
    ],
  };
}

async function calendarTasks(viewer: DashboardViewer, personId: string, fromKey: string, toKey: string) {
  const from = parseDateKey(fromKey)!;
  const toExclusive = parseDateKey(addDaysKey(toKey, 1))!;
  const rows = await prisma.task.findMany({
    where: { AND: [buildBoardBaseWhere(boardUserOf(viewer), calendarBoardFilters(personId)), taskDateOverlapWhere(from, toExclusive)] } as any,
    select: {
      id: true,
      title: true,
      status: true,
      priority: true,
      startDate: true,
      dueDate: true,
      assignedTo: { select: { name: true } },
      project: { select: { name: true } },
    },
    orderBy: [{ dueDate: "asc" }, { startDate: "asc" }],
    take: CALENDAR_TASK_CAP + 1,
  });
  const truncated = rows.length > CALENDAR_TASK_CAP;
  const tasks: CalendarTaskDTO[] = [];
  for (const r of rows.slice(0, CALENDAR_TASK_CAP)) {
    const span = taskCalendarSpan(r.startDate, r.dueDate);
    if (!span || span.end < fromKey || span.start > toKey) continue;
    tasks.push({
      id: r.id,
      title: r.title,
      status: r.status as CalendarTaskDTO["status"],
      priority: r.priority as CalendarTaskDTO["priority"],
      kind: span.kind,
      start: span.start,
      end: span.end,
      startDate: r.startDate ? utcDateKey(r.startDate) : null,
      dueDate: r.dueDate ? utcDateKey(r.dueDate) : null,
      assignee: r.assignedTo?.name ?? null,
      project: r.project?.name ?? null,
    });
  }
  return { tasks, truncated };
}

async function calendarLeaves(viewer: DashboardViewer, target: DashboardTarget, fromKey: string, toKey: string): Promise<CalendarLeaveDTO[]> {
  const from = parseDateKey(fromKey)!;
  const toExclusive = parseDateKey(addDaysKey(toKey, 1))!;
  const rows = await prisma.leaveRequest.findMany({
    // Yalnız nihai onaylı: bekleyen / reddedilen / iptal edilen (deletedAt) takvime girmez
    where: { userId: target.id, status: "APPROVED", deletedAt: null, startDate: { lt: toExclusive }, endDate: { gte: from } },
    select: { id: true, startDate: true, endDate: true, type: true, status: true, days: true },
    orderBy: { startDate: "asc" },
  });
  const detailAllowed = canSeeLeaveDetail(viewer, { userId: target.id, userDepartment: target.department });
  const isOwner = viewer.id === target.id;
  return rows.map((l) => ({
    id: l.id,
    start: utcDateKey(l.startDate),
    end: utcDateKey(l.endDate),
    detail: detailAllowed
      ? {
          typeLabel: LEAVE_TYPE_LABELS[l.type as LeaveType] ?? l.type,
          statusLabel: LEAVE_STATUS_LABELS[l.status as LeaveStatus] ?? l.status,
          days: l.days,
          // Sahibi → Taleplerim'de kayıt; onaylayıcı/Admin → Personel İzin Durumu'nda kayıt
          href: isOwner ? `/leave?requestId=${l.id}` : `/izin-durumu?requestId=${l.id}`,
        }
      : null,
  }));
}

export async function getDashboardCalendar(
  viewer: DashboardViewer,
  target: DashboardTarget,
  fromKey: string,
  toKey: string
): Promise<DashboardCalendarDTO> {
  const [{ tasks, truncated }, leaves, holidays] = await Promise.all([
    calendarTasks(viewer, target.id, fromKey, toKey),
    calendarLeaves(viewer, target, fromKey, toKey),
    loadHolidayOccurrences(fromKey, toKey),
  ]);
  return { person: { id: target.id }, range: { from: fromKey, to: toKey }, tasks, truncated, leaves, holidays };
}
