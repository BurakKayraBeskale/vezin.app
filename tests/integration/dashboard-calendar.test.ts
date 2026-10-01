/**
 * Dashboard (Prompt 06 — B bloğu) — Akıllı Takvim, Resmî Tatiller, planlanan başlangıç
 *
 *   C1  (115) start=05.10, due=15.10 → 05–15 arası bar ("range")
 *   C2  (116) yalnız due=20.10 → yalnız 20 Ekim ("due")
 *   C3  (117) tarihsiz görev takvimde YOK (createdAt'e yerleşmez)
 *   C4  (39)  yalnız planlanan başlangıç → "start" (son tarih değil)
 *   C5  Görünürlük: viewer'ın göremediği görev takvime girmez; seçilemeyen kişi → 404; aralık sınırı
 *   C6  (119) İzin: bekleyen / reddedilen / iptal takvimde yok; final onay sonrası görünür;
 *       ayrıntı yalnız izin modülü yetkisiyle (aksi halde yalnız "İzinli")
 *   C7  (120, 128) Admin tatil ekler → takvimde görünür; normal kullanıcı yönetemez (API 403, sayfa kapısı)
 *   C8  (121) İzin gün hesabı merkezi tatil listesini kullanır (tam gün düşer, yarım gün/pasif düşmez)
 *   C9  Her Yıl Tekrarla açılımı (yıl başına satır yok, başlangıç yılından itibaren, 29 Şubat)
 *   C10 Görev API: planlanan başlangıç kaydı + start > due → 400 (POST/PATCH)
 *   C11 Takvim yerleşimi: yoğun gün hücreyi büyütmez, "+N daha"
 */

import { describe, it, expect, beforeAll, afterAll, vi } from "vitest";
import { PrismaClient } from "@prisma/client";

vi.mock("next-auth", () => ({ getServerSession: vi.fn() }));
vi.mock("next-auth/jwt", () => ({ getToken: vi.fn() }));

import { GET as calendarGET } from "../../app/api/dashboard/calendar/route";
import { GET as adminHolidaysGET, POST as adminHolidaysPOST } from "../../app/api/admin/holidays/route";
import { PATCH as adminHolidayPATCH } from "../../app/api/admin/holidays/[id]/route";
import { GET as holidaysGET } from "../../app/api/holidays/route";
import { POST as leavePOST } from "../../app/api/leave/route";
import { PATCH as leavePATCH } from "../../app/api/leave/[id]/route";
import { POST as taskPOST } from "../../app/api/tasks/route";
import { PATCH as taskPATCH } from "../../app/api/tasks/[id]/route";
import { getServerSession } from "next-auth";
import { getToken } from "next-auth/jwt";
import { taskCalendarSpan, type DashboardCalendarDTO } from "../../lib/dashboard/calendar";
import { expandHolidays, fullDayHolidayKeys, validateHolidayInput } from "../../lib/holidays";
import { isGunuSayisi } from "../../lib/leave";
import { canAccess } from "../../lib/access";
import { layoutWeek, monthGridKeys } from "../../components/dashboard/calendarLayout";

const prisma = new PrismaClient();
const STAMP = Date.now();
const PREFIX = `test-cal-${STAMP}`;
const BD = "BAGIMSIZ_DENETIM";

type U = {
  id: string;
  name: string;
  email: string;
  role: string;
  department: string;
  seniorityLevel: number;
  canViewAllProjects: boolean;
  overseesDepartment: string | null;
};

const createdUserIds: string[] = [];
const createdTaskIds: string[] = [];
const createdProjectIds: string[] = [];
const createdLeaveIds: string[] = [];
const createdHolidayIds: string[] = [];

async function mkUser(slug: string, name: string, level: number, department = BD, role = "EMPLOYEE"): Promise<U> {
  const u = await prisma.user.create({
    data: {
      name: `${PREFIX} ${name}`,
      email: `${PREFIX}-${slug}@cal.test`,
      password: "x",
      role,
      department,
      seniorityLevel: level,
      status: "ACTIVE",
    },
  });
  createdUserIds.push(u.id);
  return u;
}

function asUser(u: U) {
  const user = { ...u, canViewAllTasks: false };
  vi.mocked(getServerSession).mockResolvedValue({ user, expires: "2099-01-01" } as any);
  vi.mocked(getToken).mockResolvedValue(user as any);
}

const d = (key: string) => new Date(`${key}T00:00:00.000Z`);

async function calendar(viewer: U, targetId: string, from = "2026-09-28", to = "2026-11-08") {
  asUser(viewer);
  const res = await calendarGET(new Request(`http://localhost/api/dashboard/calendar?userId=${targetId}&from=${from}&to=${to}`) as any);
  return { status: res.status, body: (await res.json()) as DashboardCalendarDTO };
}

async function mkTask(data: { title: string; assignedToId: string; createdById: string; projectId: string; startDate?: Date | null; dueDate?: Date | null; status?: string }) {
  const t = await prisma.task.create({
    data: {
      title: `${PREFIX} ${data.title}`,
      status: data.status ?? "TODO",
      priority: "HIGH",
      assignedToId: data.assignedToId,
      createdById: data.createdById,
      reviewOwnerId: data.createdById,
      projectId: data.projectId,
      startDate: data.startDate ?? null,
      dueDate: data.dueDate ?? null,
    },
  });
  createdTaskIds.push(t.id);
  return t;
}

async function mkProject(name: string, createdById: string, memberIds: string[]) {
  const p = await prisma.project.create({ data: { name: `${PREFIX} ${name}`, department: BD, createdById } });
  createdProjectIds.push(p.id);
  await prisma.projectMember.createMany({ data: memberIds.map((userId) => ({ projectId: p.id, userId, assignedBy: createdById })) });
  return p;
}

async function adminCreateHoliday(admin: U, body: object) {
  asUser(admin);
  const res = await adminHolidaysPOST(new Request("http://localhost/api/admin/holidays", { method: "POST", body: JSON.stringify(body) }) as any);
  const json = await res.json();
  if (res.status === 201) createdHolidayIds.push(json.id);
  return { status: res.status, body: json };
}

let admin: U, mgr: U, mgr2: U, mehmet: U, junior: U;
let tRange: { id: string }, tDue: { id: string }, tNone: { id: string }, tStart: { id: string }, tHidden: { id: string };

beforeAll(async () => {
  admin = await mkUser("admin", "Admin", 0, "ADMIN", "ADMIN");
  mgr = await mkUser("mgr", "Ayşe Yönetici", 8);
  mgr2 = await mkUser("mgr2", "Can Yönetici", 8);
  mehmet = await mkUser("mehmet", "Mehmet Kaya", 2);
  junior = await mkUser("junior", "Deniz Asistan", 2);

  const p1 = await mkProject("P1", mgr.id, [mgr.id, mehmet.id]);
  const p2 = await mkProject("P2 gizli", mgr2.id, [mgr2.id, mehmet.id]);

  tRange = await mkTask({ title: "Eylül KDV Kontrolü", assignedToId: mehmet.id, createdById: mgr.id, projectId: p1.id, startDate: d("2026-10-05"), dueDate: d("2026-10-15"), status: "IN_PROGRESS" });
  tDue = await mkTask({ title: "yalnız son tarih", assignedToId: mehmet.id, createdById: mgr.id, projectId: p1.id, dueDate: d("2026-10-20") });
  tNone = await mkTask({ title: "tarihsiz", assignedToId: mehmet.id, createdById: mgr.id, projectId: p1.id });
  tStart = await mkTask({ title: "yalnız başlangıç", assignedToId: mehmet.id, createdById: mgr.id, projectId: p1.id, startDate: d("2026-10-22") });
  tHidden = await mkTask({ title: "gizli", assignedToId: mehmet.id, createdById: mgr2.id, projectId: p2.id, dueDate: d("2026-10-21") });
});

afterAll(async () => {
  await prisma.notification.deleteMany({ where: { relatedId: { in: [...createdLeaveIds, ...createdTaskIds] } } });
  await prisma.leaveRequest.deleteMany({ where: { id: { in: createdLeaveIds } } });
  await prisma.publicHoliday.deleteMany({ where: { id: { in: createdHolidayIds } } });
  await prisma.taskLog.deleteMany({ where: { taskId: { in: createdTaskIds } } });
  await prisma.task.deleteMany({ where: { id: { in: createdTaskIds } } });
  await prisma.projectMember.deleteMany({ where: { projectId: { in: createdProjectIds } } });
  await prisma.project.deleteMany({ where: { id: { in: createdProjectIds } } });
  await prisma.user.deleteMany({ where: { id: { in: createdUserIds } } });
  await prisma.$disconnect();
});

describe("C1–C4 — Görev → takvim eşlemesi", () => {
  it("saf eşleme: range / due / start / tarihsiz / start>due / start=due", () => {
    expect(taskCalendarSpan(d("2026-10-05"), d("2026-10-15"))).toEqual({ kind: "range", start: "2026-10-05", end: "2026-10-15" });
    expect(taskCalendarSpan(null, d("2026-10-20"))).toEqual({ kind: "due", start: "2026-10-20", end: "2026-10-20" });
    expect(taskCalendarSpan(d("2026-10-22"), null)).toEqual({ kind: "start", start: "2026-10-22", end: "2026-10-22" });
    expect(taskCalendarSpan(null, null)).toBeNull();
    expect(taskCalendarSpan(d("2026-10-25"), d("2026-10-20"))?.kind).toBe("due");
    expect(taskCalendarSpan(d("2026-10-20"), d("2026-10-20"))?.kind).toBe("due");
  });

  it("API: Mehmet kendi takviminde range / due / start görür, tarihsiz görev yok", async () => {
    const { status, body } = await calendar(mehmet, mehmet.id);
    expect(status).toBe(200);
    const byId = new Map(body.tasks.map((t) => [t.id, t]));
    expect(byId.get(tRange.id)).toMatchObject({ kind: "range", start: "2026-10-05", end: "2026-10-15", status: "IN_PROGRESS", priority: "HIGH" });
    expect(byId.get(tDue.id)).toMatchObject({ kind: "due", start: "2026-10-20", end: "2026-10-20", startDate: null });
    expect(byId.get(tStart.id)).toMatchObject({ kind: "start", start: "2026-10-22", dueDate: null });
    expect(byId.has(tNone.id)).toBe(false);
    expect(byId.get(tRange.id)?.assignee).toBe(mehmet.name);
  });

  it("aralıkla yalnız kısmen kesişen bar da gelir; aralık dışı gelmez", async () => {
    const overlap = await calendar(mehmet, mehmet.id, "2026-10-10", "2026-10-12");
    expect(overlap.body.tasks.map((t) => t.id)).toEqual([tRange.id]);
    const outside = await calendar(mehmet, mehmet.id, "2026-12-01", "2026-12-31");
    expect(outside.body.tasks).toHaveLength(0);
  });
});

describe("C5 — Görünürlük ve kişi kapısı", () => {
  it("Manager Mehmet'i seçer: yalnız kendi görebildiği görevler (P2 gizli görevi yok)", async () => {
    const own = await calendar(mehmet, mehmet.id);
    expect(own.body.tasks.map((t) => t.id)).toContain(tHidden.id);
    const { status, body } = await calendar(mgr, mehmet.id);
    expect(status).toBe(200);
    const ids = body.tasks.map((t) => t.id);
    expect(ids).toContain(tRange.id);
    expect(ids).not.toContain(tHidden.id);
  });

  it("seçilemeyen kişi → 404; geçersiz/çok geniş aralık → 400", async () => {
    expect((await calendar(junior, mehmet.id)).status).toBe(404);
    expect((await calendar(mehmet, mehmet.id, "2026-10-01", "2027-03-01")).status).toBe(400);
    expect((await calendar(mehmet, mehmet.id, "2026-10-31", "2026-10-01")).status).toBe(400);
    expect((await calendar(mehmet, mehmet.id, "2026-02-30", "2026-03-10")).status).toBe(400);
  });
});

describe("C6 — Onaylı izin entegrasyonu", () => {
  let leaveId: string;

  it("bekleyen izin takvimde görünmez; Admin final onayı sonrası yeşil izin olarak görünür", async () => {
    asUser(mehmet);
    const res = await leavePOST(new Request("http://localhost/api/leave", {
      method: "POST",
      body: JSON.stringify({ startDate: "2026-11-02", endDate: "2026-11-04", type: "SICK" }),
    }) as any);
    expect(res.status).toBe(201);
    leaveId = (await res.json()).id;
    createdLeaveIds.push(leaveId);

    expect((await calendar(mehmet, mehmet.id)).body.leaves).toHaveLength(0);

    asUser(admin);
    const ok = await leavePATCH(new Request(`http://localhost/api/leave/${leaveId}`, { method: "PATCH", body: JSON.stringify({ action: "approve" }) }) as any, { params: { id: leaveId } });
    expect(ok.status).toBe(200);

    const after = await calendar(mehmet, mehmet.id);
    expect(after.body.leaves).toEqual([
      { id: leaveId, start: "2026-11-02", end: "2026-11-04", detail: { typeLabel: "Hastalık İzni", statusLabel: "Onaylandı", days: 3, href: `/leave?requestId=${leaveId}` } },
    ]);
  });

  it("izin ayrıntısı: yetkisiz Manager yalnız 'İzinli' (tür/link yok); Admin Personel İzin Durumu linki alır", async () => {
    const m = await calendar(mgr, mehmet.id);
    expect(m.body.leaves).toEqual([{ id: leaveId, start: "2026-11-02", end: "2026-11-04", detail: null }]);
    const a = await calendar(admin, mehmet.id);
    expect(a.body.leaves[0].detail?.href).toBe(`/izin-durumu?requestId=${leaveId}`);
  });

  it("reddedilen ve iptal edilen izinler takvime girmez", async () => {
    const rejected = await prisma.leaveRequest.create({
      data: { userId: mehmet.id, startDate: d("2026-10-26"), endDate: d("2026-10-26"), days: 1, type: "ANNUAL", status: "REJECTED", reviewNote: "x" },
    });
    const cancelled = await prisma.leaveRequest.create({
      data: { userId: mehmet.id, startDate: d("2026-10-27"), endDate: d("2026-10-27"), days: 1, type: "ANNUAL", status: "CANCELLED", deletedAt: new Date() },
    });
    createdLeaveIds.push(rejected.id, cancelled.id);
    const ids = (await calendar(mehmet, mehmet.id)).body.leaves.map((l) => l.id);
    expect(ids).toEqual([leaveId]);
  });
});

describe("C7 — Resmî Tatiller yönetimi (yalnız Admin)", () => {
  it("Admin 29 Ekim Cumhuriyet Bayramı ekler → Dashboard takviminde görünür", async () => {
    const created = await adminCreateHoliday(admin, { name: `${PREFIX} Cumhuriyet Bayramı`, startDate: "2026-10-29", endDate: "2026-10-29", dayType: "FULL" });
    expect(created.status).toBe(201);
    expect(created.body.createdBy.id).toBe(admin.id);
    const cal = await calendar(mehmet, mehmet.id);
    const h = cal.body.holidays.find((x) => x.holidayId === created.body.id);
    expect(h).toMatchObject({ date: "2026-10-29", dayType: "FULL", halfDayPeriod: null });
  });

  it("normal kullanıcı listeleyemez / ekleyemez / düzenleyemez (API 403); /api/holidays okuyabilir", async () => {
    asUser(mgr);
    expect((await adminHolidaysGET(new Request("http://localhost/api/admin/holidays?year=2026") as any)).status).toBe(403);
    const post = await adminHolidaysPOST(new Request("http://localhost/api/admin/holidays", { method: "POST", body: JSON.stringify({ name: "x", startDate: "2026-12-01" }) }) as any);
    expect(post.status).toBe(403);
    const id = createdHolidayIds[0];
    const patch = await adminHolidayPATCH(new Request(`http://localhost/api/admin/holidays/${id}`, { method: "PATCH", body: JSON.stringify({ isActive: false }) }) as any, { params: { id } });
    expect(patch.status).toBe(403);
    expect((await prisma.publicHoliday.findUnique({ where: { id } }))?.isActive).toBe(true);

    const read = await holidaysGET(new Request("http://localhost/api/holidays?from=2026-10-01&to=2026-10-31") as any);
    expect(read.status).toBe(200);
    expect((await read.json()).holidays.some((h: { holidayId: string }) => h.holidayId === id)).toBe(true);
  });

  it("sayfa kapısı: /admin/sistem-ayarlari yalnız ADMIN", () => {
    expect(canAccess("EMPLOYEE", BD, "/admin/sistem-ayarlari")).toBe(false);
    expect(canAccess("ADMIN", "ADMIN", "/admin/sistem-ayarlari")).toBe(true);
  });

  it("Admin pasife alır → takvimden kalkar; yıl filtresi pasifleri de listeler", async () => {
    const id = createdHolidayIds[0];
    asUser(admin);
    const res = await adminHolidayPATCH(new Request(`http://localhost/api/admin/holidays/${id}`, { method: "PATCH", body: JSON.stringify({ isActive: false }) }) as any, { params: { id } });
    expect(res.status).toBe(200);
    expect((await res.json()).isActive).toBe(false);
    const cal = await calendar(mehmet, mehmet.id);
    expect(cal.body.holidays.some((h) => h.holidayId === id)).toBe(false);

    asUser(admin);
    const list = await (await adminHolidaysGET(new Request("http://localhost/api/admin/holidays?year=2026") as any)).json();
    expect(list.holidays.some((h: { id: string }) => h.id === id)).toBe(true);
    const other = await (await adminHolidaysGET(new Request("http://localhost/api/admin/holidays?year=2025") as any)).json();
    expect(other.holidays.some((h: { id: string }) => h.id === id)).toBe(false);
  });

  it("doğrulama: yarım gün dönem zorunlu ve tek gün; bitiş < başlangıç; ad zorunlu", async () => {
    expect((await adminCreateHoliday(admin, { name: "x", startDate: "2026-12-01", dayType: "HALF" })).status).toBe(400);
    expect((await adminCreateHoliday(admin, { name: "x", startDate: "2026-12-01", endDate: "2026-12-02", dayType: "HALF", halfDayPeriod: "MORNING" })).status).toBe(400);
    expect((await adminCreateHoliday(admin, { name: "x", startDate: "2026-12-05", endDate: "2026-12-01" })).status).toBe(400);
    expect((await adminCreateHoliday(admin, { name: "  ", startDate: "2026-12-01" })).status).toBe(400);
    expect(validateHolidayInput({ name: "Arife", startDate: "2026-10-28", dayType: "HALF", halfDayPeriod: "AFTERNOON" })).toMatchObject({
      value: { endDate: "2026-10-28", dayType: "HALF", halfDayPeriod: "AFTERNOON", isActive: true, isRecurringAnnually: false },
    });
  });
});

describe("C8 — İzin hesabı merkezi tatil listesini kullanır", () => {
  // 2031-03-10 Pazartesi … 03-14 Cuma: sabit ulusal tatil yok → taban 5 iş günü
  it("tam gün tatil düşer; yarım gün ve pasif tatil düşmez; ikinci liste yok", async () => {
    await adminCreateHoliday(admin, { name: `${PREFIX} tam`, startDate: "2031-03-12", dayType: "FULL" });
    await adminCreateHoliday(admin, { name: `${PREFIX} yarım`, startDate: "2031-03-13", dayType: "HALF", halfDayPeriod: "AFTERNOON" });
    await adminCreateHoliday(admin, { name: `${PREFIX} pasif`, startDate: "2031-03-11", dayType: "FULL", isActive: false });

    asUser(junior);
    const res = await leavePOST(new Request("http://localhost/api/leave", {
      method: "POST",
      body: JSON.stringify({ startDate: "2031-03-10", endDate: "2031-03-14", type: "ANNUAL" }),
    }) as any);
    expect(res.status).toBe(201);
    const created = await res.json();
    createdLeaveIds.push(created.id);
    expect(created.days).toBe(4);

    // Yalnız tatil gününe talep → iş günü yok
    const onlyHoliday = await leavePOST(new Request("http://localhost/api/leave", {
      method: "POST",
      body: JSON.stringify({ startDate: "2031-03-12", endDate: "2031-03-12", type: "ANNUAL" }),
    }) as any);
    expect(onlyHoliday.status).toBe(400);
  });

  it("isGunuSayisi: tatil kümesi verilmezse eski davranış (yalnız hafta sonu)", () => {
    expect(isGunuSayisi(d("2031-03-10"), d("2031-03-14"))).toBe(5);
    expect(isGunuSayisi(d("2031-03-10"), d("2031-03-16"), new Set(["2031-03-12", "2031-03-15"]))).toBe(4);
  });
});

describe("C9 — Her Yıl Tekrarla açılımı", () => {
  const base = { description: null, isActive: true, dayType: "FULL", halfDayPeriod: null };
  it("başlangıç yılından itibaren her yıl; öncesinde yok; yıl başına satır gerekmez", () => {
    const rec = [{ ...base, id: "r", name: "Cumhuriyet Bayramı", startDate: "2026-10-29T00:00:00.000Z", endDate: "2026-10-29T00:00:00.000Z", isRecurringAnnually: true }];
    expect(expandHolidays(rec, "2027-10-01", "2027-10-31").map((o) => o.date)).toEqual(["2027-10-29"]);
    expect(expandHolidays(rec, "2030-10-29", "2030-10-29")).toHaveLength(1);
    expect(expandHolidays(rec, "2025-10-01", "2025-10-31")).toHaveLength(0);
  });

  it("tekrarlanmayan çok günlü bayram yalnız kendi yılında; 29 Şubat artık olmayan yılda atlanır", () => {
    const bayram = [{ ...base, id: "b", name: "Bayram", startDate: "2027-03-09T00:00:00.000Z", endDate: "2027-03-11T00:00:00.000Z", isRecurringAnnually: false }];
    expect(expandHolidays(bayram, "2027-03-01", "2027-03-31").map((o) => o.date)).toEqual(["2027-03-09", "2027-03-10", "2027-03-11"]);
    expect(expandHolidays(bayram, "2028-03-01", "2028-03-31")).toHaveLength(0);
    const leap = [{ ...base, id: "l", name: "Artık", startDate: "2028-02-29T00:00:00.000Z", endDate: "2028-02-29T00:00:00.000Z", isRecurringAnnually: true }];
    expect(expandHolidays(leap, "2029-02-01", "2029-03-31")).toHaveLength(0);
    expect(expandHolidays(leap, "2032-02-01", "2032-03-31").map((o) => o.date)).toEqual(["2032-02-29"]);
  });

  it("yarım gün tatil izin düşümüne girmez (fullDayHolidayKeys)", () => {
    const occ = expandHolidays(
      [{ ...base, id: "h", name: "Arife", startDate: "2026-10-28T00:00:00.000Z", endDate: "2026-10-28T00:00:00.000Z", dayType: "HALF", halfDayPeriod: "AFTERNOON", isRecurringAnnually: false }],
      "2026-10-01",
      "2026-10-31"
    );
    expect(occ).toHaveLength(1);
    expect(fullDayHolidayKeys(occ).size).toBe(0);
  });
});

describe("C10 — Görev API: planlanan başlangıç", () => {
  it("POST startDate kaydeder; start > due → 400", async () => {
    asUser(mgr);
    const p1 = createdProjectIds[0];
    const bad = await taskPOST(new Request("http://localhost/api/tasks", {
      method: "POST",
      body: JSON.stringify({ title: `${PREFIX} ters`, assignedToId: mehmet.id, projectId: p1, startDate: "2026-10-20", dueDate: "2026-10-10" }),
    }) as any);
    expect(bad.status).toBe(400);

    const ok = await taskPOST(new Request("http://localhost/api/tasks", {
      method: "POST",
      body: JSON.stringify({ title: `${PREFIX} planlı`, assignedToId: mehmet.id, projectId: p1, startDate: "2026-10-06", dueDate: "2026-10-09" }),
    }) as any);
    expect(ok.status).toBe(201);
    const t = await ok.json();
    createdTaskIds.push(t.id);
    expect(new Date(t.startDate).toISOString().slice(0, 10)).toBe("2026-10-06");
  });

  it("PATCH: yalnız startDate gönderilse de mevcut son tarihle karşılaştırılır", async () => {
    asUser(mgr);
    const bad = await taskPATCH(new Request(`http://localhost/api/tasks/${tRange.id}`, { method: "PATCH", body: JSON.stringify({ startDate: "2026-10-16" }) }) as any, { params: { id: tRange.id } });
    expect(bad.status).toBe(400);
    const ok = await taskPATCH(new Request(`http://localhost/api/tasks/${tRange.id}`, { method: "PATCH", body: JSON.stringify({ startDate: "2026-10-07" }) }) as any, { params: { id: tRange.id } });
    expect(ok.status).toBe(200);
    expect((await prisma.task.findUnique({ where: { id: tRange.id } }))?.startDate?.toISOString().slice(0, 10)).toBe("2026-10-07");
    const cleared = await taskPATCH(new Request(`http://localhost/api/tasks/${tDue.id}`, { method: "PATCH", body: JSON.stringify({ startDate: null }) }) as any, { params: { id: tDue.id } });
    expect(cleared.status).toBe(200);
  });
});

describe("C11 — Takvim yerleşimi", () => {
  it("ay ızgarası Pazartesi başlar, 42 gün", () => {
    const g = monthGridKeys(2026, 9); // Ekim 2026 — 1 Ekim Perşembe
    expect(g).toHaveLength(42);
    expect(g[0]).toBe("2026-09-28");
    expect(g[41]).toBe("2026-11-08");
  });

  it("aynı gün 5 etkinlik: 3 şerit görünür, '+2 daha'; haftayı aşan bar kırpılır", () => {
    const week = monthGridKeys(2026, 9).slice(14, 21); // 12–18 Ekim
    const evs = [
      { id: "long", start: "2026-10-05", end: "2026-10-15" },
      ...[1, 2, 3, 4].map((i) => ({ id: `d${i}`, start: "2026-10-14", end: "2026-10-14" })),
    ];
    const { segments, hiddenByDay } = layoutWeek(week, evs, 3);
    const long = segments.find((s) => s.event.id === "long")!;
    expect(long).toMatchObject({ colStart: 0, colEnd: 3, continuesBefore: true, continuesAfter: false, lane: 0 });
    expect(segments).toHaveLength(3);
    expect(hiddenByDay[2]).toBe(2);
    expect(hiddenByDay.filter((n, i) => i !== 2).every((n) => n === 0)).toBe(true);
  });
});
