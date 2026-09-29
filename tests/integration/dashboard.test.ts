/**
 * Dashboard (Prompt 06 — A bloğu) entegrasyon testleri
 *
 *   D1  Varsayılan: normal kullanıcı yalnız kendini seçebilir; başka kişi → 404
 *   D2  Yetki politikası: ≤6 yalnız kendisi, 7–10 ortak proje/görev, ≥11 departman, Admin herkes
 *   D3  Manager Mehmet'i seçer → KPI/dağılım/yaklaşan/projeler Mehmet'e göre
 *   D4  Gizli görev sızmaz: Manager'ın göremediği Mehmet görevleri sayılara/listelere/projelere girmez
 *   D5  KPI tıklama: kartın drill-down linki Görev Takip'te AYNI toplamı verir (4 KPI + dağılım + Tümünü Gör)
 *   D6  İnceleme KPI'ı review_owner'ı sayar, created_by'ı saymaz
 *   D7  Tamamlanan görev: Açık düşer, Bu Hafta Tamamlanan artar (completedAt; eski tamamlanan sayılmaz)
 *   D8  Bekleyen İşlemler: harcama onaycısına onay adedi; viewer göremiyorsa kategori hiç yok
 *   D9  İzin onayı bekleyenler: onaylayıcıya (canApproveLeave) görünür
 *   D10 Finansal gizlilik: Manager göremez; kişinin kendisi, Admin ve Muhasebe görür
 *   D11 Proje limiti: en fazla 5 Öne Çıkan Proje, toplam sayı viewer-visible projeler
 *   D12 Görev Takip URL sözleşmesi: parse/serialize simetrik, hafta başı Pazartesi (TR)
 */

import { describe, it, expect, beforeAll, afterAll, vi } from "vitest";
import { PrismaClient } from "@prisma/client";

vi.mock("next-auth", () => ({ getServerSession: vi.fn() }));
vi.mock("next-auth/jwt", () => ({ getToken: vi.fn() }));

import { GET as dashboardGET } from "../../app/api/dashboard/route";
import { GET as peopleGET } from "../../app/api/dashboard/people/route";
import { GET as boardGET } from "../../app/api/tasks/board/route";
import { getServerSession } from "next-auth";
import { getToken } from "next-auth/jwt";
import { getDashboardPeopleScope, type DashboardViewer } from "../../lib/dashboard/people";
import { canSeeDashboardFinance } from "../../lib/dashboard/service";
import { boardFiltersToParams, currentWeekStart, parseBoardFilters } from "../../lib/task-board-query";

const prisma = new PrismaClient();
const STAMP = Date.now();
const PREFIX = `test-dash-${STAMP}`;
const BD = "BAGIMSIZ_DENETIM";
const DAY = 24 * 60 * 60 * 1000;

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
const createdProjectIds: string[] = [];
const createdTaskIds: string[] = [];

async function mkUser(slug: string, name: string, level: number, department = BD, role = "EMPLOYEE"): Promise<U> {
  const u = await prisma.user.create({
    data: {
      name: `${PREFIX} ${name}`,
      email: `${PREFIX}-${slug}@dash.test`,
      password: "x",
      role,
      department,
      seniorityLevel: level,
      canViewAllProjects: false,
      overseesDepartment: null,
      status: "ACTIVE",
    },
  });
  createdUserIds.push(u.id);
  return u;
}

function asUser(u: U) {
  const user = {
    id: u.id,
    name: u.name,
    email: u.email,
    role: u.role,
    department: u.department,
    seniorityLevel: u.seniorityLevel,
    canViewAllProjects: u.canViewAllProjects,
    overseesDepartment: u.overseesDepartment,
    canViewAllTasks: false,
  };
  vi.mocked(getServerSession).mockResolvedValue({ user, expires: "2099-01-01" } as any);
  vi.mocked(getToken).mockResolvedValue(user as any);
}

async function summary(viewer: U, targetId?: string) {
  asUser(viewer);
  const url = `http://localhost/api/dashboard${targetId ? `?userId=${targetId}` : ""}`;
  const res = await dashboardGET(new Request(url) as any);
  return { status: res.status, body: await res.json() };
}

async function people(viewer: U): Promise<string[]> {
  asUser(viewer);
  const res = await peopleGET();
  expect(res.status).toBe(200);
  return (await res.json()).people.map((p: { id: string }) => p.id);
}

/** Görev Takip'in bir drill-down linki için gösterdiği toplam (görünen kolonların toplamı). */
async function boardTotal(viewer: U, href: string): Promise<number> {
  asUser(viewer);
  const qs = href.split("?")[1] ?? "";
  const res = await boardGET(new Request(`http://localhost/api/tasks/board?${qs}`) as any);
  expect(res.status).toBe(200);
  const data = await res.json();
  const statuses = parseBoardFilters(new URLSearchParams(qs)).statuses;
  return data.columns
    .filter((c: { status: string }) => statuses.length === 0 || statuses.includes(c.status as any))
    .reduce((a: number, c: { total: number }) => a + c.total, 0);
}

/** Türkiye takvim gününe göre tarih-yalnız son tarih (UTC gece yarısı — TaskForm'un yazdığı biçim). */
function dueInDays(n: number): Date {
  const tr = new Date(Date.now() + 3 * 60 * 60 * 1000);
  return new Date(Date.UTC(tr.getUTCFullYear(), tr.getUTCMonth(), tr.getUTCDate() + n));
}

async function mkTask(data: {
  title: string;
  status: string;
  assignedToId: string;
  createdById: string;
  reviewOwnerId: string;
  projectId: string | null;
  dueDate?: Date | null;
  completedAt?: Date | null;
  priority?: string;
}) {
  const t = await prisma.task.create({
    data: { ...data, title: `${PREFIX} ${data.title}`, priority: data.priority ?? "MEDIUM", departmentId: data.projectId ? null : BD },
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

let admin: U, mgr: U, mgr2: U, mehmet: U, junior: U, senior2: U, sm: U, stranger: U;
let p1: { id: string }, p2: { id: string };
let expenseFormId: string;
let leaveId: string;
let ahmetOruc: U | null = null;

beforeAll(async () => {
  admin = await mkUser("admin", "Admin", 0, "ADMIN", "ADMIN");
  mgr = await mkUser("mgr", "Ayşe Yönetici", 8);
  mgr2 = await mkUser("mgr2", "Can Yönetici", 8);
  mehmet = await mkUser("mehmet", "Mehmet Kaya", 2);
  junior = await mkUser("junior", "Deniz Asistan", 2);
  senior2 = await mkUser("senior2", "Ece Senior", 6);
  sm = await mkUser("sm", "Selim Kıdemli", 11);
  stranger = await mkUser("stranger", "Burak Uzak", 2);

  p1 = await mkProject("P1 Manager Projesi", mgr.id, [mgr.id, mehmet.id, junior.id]);
  p2 = await mkProject("P2 Gizli Proje", mgr2.id, [mgr2.id, mehmet.id]);
  for (let i = 3; i <= 7; i++) await mkProject(`P${i} Ek Proje`, mgr.id, [mgr.id, mehmet.id]);

  // Manager'ın gördüğü (P1 kurucusu) Mehmet görevleri
  await mkTask({ title: "t1 gecikmiş", status: "TODO", assignedToId: mehmet.id, createdById: mgr.id, reviewOwnerId: mgr.id, projectId: p1.id, dueDate: dueInDays(-1) });
  await mkTask({ title: "t2 yarın", status: "IN_PROGRESS", assignedToId: mehmet.id, createdById: mgr.id, reviewOwnerId: mgr.id, projectId: p1.id, dueDate: dueInDays(1), priority: "HIGH" });
  await mkTask({ title: "t3 incelemede", status: "REVIEW", assignedToId: mehmet.id, createdById: mgr.id, reviewOwnerId: mgr.id, projectId: p1.id, dueDate: dueInDays(3) });
  await mkTask({ title: "d1 bu hafta", status: "DONE", assignedToId: mehmet.id, createdById: mgr.id, reviewOwnerId: mgr.id, projectId: p1.id, completedAt: new Date() });
  await mkTask({ title: "d2 eski", status: "DONE", assignedToId: mehmet.id, createdById: mgr.id, reviewOwnerId: mgr.id, projectId: p1.id, completedAt: new Date(currentWeekStart().getTime() - 3 * DAY) });
  // Manager'ın GÖREMEDİĞİ (P2, mgr2) Mehmet görevleri
  await mkTask({ title: "t4 gizli gecikmiş", status: "TODO", assignedToId: mehmet.id, createdById: mgr2.id, reviewOwnerId: mgr2.id, projectId: p2.id, dueDate: dueInDays(-2) });
  await mkTask({ title: "t5 gizli", status: "IN_PROGRESS", assignedToId: mehmet.id, createdById: mgr2.id, reviewOwnerId: mgr2.id, projectId: p2.id });
  // İnceleme sahibi Mehmet olan 3 görev + Mehmet'in OLUŞTURDUĞU ama incelemesi başkasında olan 1 görev
  for (const n of [1, 2, 3]) {
    await mkTask({ title: `r${n} inceleme`, status: "REVIEW", assignedToId: junior.id, createdById: mgr.id, reviewOwnerId: mehmet.id, projectId: p1.id });
  }
  await mkTask({ title: "c1 created_by", status: "REVIEW", assignedToId: junior.id, createdById: mehmet.id, reviewOwnerId: mgr.id, projectId: p1.id });

  // Harcama: Mehmet'in onaycı olduğu bekleyen form (sahibi junior) — Manager göremez
  const form = await prisma.expenseForm.create({
    data: {
      formNo: `TST-${STAMP}`,
      ownerId: junior.id,
      status: "DEPT_APPROVAL",
      departmentSnapshot: `TEST_DASH_${STAMP}`,
      ownerNameSnapshot: junior.name,
      snapshotAt: new Date(),
      totalAmount: 100,
      netAmount: 100,
      rounds: {
        create: {
          roundNumber: 1,
          status: "PENDING",
          requiredCount: 1,
          submittedById: junior.id,
          approvals: { create: { approverId: mehmet.id } },
        },
      },
    },
  });
  expenseFormId = form.id;

  // İzin: BD personelinin bekleyen talebi → onaylayıcı ahmetoruc@ (getLeaveApprovers)
  const leave = await prisma.leaveRequest.create({
    data: { userId: junior.id, startDate: dueInDays(10), endDate: dueInDays(11), days: 2, type: "ANNUAL", status: "PENDING" },
  });
  leaveId = leave.id;
  const ahmet = await prisma.user.findUnique({ where: { email: "ahmetoruc@vezin.com.tr" } });
  if (ahmet && ahmet.status === "ACTIVE") ahmetOruc = ahmet;
});

afterAll(async () => {
  await prisma.leaveRequest.deleteMany({ where: { id: leaveId } });
  await prisma.expenseForm.deleteMany({ where: { id: expenseFormId } });
  await prisma.task.deleteMany({ where: { id: { in: createdTaskIds } } });
  await prisma.projectMember.deleteMany({ where: { projectId: { in: createdProjectIds } } });
  await prisma.project.deleteMany({ where: { id: { in: createdProjectIds } } });
  await prisma.user.deleteMany({ where: { id: { in: createdUserIds } } });
  await prisma.$disconnect();
});

describe("D1 — Varsayılan kişi ve seçim sınırı", () => {
  it("normal kullanıcı: Dashboard kendisi, seçici yalnız kendisi, başka kişi → 404", async () => {
    const own = await summary(junior);
    expect(own.status).toBe(200);
    expect(own.body.person).toMatchObject({ id: junior.id, isSelf: true });
    expect(await people(junior)).toEqual([junior.id]);
    expect((await summary(junior, mehmet.id)).status).toBe(404);
  });
});

describe("D2 — Personel seçim politikası", () => {
  it("≤6 yalnız kendisi; 7–10 ortak proje/görünen görev; ≥11 departman; Admin herkes", async () => {
    expect(await people(senior2)).toEqual([senior2.id]);

    const mgrPeople = await people(mgr);
    expect(mgrPeople[0]).toBe(mgr.id);
    expect(mgrPeople).toContain(mehmet.id); // ortak proje
    expect(mgrPeople).not.toContain(stranger.id); // ortak proje / görünen görev yok
    expect((await summary(mgr, stranger.id)).status).toBe(404);

    const smPeople = await people(sm);
    expect(smPeople).toEqual(expect.arrayContaining([mehmet.id, stranger.id, mgr.id]));

    const adminPeople = await people(admin);
    expect(adminPeople).toEqual(expect.arrayContaining([mehmet.id, stranger.id, sm.id]));
  });

  it("saf politika: kıdem eşikleri ve departman sorumlusu", () => {
    const v = (over: Partial<DashboardViewer>): DashboardViewer => ({
      id: "x", name: "x", email: "x@x", role: "EMPLOYEE", status: "ACTIVE", department: BD,
      seniorityLevel: 2, canViewAllProjects: false, overseesDepartment: null, ...over,
    });
    expect(getDashboardPeopleScope(v({ seniorityLevel: 6 }))).toEqual({ kind: "self" });
    expect(getDashboardPeopleScope(v({ seniorityLevel: 7 }))).toEqual({ kind: "team", department: BD });
    expect(getDashboardPeopleScope(v({ seniorityLevel: 10 }))).toEqual({ kind: "team", department: BD });
    expect(getDashboardPeopleScope(v({ seniorityLevel: 11 }))).toEqual({ kind: "departments", departments: [BD] });
    expect(getDashboardPeopleScope(v({ role: "ADMIN" }))).toEqual({ kind: "all" });
    expect(getDashboardPeopleScope(v({ canViewAllProjects: true }))).toEqual({ kind: "all" });
    expect(getDashboardPeopleScope(v({ department: "OUTSOURCE", seniorityLevel: 12, overseesDepartment: "YMM" }))).toEqual({
      kind: "departments",
      departments: ["OUTSOURCE", "YEMINLI_MALI_MUSAVIR"],
    });
  });
});

describe("D3/D4 — Seçili kişi ve gizli görev sızıntısı", () => {
  it("Mehmet kendi Dashboard'u: tüm görevleri", async () => {
    const { body } = await summary(mehmet);
    expect(body.kpis.open.count).toBe(5); // t1 t2 t3 t4 t5
    expect(body.kpis.overdue.count).toBe(2); // t1 t4
    expect(body.kpis.doneThisWeek.count).toBe(1); // d1 (d2 geçen hafta)
    expect(body.upcoming.items.map((i: any) => i.title)).toEqual([
      `${PREFIX} t4 gizli gecikmiş`,
      `${PREFIX} t1 gecikmiş`,
      `${PREFIX} t2 yarın`,
      `${PREFIX} t3 incelemede`,
    ]);
    expect(body.upcoming.items.map((i: any) => i.group)).toEqual(["overdue", "overdue", "upcoming", "upcoming"]);
    expect(body.projects.total).toBe(7);
  });

  it("Manager Mehmet'i seçer: yalnız Manager'ın görebildikleri sayılır (P2 görevleri ve projesi sızmaz)", async () => {
    const { status, body } = await summary(mgr, mehmet.id);
    expect(status).toBe(200);
    expect(body.person).toMatchObject({ id: mehmet.id, isSelf: false });
    expect(body.kpis.open.count).toBe(3); // t4/t5 gizli
    expect(body.kpis.overdue.count).toBe(1); // t4 gizli
    expect(body.kpis.doneThisWeek.count).toBe(1);
    expect(Object.fromEntries(body.distribution.map((d: any) => [d.status, d.count]))).toEqual({
      TODO: 1,
      IN_PROGRESS: 1,
      REVIEW: 1,
      DONE: 2,
    });
    const titles = body.upcoming.items.map((i: any) => i.title);
    expect(titles).not.toContain(`${PREFIX} t4 gizli gecikmiş`);
    expect(titles).toEqual([`${PREFIX} t1 gecikmiş`, `${PREFIX} t2 yarın`, `${PREFIX} t3 incelemede`]);

    // Projeler: P2 (görünmez) ne listede ne toplamda
    expect(body.projects.total).toBe(6);
    expect(body.projects.items.map((p: any) => p.id)).not.toContain(p2.id);
    // Dikkat sırası: gecikmiş görevi olan P1 ilk sırada; istatistik yalnız görünen görevlerden
    expect(body.projects.items[0]).toMatchObject({ id: p1.id, overdueCount: 1, openCount: 3 });
  });
});

describe("D5 — KPI drill-down Görev Takip ile aynı toplamı verir", () => {
  it("4 KPI + dağılım + Tümünü Gör linkleri (Manager → Mehmet ve Mehmet → kendisi)", async () => {
    for (const [viewer, target] of [[mgr, mehmet], [mehmet, mehmet]] as [U, U][]) {
      const { body } = await summary(viewer, target.id);
      for (const key of ["open", "overdue", "review", "doneThisWeek"]) {
        expect(await boardTotal(viewer, body.kpis[key].href)).toBe(body.kpis[key].count);
      }
      for (const d of body.distribution) {
        expect(await boardTotal(viewer, d.href)).toBe(d.count);
      }
      expect(await boardTotal(viewer, body.upcoming.href)).toBe(body.upcoming.total);
    }
  });

  it("Geciken linki: Görev Takip'te Kişi = Mehmet + Gecikme = Gecikmiş", async () => {
    const { body } = await summary(mgr, mehmet.id);
    const f = parseBoardFilters(new URLSearchParams(body.kpis.overdue.href.split("?")[1]));
    expect(f).toMatchObject({ view: "all", personId: mehmet.id, overdue: "yes" });
    expect(body.kpis.overdue.href.startsWith("/board?")).toBe(true);
  });
});

describe("D6 — İnceleme KPI'ı", () => {
  it("review_owner = Mehmet olan 3 İncelemede görevi sayar; created_by kaydını saymaz", async () => {
    const { body } = await summary(mehmet);
    expect(body.kpis.review.count).toBe(3);
    const f = parseBoardFilters(new URLSearchParams(body.kpis.review.href.split("?")[1]));
    expect(f).toMatchObject({ reviewerId: mehmet.id, statuses: ["REVIEW"] });
    expect(body.pending.find((p: any) => p.key === "task-review")).toMatchObject({ count: 3 });
  });
});

describe("D7 — Görev güncellemesi Dashboard'a yansır", () => {
  it("Yapılacak → Devam Ediyor: dağılım değişir; tamamlanınca Açık düşer, Bu Hafta Tamamlanan artar", async () => {
    const t = await mkTask({ title: "d7", status: "TODO", assignedToId: mehmet.id, createdById: mgr.id, reviewOwnerId: mgr.id, projectId: p1.id });
    const before = (await summary(mehmet)).body;

    await prisma.task.update({ where: { id: t.id }, data: { status: "IN_PROGRESS" } });
    const mid = (await summary(mehmet)).body;
    const dist = (b: any) => Object.fromEntries(b.distribution.map((d: any) => [d.status, d.count]));
    expect(dist(mid).TODO).toBe(dist(before).TODO - 1);
    expect(dist(mid).IN_PROGRESS).toBe(dist(before).IN_PROGRESS + 1);
    expect(mid.kpis.open.count).toBe(before.kpis.open.count);

    await prisma.task.update({ where: { id: t.id }, data: { status: "DONE", completedAt: new Date() } });
    const after = (await summary(mehmet)).body;
    expect(after.kpis.open.count).toBe(before.kpis.open.count - 1);
    expect(after.kpis.doneThisWeek.count).toBe(before.kpis.doneThisWeek.count + 1);
    expect(dist(after).DONE).toBe(dist(before).DONE + 1);

    await prisma.task.delete({ where: { id: t.id } });
    createdTaskIds.splice(createdTaskIds.indexOf(t.id), 1);
  });
});

describe("D8 — Bekleyen harcama onayı", () => {
  it("onaycı Mehmet kendi Dashboard'unda 1 form görür → Onay Bekleyenler linki", async () => {
    const { body } = await summary(mehmet);
    expect(body.pending.find((p: any) => p.key === "expense-dept")).toEqual({
      key: "expense-dept",
      label: "Onaylaması Gereken Harcama Formları",
      count: 1,
      href: "/harcama?tab=approvals",
    });
  });

  it("Manager o formu göremez → Mehmet seçiliyken kategori hiç yok (sayı sızmaz)", async () => {
    const { body } = await summary(mgr, mehmet.id);
    expect(body.pending.find((p: any) => p.key === "expense-dept")).toBeUndefined();
    expect(body.pending.find((p: any) => p.key === "leave-approval")).toBeUndefined();
  });

  it("Admin Mehmet'i seçince (formu görebildiği için) aynı iş yükü görünür", async () => {
    const { body } = await summary(admin, mehmet.id);
    expect(body.pending.find((p: any) => p.key === "expense-dept")?.count).toBe(1);
  });
});

describe("D9 — Bekleyen izin onayı", () => {
  it("BD onaylayıcısı (ahmetoruc@) kendi Dashboard'unda bekleyen izin talebini görür", async () => {
    if (!ahmetOruc) return; // gerçek hesap yoksa atlanır
    const { body } = await summary(ahmetOruc);
    const item = body.pending.find((p: any) => p.key === "leave-approval");
    expect(item).toBeTruthy();
    expect(item.count).toBeGreaterThanOrEqual(1);
    expect(item.href.startsWith("/izin-durumu")).toBe(true);
  });
});

describe("D10 — Finansal gizlilik", () => {
  it("Manager Mehmet'in alacak/iade tutarlarını göremez; kendisi ve Admin görür", async () => {
    expect((await summary(mgr, mehmet.id)).body.finance).toBeNull();

    const self = (await summary(mehmet)).body.finance;
    expect(self).toMatchObject({ receivable: { amount: 0 }, refund: { amount: 0 } });
    expect(self.inApproval).not.toBeNull();

    const byAdmin = (await summary(admin, mehmet.id)).body.finance;
    expect(byAdmin).toMatchObject({ receivable: { amount: 0 }, refund: { amount: 0 }, inApproval: null });
  });

  it("Muhasebe yetkisi finansal özeti açar, diğer yöneticiler açamaz", () => {
    const base = { name: "x", email: "x@x", status: "ACTIVE", seniorityLevel: 11, canViewAllProjects: false, overseesDepartment: null };
    expect(canSeeDashboardFinance({ ...base, id: "acc", role: "EMPLOYEE", department: "MUHASEBE" }, "someone")).toBe(true);
    expect(canSeeDashboardFinance({ ...base, id: "mgr", role: "EMPLOYEE", department: BD }, "someone")).toBe(false);
    expect(canSeeDashboardFinance({ ...base, id: "a", role: "ADMIN", department: "ADMIN" }, "someone")).toBe(true);
    expect(canSeeDashboardFinance({ ...base, id: "me", role: "EMPLOYEE", department: BD }, "me")).toBe(true);
  });
});

describe("D11 — Proje limiti", () => {
  it("en fazla 5 Öne Çıkan Proje, Tüm Projeleri Gör toplamı ve üye filtresi linki", async () => {
    const { body } = await summary(mehmet);
    expect(body.projects.items.length).toBe(5);
    expect(body.projects.total).toBe(7);
    expect(body.projects.href).toBe(`/projeler?member=${mehmet.id}`);
    expect(body.projects.items.every((p: any) => p.href === `/projeler/${p.id}`)).toBe(true);
  });
});

describe("D12 — Görev Takip URL sözleşmesi", () => {
  it("parse ↔ serialize simetrik; geçersiz değerler yok sayılır", () => {
    const qs = "view=all&personId=u1&reviewerId=u2&status=REVIEW,TODO,BOGUS&completedRange=week&dueWithinDays=7&overdue=yes";
    const f = parseBoardFilters(new URLSearchParams(qs));
    expect(f).toMatchObject({ view: "all", personId: "u1", reviewerId: "u2", statuses: ["REVIEW", "TODO"], completedRange: "week", dueWithinDays: 7, overdue: "yes" });
    expect(parseBoardFilters(boardFiltersToParams(f))).toEqual(f);
    expect(parseBoardFilters(new URLSearchParams("dueWithinDays=abc")).dueWithinDays).toBeNull();
  });

  it("hafta başı Türkiye saatiyle Pazartesi 00:00", () => {
    // Perşembe 01.10.2026 10:00 TR → Pazartesi 28.09.2026 00:00 TR = 27.09.2026 21:00Z
    expect(currentWeekStart(new Date("2026-10-01T07:00:00Z")).toISOString()).toBe("2026-09-27T21:00:00.000Z");
    // Pazar 04.10.2026 23:30 TR hâlâ aynı hafta
    expect(currentWeekStart(new Date("2026-10-04T20:30:00Z")).toISOString()).toBe("2026-09-27T21:00:00.000Z");
    // Pazartesi 28.09.2026 00:10 TR (27.09 21:10Z) — haftanın ilk dakikaları
    expect(currentWeekStart(new Date("2026-09-27T21:10:00Z")).toISOString()).toBe("2026-09-27T21:00:00.000Z");
    // Pazartesi 05.10.2026 00:30 TR → yeni hafta
    expect(currentWeekStart(new Date("2026-10-04T21:30:00Z")).toISOString()).toBe("2026-10-04T21:00:00.000Z");
  });
});
