/**
 * GÖREV TAKİP YENİDEN YAPILANDIRMASI — /api/tasks/board entegrasyon testleri
 *
 * Bu uç yeni bir permission/workflow kuralı ÜRETMEZ; yalnızca mevcut Task
 * Core görünürlüğünün (buildTaskVisibilityWhereForUser) üzerine sorgu/
 * filtre/sayfalama katmanı ekler. Testler bunu doğrular.
 *
 *   B1  view=given → yalnızca reviewOwnerId=currentUser olan görevler
 *   B2  view=all → yalnızca canViewTask kapsamındaki görevler (başka departman sızmaz)
 *   B3  Admin department filtresi çalışıyor
 *   B4  Projesiz filtresi yalnız project_id olmayan görevleri getiriyor
 *   B5  Priority filtresi kolon sayısını değiştiriyor
 *   B6  Overdue filtresi doğru çalışıyor
 *   B7  Arama başlık/proje/atanan üzerinde çalışıyor
 *   B8  DONE kolonu varsayılan Son 30 Gün, Tümünü Göster eskileri de getiriyor
 *   B9  Sıralama: Gecikmiş → Yüksek öncelik → yakın son tarih → en yeni
 *   B10 Sürükle-bırak kaldırıldı (yapısal kontrol — @dnd-kit importu yok)
 */

import { describe, it, expect, beforeAll, afterAll, vi } from "vitest";
import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";
import fs from "fs";
import path from "path";

vi.mock("next-auth", () => ({ getServerSession: vi.fn() }));
vi.mock("next-auth/jwt", () => ({ getToken: vi.fn() }));

import { GET as boardGET } from "../../app/api/tasks/board/route";
import { getToken } from "next-auth/jwt";

const prisma = new PrismaClient();
const hash = (pw: string) => bcrypt.hash(pw, 10);
const PREFIX = `test-board-${Date.now()}`;
const email = (slug: string) => `${PREFIX}-${slug}@board.test`;

type TUser = {
  id: string; email: string; name: string; role: string; department: string;
  seniorityLevel: number; canViewAllProjects: boolean; overseesDepartment: string | null;
};

function asUser(u: TUser) {
  vi.mocked(getToken).mockResolvedValue({
    id: u.id, name: u.name, email: u.email, role: u.role,
    department: u.department, seniorityLevel: u.seniorityLevel,
    canViewAllProjects: u.canViewAllProjects, overseesDepartment: u.overseesDepartment,
  } as any);
}

function boardReq(qs: string): any {
  return new Request(`http://localhost/api/tasks/board?${qs}`);
}
async function json(res: Response) { return res.json(); }

function daysAgo(n: number): Date { const d = new Date(); d.setDate(d.getDate() - n); return d; }
function daysFromNow(n: number): Date { const d = new Date(); d.setDate(d.getDate() + n); return d; }

const cleanupUserIds: string[] = [];
const cleanupProjectIds: string[] = [];
const cleanupTaskIds: string[] = [];

let adminUser: TUser;
let managerBD: TUser;   // level 11, BAGIMSIZ_DENETIM — dept'in tamamını görür
let creatorBD: TUser;   // level 10, BAGIMSIZ_DENETIM — T2'nin ilk reviewOwner'ı
let assigneeBD: TUser;  // level 2, BAGIMSIZ_DENETIM
let outsideUser: TUser; // OUTSOURCE — departman izolasyonu testi

let projBD: string;

let tOverdueHigh: string;  // BD, projesiz, TODO, HIGH, dueDate dün — reviewOwner=managerBD
let tNoDue: string;        // BD, projesiz, TODO, LOW, dueDate yok — reviewOwner=creatorBD
let tInProject: string;    // BD, projBD, IN_PROGRESS, MEDIUM, dueDate ileri — reviewOwner=managerBD
let tOtherDept: string;    // OUTSOURCE — departman izolasyonu
let tDoneOld: string;      // BD, DONE, completedAt 40 gün önce
let tDoneRecent: string;   // BD, DONE, completedAt 5 gün önce

async function mkUser(slug: string, role: string, dept: string, level: number, cvap = false): Promise<TUser> {
  const u = await prisma.user.create({
    data: {
      name: `${PREFIX} ${slug}`, email: email(slug), password: await hash("test"),
      role, department: dept, seniorityLevel: level, canViewAllProjects: cvap,
    },
  });
  cleanupUserIds.push(u.id);
  return { id: u.id, email: u.email, name: u.name, role: u.role, department: dept, seniorityLevel: level, canViewAllProjects: cvap, overseesDepartment: null };
}

async function mkTask(opts: {
  title: string; status: string; priority: string;
  dueDate?: Date | null; completedAt?: Date | null;
  projectId?: string | null; departmentId?: string | null;
  assignedToId: string; reviewOwnerId: string; createdById: string;
}): Promise<string> {
  const t = await prisma.task.create({
    data: {
      title: opts.title, status: opts.status, priority: opts.priority,
      dueDate: opts.dueDate ?? null, completedAt: opts.completedAt ?? null,
      projectId: opts.projectId ?? null,
      departmentId: opts.projectId ? null : (opts.departmentId ?? "BAGIMSIZ_DENETIM"),
      assignedToId: opts.assignedToId, reviewOwnerId: opts.reviewOwnerId, createdById: opts.createdById,
    },
  });
  cleanupTaskIds.push(t.id);
  return t.id;
}

beforeAll(async () => {
  [adminUser, managerBD, creatorBD, assigneeBD, outsideUser] = await Promise.all([
    mkUser("admin", "ADMIN", "ADMIN", 15, true),
    mkUser("manager-bd", "EMPLOYEE", "BAGIMSIZ_DENETIM", 11),
    mkUser("creator-bd", "EMPLOYEE", "BAGIMSIZ_DENETIM", 10),
    mkUser("assignee-bd", "EMPLOYEE", "BAGIMSIZ_DENETIM", 2),
    mkUser("outside", "EMPLOYEE", "OUTSOURCE", 2),
  ]);

  const proj = await prisma.project.create({
    data: { name: `${PREFIX} Proje BD`, department: "BAGIMSIZ_DENETIM", createdById: managerBD.id },
  });
  cleanupProjectIds.push(proj.id);
  projBD = proj.id;
  await prisma.projectMember.create({ data: { projectId: projBD, userId: assigneeBD.id, assignedBy: managerBD.id } });

  [tOverdueHigh, tNoDue, tInProject, tOtherDept, tDoneOld, tDoneRecent] = await Promise.all([
    mkTask({
      title: `${PREFIX} Acil rapor`, status: "TODO", priority: "HIGH", dueDate: daysAgo(1),
      assignedToId: assigneeBD.id, reviewOwnerId: managerBD.id, createdById: managerBD.id,
    }),
    mkTask({
      title: `${PREFIX} Genel görev`, status: "TODO", priority: "LOW", dueDate: null,
      assignedToId: assigneeBD.id, reviewOwnerId: creatorBD.id, createdById: creatorBD.id,
    }),
    mkTask({
      title: `${PREFIX} Proje işi`, status: "IN_PROGRESS", priority: "MEDIUM", dueDate: daysFromNow(5),
      projectId: projBD, assignedToId: assigneeBD.id, reviewOwnerId: managerBD.id, createdById: managerBD.id,
    }),
    mkTask({
      title: `${PREFIX} Diğer departman görevi`, status: "TODO", priority: "MEDIUM", departmentId: "OUTSOURCE",
      assignedToId: outsideUser.id, reviewOwnerId: outsideUser.id, createdById: outsideUser.id,
    }),
    mkTask({
      title: `${PREFIX} Eski tamamlanan`, status: "DONE", priority: "LOW", completedAt: daysAgo(40),
      assignedToId: assigneeBD.id, reviewOwnerId: managerBD.id, createdById: managerBD.id,
    }),
    mkTask({
      title: `${PREFIX} Yeni tamamlanan`, status: "DONE", priority: "LOW", completedAt: daysAgo(5),
      assignedToId: assigneeBD.id, reviewOwnerId: managerBD.id, createdById: managerBD.id,
    }),
  ]);
});

afterAll(async () => {
  await prisma.task.deleteMany({ where: { id: { in: cleanupTaskIds } } });
  await prisma.projectMember.deleteMany({ where: { projectId: { in: cleanupProjectIds } } });
  await prisma.project.deleteMany({ where: { id: { in: cleanupProjectIds } } });
  await prisma.user.deleteMany({ where: { id: { in: cleanupUserIds } } });
  await prisma.$disconnect();
});

function allTitles(data: any): string[] {
  return data.columns.flatMap((c: any) => c.items.map((i: any) => i.title as string));
}

describe("B1 — Benim Verdiğim (view=given) → yalnızca review_owner", () => {
  it("managerBD → tOverdueHigh ve tInProject görünür, tNoDue (reviewOwner=creatorBD) görünmez", async () => {
    asUser(managerBD);
    const res = await boardGET(boardReq("view=given&completedRange=all"));
    expect(res.status).toBe(200);
    const data = await json(res);
    const titles = allTitles(data);
    expect(titles).toContain(`${PREFIX} Acil rapor`);
    expect(titles).toContain(`${PREFIX} Proje işi`);
    expect(titles).not.toContain(`${PREFIX} Genel görev`);
  });
});

describe("B2 — Tüm Görevler (view=all) → yalnızca canViewTask kapsamı", () => {
  it("assigneeBD kendi görevlerini görür, başka departmanın görevini görmez", async () => {
    asUser(assigneeBD);
    const res = await boardGET(boardReq("view=all&completedRange=all"));
    const data = await json(res);
    const titles = allTitles(data);
    expect(titles).toContain(`${PREFIX} Acil rapor`);
    expect(titles).toContain(`${PREFIX} Genel görev`);
    expect(titles).not.toContain(`${PREFIX} Diğer departman görevi`);
  });
});

describe("B3 — Admin departman filtresi", () => {
  it("department=BAGIMSIZ_DENETIM → OUTSOURCE görevi listede yok", async () => {
    asUser(adminUser);
    const res = await boardGET(boardReq("view=all&department=BAGIMSIZ_DENETIM&completedRange=all"));
    const data = await json(res);
    const titles = allTitles(data);
    expect(titles).not.toContain(`${PREFIX} Diğer departman görevi`);
    expect(titles).toContain(`${PREFIX} Acil rapor`);
  });

  it("normal kullanıcıda department parametresi sunucu tarafında yok sayılır", async () => {
    asUser(assigneeBD);
    const res = await boardGET(boardReq("view=all&department=OUTSOURCE&completedRange=all"));
    const data = await json(res);
    const titles = allTitles(data);
    // assigneeBD'nin OUTSOURCE görevine erişimi yok — filtre parametresi department
    // güvenlik sınırını bypass ETMEMELİ.
    expect(titles).not.toContain(`${PREFIX} Diğer departman görevi`);
  });
});

describe("B4 — Projesiz filtresi", () => {
  it("projectId=none → yalnızca projesiz görevler", async () => {
    asUser(managerBD);
    const res = await boardGET(boardReq("view=all&projectId=none&completedRange=all"));
    const data = await json(res);
    const titles = allTitles(data);
    expect(titles).toContain(`${PREFIX} Acil rapor`);
    expect(titles).not.toContain(`${PREFIX} Proje işi`);
  });

  it("proje/kişi filtre seçenekleri (meta) erişilebilir veriden türetiliyor", async () => {
    asUser(managerBD);
    const res = await boardGET(boardReq("view=all&completedRange=all"));
    const data = await json(res);
    expect(data.meta.projects.some((p: any) => p.name === `${PREFIX} Proje BD`)).toBe(true);
    expect(data.meta.people.some((p: any) => p.id === assigneeBD.id)).toBe(true);
    // outsideUser'ın görevi managerBD için görünür değil — kişi listesinde de olmamalı
    expect(data.meta.people.some((p: any) => p.id === outsideUser.id)).toBe(false);
  });
});

describe("B5 — Priority filtresi kolon sayısını güncelliyor", () => {
  it("priority=HIGH → TODO kolonunda yalnız 1 sonuç", async () => {
    asUser(managerBD);
    const res = await boardGET(boardReq("view=all&priority=HIGH&completedRange=all"));
    const data = await json(res);
    const todo = data.columns.find((c: any) => c.status === "TODO");
    expect(todo.items.map((i: any) => i.title)).toEqual([`${PREFIX} Acil rapor`]);
    expect(todo.total).toBe(1);
  });
});

describe("B6 — Gecikme (overdue) filtresi", () => {
  it("overdue=yes → yalnızca gecikmiş görev", async () => {
    asUser(managerBD);
    const res = await boardGET(boardReq("view=all&overdue=yes&completedRange=all"));
    const data = await json(res);
    const titles = allTitles(data);
    expect(titles).toEqual([`${PREFIX} Acil rapor`]);
  });

  it("overdue=no → gecikmiş görev listede yok", async () => {
    asUser(managerBD);
    const res = await boardGET(boardReq("view=all&overdue=no&completedRange=all"));
    const data = await json(res);
    const titles = allTitles(data);
    expect(titles).not.toContain(`${PREFIX} Acil rapor`);
  });
});

describe("B7 — Arama (başlık/proje/atanan)", () => {
  it("proje adına göre arama eşleşiyor", async () => {
    asUser(managerBD);
    const res = await boardGET(boardReq(`view=all&q=${encodeURIComponent("Proje BD")}&completedRange=all`));
    const data = await json(res);
    const titles = allTitles(data);
    expect(titles).toContain(`${PREFIX} Proje işi`);
    expect(titles).not.toContain(`${PREFIX} Acil rapor`);
  });

  it("atanan kişi adına göre arama eşleşiyor (Türkçe duyarlı)", async () => {
    asUser(managerBD);
    const res = await boardGET(boardReq(`view=all&q=${encodeURIComponent(assigneeBD.name.toLowerCase())}&completedRange=all`));
    const data = await json(res);
    const titles = allTitles(data);
    expect(titles).toContain(`${PREFIX} Acil rapor`);
  });
});

describe("B8 — Tamamlandı: Son 30 Gün / Tümünü Göster", () => {
  it("varsayılan (30d) → yalnızca son 30 gündeki tamamlanan", async () => {
    asUser(managerBD);
    const res = await boardGET(boardReq("view=all&completedRange=30d"));
    const data = await json(res);
    const done = data.columns.find((c: any) => c.status === "DONE");
    const titles = done.items.map((i: any) => i.title);
    expect(titles).toContain(`${PREFIX} Yeni tamamlanan`);
    expect(titles).not.toContain(`${PREFIX} Eski tamamlanan`);
  });

  it("Tümünü Göster (all) → eski tamamlanan da gelir", async () => {
    asUser(managerBD);
    const res = await boardGET(boardReq("view=all&completedRange=all"));
    const data = await json(res);
    const done = data.columns.find((c: any) => c.status === "DONE");
    const titles = done.items.map((i: any) => i.title);
    expect(titles).toContain(`${PREFIX} Yeni tamamlanan`);
    expect(titles).toContain(`${PREFIX} Eski tamamlanan`);
  });
});

describe("B9 — Sıralama: Gecikmiş → Yüksek öncelik → yakın son tarih → en yeni", () => {
  it("TODO kolonunda gecikmiş+yüksek öncelik en üstte", async () => {
    asUser(managerBD);
    const res = await boardGET(boardReq("view=all&completedRange=all"));
    const data = await json(res);
    const todo = data.columns.find((c: any) => c.status === "TODO");
    const titles = todo.items.map((i: any) => i.title);
    // tOverdueHigh (gecikmiş+HIGH) her zaman tNoDue'dan (gecikmemiş+LOW) önce gelmeli
    expect(titles.indexOf(`${PREFIX} Acil rapor`)).toBeLessThan(titles.indexOf(`${PREFIX} Genel görev`));
  });
});

describe("B-PAGINATION — tek kolon sayfalama (Daha Fazla Göster) ucu", () => {
  it("column=TODO&offset=0 tam pano yanıtındaki TODO kolonuyla aynı sonucu döner", async () => {
    asUser(managerBD);
    const fullRes = await boardGET(boardReq("view=all&completedRange=all"));
    const fullData = await json(fullRes);
    const fullTodo = fullData.columns.find((c: any) => c.status === "TODO");

    const pageRes = await boardGET(boardReq("view=all&completedRange=all&column=TODO&offset=0"));
    expect(pageRes.status).toBe(200);
    const page = await json(pageRes);
    expect(page.status).toBe("TODO");
    expect(page.total).toBe(fullTodo.total);
    expect(page.items.map((i: any) => i.id)).toEqual(fullTodo.items.map((i: any) => i.id));
  });

  it("geçersiz kolon adı → 400", async () => {
    asUser(managerBD);
    const res = await boardGET(boardReq("view=all&column=YANLIS&offset=0"));
    expect(res.status).toBe(400);
  });
});

describe("B10 — Sürükle-bırak kaldırıldı (yapısal kontrol)", () => {
  const componentsDir = path.resolve(__dirname, "../../components");

  it("components/board/*.tsx içinde @dnd-kit importu yok", () => {
    const boardDir = path.join(componentsDir, "board");
    const files = fs.readdirSync(boardDir).filter((f) => f.endsWith(".tsx"));
    expect(files.length).toBeGreaterThan(0);
    for (const f of files) {
      const src = fs.readFileSync(path.join(boardDir, f), "utf8");
      expect(src).not.toMatch(/@dnd-kit/);
    }
  });

  it("eski components/KanbanBoard.tsx kaldırıldı", () => {
    expect(fs.existsSync(path.join(componentsDir, "KanbanBoard.tsx"))).toBe(false);
  });
});
