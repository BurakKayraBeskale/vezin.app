import { NextRequest, NextResponse } from "next/server";
import { getToken } from "next-auth/jwt";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

// ── Label maps ───────────────────────────────────────────────────────────────
const DEPT_LABELS: Record<string, string> = {
  OUTSOURCE:            "Outsource",
  BAGIMSIZ_DENETIM:     "Bağımsız Denetim",
  MUHASEBE:             "Muhasebe",
  YEMINLI_MALI_MUSAVIR: "YMM",
  ADMIN:                "Yönetim",
};
const PRIORITY_LABELS: Record<string, string> = { HIGH: "Yüksek", MEDIUM: "Orta", LOW: "Düşük" };
const STATUS_LABELS:   Record<string, string> = {
  TODO: "Yapılacak", IN_PROGRESS: "Devam Ediyor", REVIEW: "İncelemede", DONE: "Tamamlandı",
};
const LEAVE_TYPE_LABELS:   Record<string, string> = { ANNUAL: "Yıllık", EXCUSE: "Mazeret", UNPAID: "Ücretsiz" };
const LEAVE_STATUS_LABELS: Record<string, string> = { PENDING: "Bekliyor", APPROVED: "Onaylandı", REJECTED: "Reddedildi" };
const DEPARTMENTS = ["OUTSOURCE", "BAGIMSIZ_DENETIM", "MUHASEBE", "YEMINLI_MALI_MUSAVIR", "ADMIN"];

// ── Helpers ──────────────────────────────────────────────────────────────────
function solidFill(argb: string) {
  return { type: "pattern" as const, pattern: "solid" as const, fgColor: { argb } };
}
function fmtDate(d: Date | string | null | undefined): string {
  if (!d) return "—";
  return new Date(d).toLocaleDateString("tr-TR");
}
function daysBetween(a: Date, b: Date): number {
  return Math.round(Math.abs(b.getTime() - a.getTime()) / (1000 * 60 * 60 * 24));
}
function deptOf(task: any): string {
  const people: any[] = task.assignees?.length
    ? task.assignees.map((a: any) => a.user)
    : task.assignedTo ? [task.assignedTo] : [];
  return people[0]?.department || task.createdBy?.department || "OUTSOURCE";
}
function assigneeNames(task: any): string {
  const people: any[] = task.assignees?.length
    ? task.assignees.map((a: any) => a.user)
    : task.assignedTo ? [task.assignedTo] : [];
  return people.length > 0 ? people.map((p: any) => p.name).join(", ") : "—";
}
function completionDate(task: any): Date | null {
  const log = (task.logs as any[])
    .filter((l: any) => l.toStatus === "DONE" || l.action === "COMPLETED")
    .sort((a: any, b: any) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime())[0];
  if (log) return new Date(log.timestamp);
  if (task.status === "DONE") return new Date(task.updatedAt);
  return null;
}

function buildHeaderRow(ws: any, headers: string[], colWidths: number[]) {
  ws.columns = colWidths.map((w) => ({ width: w }));
  const row = ws.getRow(1);
  row.height = 24;
  headers.forEach((h, i) => {
    const cell = row.getCell(i + 1);
    cell.value = h;
    cell.fill  = solidFill("FF003366");
    cell.font  = { bold: true, color: { argb: "FFFFFFFF" }, size: 10 };
    cell.alignment = { horizontal: "center" as const, vertical: "middle" as const };
  });
}

function applyZebra(ws: any, rowNum: number, colCount: number) {
  if (rowNum % 2 === 0) {
    const row = ws.getRow(rowNum);
    for (let c = 1; c <= colCount; c++) {
      if (!row.getCell(c).fill?.fgColor?.argb || row.getCell(c).fill?.fgColor?.argb === "FF000000") {
        row.getCell(c).fill = solidFill("FFF7F7F7");
      }
    }
  }
}

// ── Route ────────────────────────────────────────────────────────────────────
export async function GET(req: NextRequest) {
  const token = await getToken({ req, secret: process.env.NEXTAUTH_SECRET });
  if (!token) return NextResponse.json({ error: "Yetkisiz" }, { status: 401 });
  if ((token as any).role !== "ADMIN") return NextResponse.json({ error: "Yetkisiz" }, { status: 403 });

  const { searchParams } = new URL(req.url);
  const startDateStr = searchParams.get("startDate") || "";
  const endDateStr   = searchParams.get("endDate")   || "";
  const format       = searchParams.get("format");

  const startDate = startDateStr ? new Date(startDateStr) : new Date("2000-01-01");
  const endDate   = endDateStr   ? new Date(endDateStr + "T23:59:59.999Z") : new Date();

  // ── Fetch all data ──────────────────────────────────────────────────────────
  const [tasks, leaveRequests, meetings, users] = await Promise.all([
    prisma.task.findMany({
      where: { createdAt: { gte: startDate, lte: endDate } },
      include: {
        assignedTo: { select: { id: true, name: true, department: true } },
        assignees:  { include: { user: { select: { id: true, name: true, department: true } } } },
        createdBy:  { select: { id: true, name: true, department: true } },
        logs:       { orderBy: { timestamp: "asc" } },
      },
      orderBy: { createdAt: "desc" },
    }),
    prisma.leaveRequest.findMany({
      where: { startDate: { gte: startDate, lte: endDate } },
      include: { user: { select: { id: true, name: true, department: true } } },
      orderBy: { startDate: "asc" },
    }),
    (prisma as any).meeting.findMany({
      where: {
        date: {
          gte: startDateStr || "2000-01-01",
          lte: endDateStr   || new Date().toISOString().split("T")[0],
        },
      },
      include: { createdBy: { select: { id: true, name: true } } },
      orderBy: [{ date: "asc" }, { time: "asc" }],
    }),
    prisma.user.findMany({
      select: { id: true, name: true, department: true, role: true },
    }),
  ]);

  // ── Computed stats ──────────────────────────────────────────────────────────
  const completedTasks = tasks.filter((t) => t.status === "DONE");
  const leaveDays      = leaveRequests
    .filter((l) => l.status === "APPROVED")
    .reduce((s, l) => s + l.days, 0);

  const activeUserIds = new Set<string>();
  for (const task of tasks) {
    if (task.assignedToId) activeUserIds.add(task.assignedToId);
    for (const a of task.assignees) activeUserIds.add(a.userId);
  }

  // Most active dept
  const deptCount: Record<string, number> = {};
  for (const t of tasks) {
    const d = deptOf(t);
    deptCount[d] = (deptCount[d] || 0) + 1;
  }
  const topDeptEntry = Object.entries(deptCount).sort((a, b) => b[1] - a[1])[0];

  // Top performer
  const perfMap: Record<string, { name: string; count: number }> = {};
  for (const t of completedTasks) {
    const people: any[] = t.assignees.length
      ? t.assignees.map((a) => a.user)
      : t.assignedTo ? [t.assignedTo] : [];
    for (const p of people) {
      if (!perfMap[p.id]) perfMap[p.id] = { name: p.name, count: 0 };
      perfMap[p.id].count++;
    }
  }
  const topPerformer = Object.values(perfMap).sort((a, b) => b.count - a.count)[0];

  // ── JSON summary (format=summary) ──────────────────────────────────────────
  if (format === "summary") {
    return NextResponse.json({
      totalTasks:      tasks.length,
      completedTasks:  completedTasks.length,
      completionRate:  tasks.length > 0 ? Math.round((completedTasks.length / tasks.length) * 100) : 0,
      leaveDays,
      activeUsers:     activeUserIds.size,
      totalMeetings:   meetings.length,
      topDept:         topDeptEntry ? DEPT_LABELS[topDeptEntry[0]] || topDeptEntry[0] : "—",
      topPerformer:    topPerformer ? `${topPerformer.name} (${topPerformer.count} görev)` : "—",
    });
  }

  // ── Build Excel ─────────────────────────────────────────────────────────────
  const ExcelJS = require("exceljs");
  const wb = new ExcelJS.Workbook();
  wb.creator  = "Vezin Yönetim";
  wb.created  = new Date();

  const periodLabel = startDateStr && endDateStr
    ? `${startDateStr} — ${endDateStr}`
    : startDateStr ? `${startDateStr} — Bugün` : "Tüm Dönem";

  // ── SHEET 1: ÖZET ──────────────────────────────────────────────────────────
  const wsOzet = wb.addWorksheet("Özet");
  wsOzet.columns = [{ width: 36 }, { width: 30 }];

  wsOzet.mergeCells("A1:B1");
  const titleCell = wsOzet.getCell("A1");
  titleCell.value     = `YÖNETİM RAPORU — ${periodLabel}`;
  titleCell.fill      = solidFill("FF003366");
  titleCell.font      = { bold: true, size: 13, color: { argb: "FFFFFFFF" } };
  titleCell.alignment = { horizontal: "center" as const };
  wsOzet.getRow(1).height = 30;

  const ozetSections: [string, string | number, "header" | "row" | "spacer"][] = [
    ["Rapor Dönemi",            periodLabel,          "row"],
    ["Oluşturulma Tarihi",      fmtDate(new Date()),   "row"],
    ["",                        "",                    "spacer"],
    ["GÖREV ÖZETI",             "",                    "header"],
    ["Toplam Görev",            tasks.length,          "row"],
    ["Tamamlanan Görev",        completedTasks.length, "row"],
    ["Tamamlama Oranı",         `%${tasks.length > 0 ? Math.round((completedTasks.length / tasks.length) * 100) : 0}`, "row"],
    ["Devam Eden Görev",        tasks.filter((t) => t.status === "IN_PROGRESS").length, "row"],
    ["İncelemede",              tasks.filter((t) => t.status === "REVIEW").length, "row"],
    ["Geciken Görev",           tasks.filter((t) => t.dueDate && new Date(t.dueDate) < new Date() && t.status !== "DONE").length, "row"],
    ["",                        "",                    "spacer"],
    ["İZİN ÖZETI",              "",                    "header"],
    ["Toplam İzin Talebi",      leaveRequests.length,  "row"],
    ["Onaylanan İzin Günü",     leaveDays,             "row"],
    ["Bekleyen Talepler",       leaveRequests.filter((l) => l.status === "PENDING").length, "row"],
    ["",                        "",                    "spacer"],
    ["DİĞER",                   "",                    "header"],
    ["Toplam Toplantı",         meetings.length,       "row"],
    ["Aktif Kullanıcı",         activeUserIds.size,    "row"],
    ["Toplam Kullanıcı",        users.length,          "row"],
    ["",                        "",                    "spacer"],
    ["ÖNE ÇIKANLAR",            "",                    "header"],
    ["En Aktif Departman",      topDeptEntry ? (DEPT_LABELS[topDeptEntry[0]] || topDeptEntry[0]) + ` (${topDeptEntry[1]} görev)` : "—", "row"],
    ["En Çok Tamamlayan",       topPerformer ? `${topPerformer.name} (${topPerformer.count} görev)` : "—", "row"],
  ];

  let oRow = 2;
  for (const [label, value, type] of ozetSections) {
    if (type === "spacer") { oRow++; continue; }
    if (type === "header") {
      wsOzet.mergeCells(`A${oRow}:B${oRow}`);
      const c = wsOzet.getCell(`A${oRow}`);
      c.value     = label;
      c.fill      = solidFill("FF1F3864");
      c.font      = { bold: true, color: { argb: "FFFFFFFF" }, size: 10 };
      c.alignment = { horizontal: "left" as const, vertical: "middle" as const };
      wsOzet.getRow(oRow).height = 20;
    } else {
      const r = wsOzet.getRow(oRow);
      const c1 = r.getCell(1);
      c1.value = label;
      c1.fill  = solidFill("FFE8EDF5");
      c1.font  = { bold: true, size: 10 };
      const c2 = r.getCell(2);
      c2.value     = value;
      c2.alignment = { horizontal: "left" as const };
      c2.font      = { size: 10 };
    }
    oRow++;
  }

  // ── SHEET 2: GÖREV ÖZETİ ──────────────────────────────────────────────────
  const wsGorev = wb.addWorksheet("Görev Özeti");
  buildHeaderRow(wsGorev,
    ["Görev Adı", "Departman", "Atanan Kişi", "Öncelik", "Durum", "Oluşturma Tarihi", "Tamamlanma Tarihi", "Geçen Süre (gün)"],
    [42, 20, 24, 12, 16, 18, 20, 18],
  );

  const statusFill: Record<string, string> = {
    DONE: "FFD5F5E3", IN_PROGRESS: "FFFFF3E9", REVIEW: "FFE8E8FF", TODO: "FFF5F5F5",
  };

  let gRow = 2;
  for (const task of tasks) {
    const dept  = deptOf(task);
    const names = assigneeNames(task);
    const cd    = completionDate(task);
    const elapsed = cd
      ? daysBetween(new Date(task.createdAt), cd)
      : (task.status !== "DONE" ? daysBetween(new Date(task.createdAt), new Date()) : null);

    const r = wsGorev.getRow(gRow);
    // Zebra background
    if (gRow % 2 === 0) {
      for (let c = 1; c <= 8; c++) r.getCell(c).fill = solidFill("FFF7F7F7");
    }
    r.getCell(1).value = task.title;
    r.getCell(2).value = DEPT_LABELS[dept] || dept;
    r.getCell(3).value = names;
    r.getCell(4).value = PRIORITY_LABELS[task.priority] || task.priority;
    r.getCell(5).value = STATUS_LABELS[task.status] || task.status;
    r.getCell(5).fill  = solidFill(statusFill[task.status] || "FFFFFFFF");
    r.getCell(6).value = fmtDate(task.createdAt);
    r.getCell(7).value = cd ? fmtDate(cd) : "—";
    r.getCell(8).value = elapsed ?? "—";
    gRow++;
  }

  // ── SHEET 3: ÇALIŞAN PERFORMANSI ──────────────────────────────────────────
  const wsPerf = wb.addWorksheet("Çalışan Performansı");
  buildHeaderRow(wsPerf,
    ["Çalışan Adı", "Departman", "Aldığı Görev", "Tamamladığı", "Tamamlama %", "Ort. Süre (gün)", "Geciken Görev"],
    [25, 20, 14, 14, 14, 16, 14],
  );

  const userStats: Record<string, {
    name: string; dept: string;
    total: number; completed: number; overdue: number; daysSum: number; daysCount: number;
  }> = {};

  for (const task of tasks) {
    const people: any[] = task.assignees.length
      ? task.assignees.map((a) => a.user)
      : task.assignedTo ? [task.assignedTo] : [];

    for (const p of people) {
      if (!userStats[p.id]) {
        userStats[p.id] = { name: p.name, dept: p.department, total: 0, completed: 0, overdue: 0, daysSum: 0, daysCount: 0 };
      }
      const s = userStats[p.id];
      s.total++;
      if (task.status === "DONE") {
        s.completed++;
        const cd = completionDate(task);
        if (cd) { s.daysSum += daysBetween(new Date(task.createdAt), cd); s.daysCount++; }
      }
      if (task.dueDate && new Date(task.dueDate) < new Date() && task.status !== "DONE") s.overdue++;
    }
  }

  let pRow = 2;
  for (const stat of Object.values(userStats).sort((a, b) => b.completed - a.completed)) {
    const rate   = stat.total > 0 ? Math.round((stat.completed / stat.total) * 100) : 0;
    const avgDays = stat.daysCount > 0 ? Math.round(stat.daysSum / stat.daysCount) : "—";
    const r = wsPerf.getRow(pRow);
    if (pRow % 2 === 0) for (let c = 1; c <= 7; c++) r.getCell(c).fill = solidFill("FFF7F7F7");
    r.getCell(1).value = stat.name;
    r.getCell(2).value = DEPT_LABELS[stat.dept] || stat.dept;
    r.getCell(3).value = stat.total;
    r.getCell(4).value = stat.completed;
    r.getCell(5).value = `%${rate}`;
    r.getCell(6).value = avgDays;
    r.getCell(7).value = stat.overdue;
    if (stat.overdue > 0) r.getCell(7).fill = solidFill("FFFDE8E8");
    pRow++;
  }

  // ── SHEET 4: İZİN KAYITLARI ───────────────────────────────────────────────
  const wsIzin = wb.addWorksheet("İzin Kayıtları");
  buildHeaderRow(wsIzin,
    ["Çalışan Adı", "Departman", "İzin Türü", "Başlangıç", "Bitiş", "Süre (gün)", "Durum"],
    [25, 20, 12, 14, 14, 12, 14],
  );

  const leaveFill: Record<string, string> = {
    APPROVED: "FFD5F5E3", REJECTED: "FFFDE8E8", PENDING: "FFFFF3E9",
  };

  let iRow = 2;
  for (const leave of leaveRequests) {
    const r = wsIzin.getRow(iRow);
    if (iRow % 2 === 0) for (let c = 1; c <= 7; c++) r.getCell(c).fill = solidFill("FFF7F7F7");
    r.getCell(1).value = leave.user.name;
    r.getCell(2).value = DEPT_LABELS[leave.user.department] || leave.user.department;
    r.getCell(3).value = LEAVE_TYPE_LABELS[leave.type]   || leave.type;
    r.getCell(4).value = fmtDate(leave.startDate);
    r.getCell(5).value = fmtDate(leave.endDate);
    r.getCell(6).value = leave.days;
    r.getCell(7).value = LEAVE_STATUS_LABELS[leave.status] || leave.status;
    r.getCell(7).fill  = solidFill(leaveFill[leave.status] || "FFFFFFFF");
    iRow++;
  }

  // ── SHEET 5: DEPARTMAN ÖZETİ ──────────────────────────────────────────────
  const wsDept = wb.addWorksheet("Departman Özeti");
  buildHeaderRow(wsDept,
    ["Departman", "Toplam Görev", "Tamamlanan", "Devam Eden", "Geciken", "Tamamlama %"],
    [22, 14, 14, 14, 12, 14],
  );

  let dRow = 2;
  for (const dept of DEPARTMENTS) {
    const dTasks = tasks.filter((t) => deptOf(t) === dept);
    if (dTasks.length === 0) continue;
    const done     = dTasks.filter((t) => t.status === "DONE").length;
    const active   = dTasks.filter((t) => t.status === "IN_PROGRESS" || t.status === "REVIEW").length;
    const overdue  = dTasks.filter((t) => t.dueDate && new Date(t.dueDate) < new Date() && t.status !== "DONE").length;
    const rate     = Math.round((done / dTasks.length) * 100);

    const r = wsDept.getRow(dRow);
    if (dRow % 2 === 0) for (let c = 1; c <= 6; c++) r.getCell(c).fill = solidFill("FFF7F7F7");
    r.getCell(1).value = DEPT_LABELS[dept] || dept;
    r.getCell(2).value = dTasks.length;
    r.getCell(3).value = done;
    r.getCell(3).fill  = solidFill("FFD5F5E3");
    r.getCell(4).value = active;
    r.getCell(5).value = overdue;
    if (overdue > 0) r.getCell(5).fill = solidFill("FFFDE8E8");
    r.getCell(6).value = `%${rate}`;
    dRow++;
  }

  // ── SHEET 6: TOPLANTI KAYITLARI ───────────────────────────────────────────
  const wsMeet = wb.addWorksheet("Toplantı Kayıtları");
  buildHeaderRow(wsMeet,
    ["Toplantı Başlığı", "Departman", "Tarih", "Süre (dk)", "Oluşturan"],
    [38, 20, 14, 12, 22],
  );

  let mRow = 2;
  for (const m of meetings) {
    const r = wsMeet.getRow(mRow);
    if (mRow % 2 === 0) for (let c = 1; c <= 5; c++) r.getCell(c).fill = solidFill("FFF7F7F7");
    r.getCell(1).value = m.title;
    r.getCell(2).value = DEPT_LABELS[m.department] || m.department;
    r.getCell(3).value = m.date;
    r.getCell(4).value = m.duration;
    r.getCell(5).value = m.createdBy.name;
    mRow++;
  }

  // ── Output ────────────────────────────────────────────────────────────────
  const buf  = await wb.xlsx.writeBuffer();
  const safe = `vezin-rapor-${startDateStr || "tum"}-${endDateStr || "donem"}`.replace(/[^\w-]/g, "-");

  return new NextResponse(Buffer.from(buf), {
    status: 200,
    headers: {
      "Content-Type":        "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Content-Disposition": `attachment; filename="${safe}.xlsx"`,
    },
  });
}
