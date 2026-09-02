/**
 * Proje görünürlüğü entegrasyon testleri — proje üyeliği modeli
 *
 * Gerçek Prisma (dev.db) ve gerçek route handler'ları kullanır.
 * next-auth session/token katmanı mock'lanır; geri kalan her şey gerçek.
 *
 * Senaryolar:
 *   T1   BD projesinin üyesi, aynı projedeki TÜM görevleri görür (kendi + diğer üyenin)
 *   T2   BD üyesi, yalnızca üyesi olduğu projenin görevlerini görür (diğer BD projesini değil)
 *   T3   BD üyesi, Vergi projesinin görevlerini API'de GÖRMEZ
 *   T4   Vergi üyesi, BD görevlerini GÖRMEZ
 *   T5   Proje dışı kullanıcı → hiçbir görev göremez
 *   T5b  Proje dışı kullanıcı → görev ID'sine GET → 404
 *   T6   Ahmet Oruç (overseesDept=BAGIMSIZ_DENETIM) → tüm BD görevlerini görür, Vergi'yi GÖRMEZ
 *   T7   Murat Özgür (overseesDept=VERGI) → tüm Vergi görevlerini görür, BD'yi GÖRMEZ
 *   T8   İsmail Koş (canViewAllProjects) → her iki birimin görevlerini de görür
 *   T9   seniorityLevel < 5 → POST /api/projects → 403
 *   T10  level 2 → level 4'e üye ekleme → 403
 *   T11  Vergi üyesi (Senior 1) → GET /api/projects/[bdProj] → 404
 *   T12  Ebubekir (overseesDept=VERGI, canViewAllProjects=false) → BD projesini göremez → 404
 *   T13  canViewAllProjects=true → her iki birimi görür (Murat Özgür gerçek davranışı)
 *   T14  Ahmet Oruç → Vergi görevini silmeye çalışır → 404
 *   T15  Asistant Manager (level 4) → POST /api/projects → 403
 *   T16  Manager 1 (level 5) → POST /api/projects → 201
 *   T17  Senior 2 (level 3) → level 5 kişiye görev atar → 403
 */

import { describe, it, expect, beforeAll, afterAll, vi } from "vitest";
import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";

// ── next-auth mock'ları ─────────────────────────────────────────────────────
vi.mock("next-auth", () => ({ getServerSession: vi.fn() }));
vi.mock("next-auth/jwt", () => ({ getToken: vi.fn() }));

import { GET as tasksGET, POST as tasksPOST } from "../../app/api/tasks/route";
import { GET as taskByIdGET, DELETE as tasksDELETE } from "../../app/api/tasks/[id]/route";
import { GET as projectsGET, POST as projectsPOST } from "../../app/api/projects/route";
import { GET as projectByIdGET, DELETE as projectDELETE, PATCH as projectPATCH } from "../../app/api/projects/[id]/route";
import { POST as projectMembersPOST } from "../../app/api/projects/[id]/members/route";
import { GET as assignableGET } from "../../app/api/users/assignable/route";
import { getServerSession } from "next-auth";
import { getToken } from "next-auth/jwt";

// ── Yardımcılar ─────────────────────────────────────────────────────────────

const prisma = new PrismaClient();
const hash = (pw: string) => bcrypt.hash(pw, 10);
const PREFIX = `test-proj-${Date.now()}`;
const email = (slug: string) => `${PREFIX}-${slug}@proj.test`;

type TestUser = {
  id: string;
  email: string;
  name: string;
  role: string;
  seniorityLevel: number;
  canViewAllProjects: boolean;
  overseesDepartment: string | null;
};

function makeToken(u: TestUser) {
  return {
    id: u.id,
    name: u.name,
    email: u.email,
    role: u.role,
    seniorityLevel: u.seniorityLevel,
    canViewAllProjects: u.canViewAllProjects,
    overseesDepartment: u.overseesDepartment,
    canViewAllTasks: false,
    department: "OUTSOURCE",
  };
}

function makeSession(u: TestUser) {
  return {
    user: {
      id: u.id,
      name: u.name,
      email: u.email,
      role: u.role,
      seniorityLevel: u.seniorityLevel,
      canViewAllProjects: u.canViewAllProjects,
      overseesDepartment: u.overseesDepartment,
      canViewAllTasks: false,
      department: "OUTSOURCE",
    },
    expires: new Date(Date.now() + 86_400_000).toISOString(),
  };
}

function asUser(u: TestUser) {
  vi.mocked(getServerSession).mockResolvedValue(makeSession(u) as any);
  vi.mocked(getToken).mockResolvedValue(makeToken(u) as any);
}

function fakeReq(url = "http://localhost/api/tasks"): any {
  return new Request(url);
}

async function json(res: Response) {
  return res.json();
}

// ── Test verisi ─────────────────────────────────────────────────────────────

let bdUser1: TestUser;     // BD projesinin üyesi (level 2)
let bdUser2: TestUser;     // Aynı BD projesinin üyesi (level 1)
let vergiUser: TestUser;   // Vergi projesinin üyesi (level 1)
let outsider: TestUser;    // Hiçbir projeye üye değil
let ahmetOruc: TestUser;   // overseesDepartment = BAGIMSIZ_DENETIM
let muratOzgur: TestUser;  // overseesDepartment = VERGI (eski davranış — T7 için)
let ismailKos: TestUser;   // canViewAllProjects = true
let manager: TestUser;     // seniorityLevel = 5, proje oluşturabilir
let junior: TestUser;      // seniorityLevel = 2, proje oluşturamaz
let midLevel: TestUser;    // seniorityLevel = 4, üye olunabilir ama junior (2) ekleyemez
// Yeni test kullanıcıları
let ebubekirTest: TestUser;   // overseesDepartment=VERGI, canViewAllProjects=false (istisna testi)
let muratViewAll: TestUser;   // canViewAllProjects=true, overseesDepartment=null (gerçek Murat davranışı)
let assistantManager: TestUser; // seniorityLevel = 4, proje oluşturamaz
let senior2User: TestUser;    // seniorityLevel = 3, yüksek kıdemliye atama yapamaz

let bdProj1Id: string;
let bdProj2Id: string;
let vergiProj1Id: string;
let vergiProj2Id: string;

// Task IDs
let task_bd1_user1: string;  // BD proj1, bdUser1'e atanmış
let task_bd1_user2: string;  // BD proj1, bdUser2'ye atanmış
let task_bd2: string;        // BD proj2, bdUser1'e atanmış (bdUser2 üye değil)
let task_vergi1: string;     // Vergi proj1, vergiUser'a atanmış

const createdUserIds: string[] = [];
const createdProjectIds: string[] = [];
const createdTaskIds: string[] = [];

beforeAll(async () => {
  async function mkUser(
    slug: string,
    level: number,
    canViewAll: boolean,
    overseeDept: string | null,
    name: string
  ): Promise<TestUser> {
    const u = await prisma.user.create({
      data: {
        name,
        email: email(slug),
        password: await hash("test123"),
        role: "EMPLOYEE",
        department: "OUTSOURCE",
        seniorityLevel: level,
        canViewAllProjects: canViewAll,
        overseesDepartment: overseeDept,
        canViewAllTasks: false,
      },
    });
    createdUserIds.push(u.id);
    return { id: u.id, email: u.email, name: u.name, role: u.role, seniorityLevel: level, canViewAllProjects: canViewAll, overseesDepartment: overseeDept };
  }

  // Kullanıcılar
  bdUser1         = await mkUser("bd1",   2,   false, null,               `${PREFIX} BD Üye 1`);
  bdUser2         = await mkUser("bd2",   1,   false, null,               `${PREFIX} BD Üye 2`);
  vergiUser       = await mkUser("vg1",   1,   false, null,               `${PREFIX} Vergi Üye`);
  outsider        = await mkUser("out",   0,   false, null,               `${PREFIX} Dışarıdan`);
  ahmetOruc       = await mkUser("ahmet", 8,   false, "BAGIMSIZ_DENETIM", `${PREFIX} Ahmet Oruç`);
  muratOzgur      = await mkUser("murat", 100, false, "VERGI",            `${PREFIX} Murat Özgür`);
  ismailKos       = await mkUser("ismail",100, true,  null,               `${PREFIX} İsmail Koş`);
  manager         = await mkUser("mgr",   5,   false, null,               `${PREFIX} Müdür`);
  junior          = await mkUser("jnr",   2,   false, null,               `${PREFIX} Junior`);
  midLevel        = await mkUser("mid",   4,   false, null,               `${PREFIX} MidLevel`);
  // Yeni kullanıcılar
  ebubekirTest    = await mkUser("ebub",  9,   false, "VERGI",            `${PREFIX} Ebubekir Test`);
  muratViewAll    = await mkUser("mrvw",  100, true,  null,               `${PREFIX} Murat ViewAll`);
  assistantManager= await mkUser("amgr",  4,   false, null,               `${PREFIX} Asistan Müdür`);
  senior2User     = await mkUser("sr2",   3,   false, null,               `${PREFIX} Senior 2`);

  // Admin hesabı (proje oluşturmak için)
  const adminUser = await prisma.user.create({
    data: {
      name: `${PREFIX} Test Admin`,
      email: email("admin"),
      password: await hash("admin"),
      role: "ADMIN",
      department: "ADMIN",
      seniorityLevel: 100,
      canViewAllProjects: true,
    },
  });
  createdUserIds.push(adminUser.id);

  // Projeler
  async function mkProject(name: string, dept: string, createdById: string, memberIds: string[]) {
    const p = await prisma.project.create({
      data: { name, department: dept, createdById },
    });
    createdProjectIds.push(p.id);
    await prisma.projectMember.createMany({
      data: [...new Set(memberIds)].map((uid) => ({ projectId: p.id, userId: uid, assignedBy: createdById })),
    });
    return p.id;
  }

  bdProj1Id    = await mkProject(`${PREFIX} BD Proje 1`, "BAGIMSIZ_DENETIM", adminUser.id, [bdUser1.id, bdUser2.id]);
  bdProj2Id    = await mkProject(`${PREFIX} BD Proje 2`, "BAGIMSIZ_DENETIM", adminUser.id, [bdUser1.id]);
  vergiProj1Id = await mkProject(`${PREFIX} Vergi Proje 1`, "VERGI", adminUser.id, [vergiUser.id]);
  vergiProj2Id = await mkProject(`${PREFIX} Vergi Proje 2`, "VERGI", adminUser.id, [vergiUser.id]);

  // Görevler
  async function mkTask(title: string, projectId: string, assignedToId: string, createdById: string) {
    const t = await prisma.task.create({
      data: { title, projectId, assignedToId, createdById, status: "TODO", priority: "MEDIUM" },
    });
    createdTaskIds.push(t.id);
    return t.id;
  }

  task_bd1_user1 = await mkTask(`${PREFIX} BD1 Görev bdUser1`, bdProj1Id, bdUser1.id, adminUser.id);
  task_bd1_user2 = await mkTask(`${PREFIX} BD1 Görev bdUser2`, bdProj1Id, bdUser2.id, adminUser.id);
  task_bd2       = await mkTask(`${PREFIX} BD2 Görev`,         bdProj2Id, bdUser1.id, adminUser.id);
  task_vergi1    = await mkTask(`${PREFIX} Vergi1 Görev`,      vergiProj1Id, vergiUser.id, adminUser.id);
});

afterAll(async () => {
  if (createdTaskIds.length > 0)
    await prisma.task.deleteMany({ where: { id: { in: createdTaskIds } } });
  if (createdProjectIds.length > 0) {
    await prisma.projectMember.deleteMany({ where: { projectId: { in: createdProjectIds } } });
    await prisma.project.deleteMany({ where: { id: { in: createdProjectIds } } });
  }
  if (createdUserIds.length > 0)
    await prisma.user.deleteMany({ where: { id: { in: createdUserIds } } });
  await prisma.$disconnect();
});

// ── Testler ─────────────────────────────────────────────────────────────────

describe("Görev listesi — GET /api/tasks", () => {
  it("T1: BD üyesi 1 aynı projede her iki üyenin görevini görür", async () => {
    asUser(bdUser1);
    const res = await tasksGET();
    expect(res.status).toBe(200);
    const tasks = await json(res);
    const ids = tasks.map((t: any) => t.id);
    expect(ids).toContain(task_bd1_user1);
    expect(ids).toContain(task_bd1_user2); // BD2'nin de üyesi olduğu için görev de görünür
    expect(ids).toContain(task_bd2);       // BD proj2 üyesi olduğu için
    expect(ids).not.toContain(task_vergi1); // Vergi projesinde değil
  });

  it("T2: BD üyesi 2 yalnızca BD Proje 1 görevlerini görür, BD Proje 2'yi değil", async () => {
    asUser(bdUser2);
    const res = await tasksGET();
    const tasks = await json(res);
    const ids = tasks.map((t: any) => t.id);
    expect(ids).toContain(task_bd1_user1);
    expect(ids).toContain(task_bd1_user2);
    expect(ids).not.toContain(task_bd2);   // BD Proje 2'ye üye değil
    expect(ids).not.toContain(task_vergi1);
  });

  it("T3: BD üyesi, Vergi projesinin görevlerini göremez", async () => {
    asUser(bdUser1);
    const res = await tasksGET();
    const tasks = await json(res);
    const ids = tasks.map((t: any) => t.id);
    expect(ids).not.toContain(task_vergi1);
  });

  it("T4: Vergi üyesi, BD görevlerini göremez", async () => {
    asUser(vergiUser);
    const res = await tasksGET();
    const tasks = await json(res);
    const ids = tasks.map((t: any) => t.id);
    expect(ids).toContain(task_vergi1);
    expect(ids).not.toContain(task_bd1_user1);
    expect(ids).not.toContain(task_bd1_user2);
    expect(ids).not.toContain(task_bd2);
  });

  it("T5: Proje dışı kullanıcı test görevlerinden hiçbirini göremez", async () => {
    asUser(outsider);
    const res = await tasksGET();
    const tasks = await json(res);
    const ids = tasks.map((t: any) => t.id);
    expect(ids).not.toContain(task_bd1_user1);
    expect(ids).not.toContain(task_bd1_user2);
    expect(ids).not.toContain(task_bd2);
    expect(ids).not.toContain(task_vergi1);
  });
});

describe("Görev detay — GET /api/tasks/[id]", () => {
  it("T5b: Proje dışı kullanıcı → görev ID'si → 404", async () => {
    asUser(outsider);
    const res = await taskByIdGET(fakeReq(), { params: { id: task_bd1_user1 } });
    expect(res.status).toBe(404);
  });

  it("Vergi üyesi → BD görevi → 404", async () => {
    asUser(vergiUser);
    const res = await taskByIdGET(fakeReq(), { params: { id: task_bd1_user1 } });
    expect(res.status).toBe(404);
  });

  it("BD üyesi → kendi projesinin görevi → 200", async () => {
    asUser(bdUser2);
    const res = await taskByIdGET(fakeReq(), { params: { id: task_bd1_user1 } });
    expect(res.status).toBe(200);
    const task = await json(res);
    expect(task.id).toBe(task_bd1_user1);
  });
});

describe("Gözetmen erişimi", () => {
  it("T6: Ahmet Oruç tüm BD görevlerini görür, Vergi'yi görmez", async () => {
    asUser(ahmetOruc);
    const res = await tasksGET();
    const tasks = await json(res);
    const ids = tasks.map((t: any) => t.id);
    expect(ids).toContain(task_bd1_user1);
    expect(ids).toContain(task_bd1_user2);
    expect(ids).toContain(task_bd2);
    expect(ids).not.toContain(task_vergi1);
  });

  it("T7: Murat Özgür tüm Vergi görevlerini görür, BD'yi görmez", async () => {
    asUser(muratOzgur);
    const res = await tasksGET();
    const tasks = await json(res);
    const ids = tasks.map((t: any) => t.id);
    expect(ids).toContain(task_vergi1);
    expect(ids).not.toContain(task_bd1_user1);
    expect(ids).not.toContain(task_bd1_user2);
    expect(ids).not.toContain(task_bd2);
  });

  it("T8: İsmail Koş iki birimin görevlerini de görür", async () => {
    asUser(ismailKos);
    const res = await tasksGET();
    const tasks = await json(res);
    const ids = tasks.map((t: any) => t.id);
    expect(ids).toContain(task_bd1_user1);
    expect(ids).toContain(task_bd1_user2);
    expect(ids).toContain(task_bd2);
    expect(ids).toContain(task_vergi1);
  });
});

describe("Proje oluşturma — POST /api/projects", () => {
  it("T9: seniorityLevel < 5 proje oluşturamaz → 403", async () => {
    asUser(junior); // level 2

    const postReq = new Request("http://localhost/api/projects", {
      method: "POST",
      body: JSON.stringify({ name: `${PREFIX} Yasak Proje`, department: "BAGIMSIZ_DENETIM" }),
      headers: { "Content-Type": "application/json" },
    });
    const res = await projectsPOST(postReq as any);
    expect(res.status).toBe(403);

    // Proje oluşturulmamış olmalı
    const leaked = await prisma.project.findFirst({ where: { name: `${PREFIX} Yasak Proje` } });
    expect(leaked).toBeNull();
  });

  it("seniorityLevel >= 5 proje oluşturabilir → 201", async () => {
    asUser(manager); // level 5

    const postReq = new Request("http://localhost/api/projects", {
      method: "POST",
      body: JSON.stringify({ name: `${PREFIX} Manager Projesi`, department: "VERGI" }),
      headers: { "Content-Type": "application/json" },
    });
    const res = await projectsPOST(postReq as any);
    expect(res.status).toBe(201);
    const data = await json(res);
    expect(data.name).toBe(`${PREFIX} Manager Projesi`);
    // Temizlik için
    createdProjectIds.push(data.id);
    await prisma.projectMember.deleteMany({ where: { projectId: data.id } });
    await prisma.project.delete({ where: { id: data.id } });
    createdProjectIds.pop();
  });
});

describe("Üye ekleme yetkisi — POST /api/projects/[id]/members", () => {
  it("T10: level 2 (junior) → level 4 (midLevel) kişiyi üye ekleyemez → 403", async () => {
    asUser(junior); // seniorityLevel=2

    const postReq = new Request(`http://localhost/api/projects/${bdProj1Id}/members`, {
      method: "POST",
      body: JSON.stringify({ addUserIds: [midLevel.id] }), // midLevel = seviye 4
      headers: { "Content-Type": "application/json" },
    });
    const res = await projectMembersPOST(postReq as any, { params: { id: bdProj1Id } });
    expect(res.status).toBe(403);
  });
});

describe("Proje listesi — GET /api/projects", () => {
  it("BD üyesi sadece BD projelerini görür", async () => {
    asUser(bdUser1);
    const postReq = new Request("http://localhost/api/projects");
    const res = await projectsGET(postReq as any);
    expect(res.status).toBe(200);
    const projects = await json(res);
    const depts = projects.map((p: any) => p.department);
    // Tüm görülen projeler BD olmalı (test projeler)
    const testProjs = projects.filter((p: any) => p.name.startsWith(PREFIX));
    expect(testProjs.every((p: any) => p.department === "BAGIMSIZ_DENETIM")).toBe(true);
  });

  it("İsmail Koş her iki birimden proje görür", async () => {
    asUser(ismailKos);
    const postReq = new Request("http://localhost/api/projects");
    const res = await projectsGET(postReq as any);
    const projects = await json(res);
    const testProjs = projects.filter((p: any) => p.name.startsWith(PREFIX));
    const depts = new Set(testProjs.map((p: any) => p.department));
    expect(depts.has("BAGIMSIZ_DENETIM")).toBe(true);
    expect(depts.has("VERGI")).toBe(true);
  });
});

// ── Yeni test senaryoları ────────────────────────────────────────────────────

describe("T11: Proje detay — GET /api/projects/[id] çapraz birim erişimi", () => {
  it("Vergi üyesi (Senior 1), BD projesini ID ile çekemez → 404", async () => {
    asUser(vergiUser); // Vergi üyesi, BD projesine erişimi yok
    const req = fakeReq(`http://localhost/api/projects/${bdProj1Id}`);
    const res = await projectByIdGET(req, { params: { id: bdProj1Id } });
    expect(res.status).toBe(404);
  });
});

describe("T12: Ebubekir istisna testi — overseesDept=VERGI, canViewAllProjects=false", () => {
  it("Ebubekir (overseesDept=VERGI) BD projesini göremez → 404", async () => {
    asUser(ebubekirTest); // level 9 ama canViewAllProjects=false, overseesDept=VERGI
    const req = fakeReq(`http://localhost/api/projects/${bdProj1Id}`);
    const res = await projectByIdGET(req, { params: { id: bdProj1Id } });
    expect(res.status).toBe(404);
  });

  it("Ebubekir (overseesDept=VERGI) BD görevlerini listede görmez", async () => {
    asUser(ebubekirTest);
    const res = await tasksGET();
    const tasks = await json(res);
    const ids = tasks.map((t: any) => t.id);
    expect(ids).not.toContain(task_bd1_user1);
    expect(ids).not.toContain(task_bd1_user2);
    expect(ids).not.toContain(task_bd2);
  });
});

describe("T13: canViewAllProjects=true → her iki birimi görür", () => {
  it("İsmail Koş (canViewAllProjects=true) her iki birimin görevlerini görür", async () => {
    asUser(ismailKos);
    const res = await tasksGET();
    const tasks = await json(res);
    const ids = tasks.map((t: any) => t.id);
    expect(ids).toContain(task_bd1_user1);
    expect(ids).toContain(task_vergi1);
  });

  it("Murat (canViewAllProjects=true, overseesDept=null) her iki birimi görür", async () => {
    asUser(muratViewAll); // canViewAllProjects=true, overseesDepartment=null
    const res = await tasksGET();
    const tasks = await json(res);
    const ids = tasks.map((t: any) => t.id);
    expect(ids).toContain(task_bd1_user1);
    expect(ids).toContain(task_vergi1);
  });
});

describe("T14: Gözetmen çapraz silme — DELETE /api/tasks/[id]", () => {
  it("Ahmet Oruç (overseesDept=BAGIMSIZ_DENETIM) Vergi görevini silmeye çalışır → 404", async () => {
    asUser(ahmetOruc);
    const req = fakeReq(`http://localhost/api/tasks/${task_vergi1}`);
    const res = await tasksDELETE(req, { params: { id: task_vergi1 } });
    expect(res.status).toBe(404);
    // Görevin gerçekten silinmediğini doğrula
    const still = await prisma.task.findUnique({ where: { id: task_vergi1 } });
    expect(still).not.toBeNull();
  });
});

describe("T15/T16: Proje oluşturma — kıdem sınırı", () => {
  it("T15: Asistant Manager (level 4) proje oluşturamaz → 403", async () => {
    asUser(assistantManager); // level 4
    const postReq = new Request("http://localhost/api/projects", {
      method: "POST",
      body: JSON.stringify({ name: `${PREFIX} AsstMgr Projesi`, department: "VERGI" }),
      headers: { "Content-Type": "application/json" },
    });
    const res = await projectsPOST(postReq as any);
    expect(res.status).toBe(403);
    // Proje oluşturulmamış olmalı
    const leaked = await prisma.project.findFirst({ where: { name: `${PREFIX} AsstMgr Projesi` } });
    expect(leaked).toBeNull();
  });

  it("T16: Manager 1 (level 5) proje oluşturabilir → 201", async () => {
    asUser(manager); // level 5
    const postReq = new Request("http://localhost/api/projects", {
      method: "POST",
      body: JSON.stringify({ name: `${PREFIX} Mgr1 Projesi`, department: "VERGI" }),
      headers: { "Content-Type": "application/json" },
    });
    const res = await projectsPOST(postReq as any);
    expect(res.status).toBe(201);
    const data = await json(res);
    expect(data.name).toBe(`${PREFIX} Mgr1 Projesi`);
    // Temizlik
    await prisma.projectMember.deleteMany({ where: { projectId: data.id } });
    await prisma.project.delete({ where: { id: data.id } });
  });
});

describe("T18/T19/T20: Proje silme yetkisi — DELETE /api/projects/[id]", () => {
  // Her test kendi projesini oluşturur — afterAll temizliği için createdProjectIds'e eklenir.
  // T18 projeyi gerçekten siler → listeden çıkar; T19/T20 siler olmaz → listede kalır.

  it("T19: Aynı projedeki başka bir üye silemiyor → 404", async () => {
    // manager (level 5) proje oluşturuyor, bdUser1 sadece üye
    const proj = await prisma.project.create({
      data: { name: `${PREFIX} Silme T19`, department: "BAGIMSIZ_DENETIM", createdById: manager.id },
    });
    createdProjectIds.push(proj.id);
    await prisma.projectMember.createMany({
      data: [
        { projectId: proj.id, userId: manager.id, assignedBy: manager.id },
        { projectId: proj.id, userId: bdUser1.id, assignedBy: manager.id },
      ],
    });

    asUser(bdUser1); // üye ama kurucu değil, gözetmen değil, ADMIN değil
    const req = fakeReq(`http://localhost/api/projects/${proj.id}`);
    const res = await projectDELETE(req, { params: { id: proj.id } });
    expect(res.status).toBe(404);

    // Proje silinmemiş olmalı
    const still = await prisma.project.findUnique({ where: { id: proj.id } });
    expect(still).not.toBeNull();
  });

  it("T20: Başka birimden bir kullanıcı silemiyor → 404", async () => {
    const proj = await prisma.project.create({
      data: { name: `${PREFIX} Silme T20`, department: "BAGIMSIZ_DENETIM", createdById: manager.id },
    });
    createdProjectIds.push(proj.id);
    await prisma.projectMember.create({
      data: { projectId: proj.id, userId: manager.id, assignedBy: manager.id },
    });

    asUser(vergiUser); // Vergi projesinde üye, BD projesinde yok, kurucu da değil
    const req = fakeReq(`http://localhost/api/projects/${proj.id}`);
    const res = await projectDELETE(req, { params: { id: proj.id } });
    expect(res.status).toBe(404);

    const still = await prisma.project.findUnique({ where: { id: proj.id } });
    expect(still).not.toBeNull();
  });

  it("T18: Projeyi oluşturan kişi kendi projesini silebilir → 200", async () => {
    const proj = await prisma.project.create({
      data: { name: `${PREFIX} Silme T18`, department: "BAGIMSIZ_DENETIM", createdById: manager.id },
    });
    // afterAll'a ekliyoruz; silinirse deleteMany silinen ID'yi sessizce atlar
    createdProjectIds.push(proj.id);
    await prisma.projectMember.create({
      data: { projectId: proj.id, userId: manager.id, assignedBy: manager.id },
    });

    asUser(manager); // projeyi oluşturan kişi
    const req = fakeReq(`http://localhost/api/projects/${proj.id}`);
    const res = await projectDELETE(req, { params: { id: proj.id } });
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.ok).toBe(true);

    // Proje gerçekten silinmiş olmalı
    const gone = await prisma.project.findUnique({ where: { id: proj.id } });
    expect(gone).toBeNull();
  });
});

// ── Yeni testler: departman filtresi ve PATCH yetkisi ────────────────────────

describe("Üye listesi departman filtresi — GET /api/users/assignable?projectDept", () => {
  let bdDeptUser: { id: string };
  let ymmDeptUser: { id: string };
  let muhasebeDeptUser: { id: string };

  beforeAll(async () => {
    const [bd, ymm, muh] = await Promise.all([
      prisma.user.create({
        data: {
          name: `${PREFIX} BD Kadro`,
          email: email("bd-kadro"),
          password: await hash("test123"),
          role: "EMPLOYEE",
          department: "BAGIMSIZ_DENETIM",
          seniorityLevel: 1,
          canViewAllProjects: false,
          overseesDepartment: null,
          canViewAllTasks: false,
        },
      }),
      prisma.user.create({
        data: {
          name: `${PREFIX} YMM Kadro`,
          email: email("ymm-kadro"),
          password: await hash("test123"),
          role: "EMPLOYEE",
          department: "YEMINLI_MALI_MUSAVIR",
          seniorityLevel: 1,
          canViewAllProjects: false,
          overseesDepartment: null,
          canViewAllTasks: false,
        },
      }),
      prisma.user.create({
        data: {
          name: `${PREFIX} Muhasebe Kadro`,
          email: email("muh-kadro"),
          password: await hash("test123"),
          role: "EMPLOYEE",
          department: "MUHASEBE",
          seniorityLevel: 1,
          canViewAllProjects: false,
          overseesDepartment: null,
          canViewAllTasks: false,
        },
      }),
    ]);
    bdDeptUser = bd;
    ymmDeptUser = ymm;
    muhasebeDeptUser = muh;
    createdUserIds.push(bd.id, ymm.id, muh.id);
  });

  it("BD filtresi: YEMINLI_MALI_MUSAVIR kadrosundan kimse dönmez", async () => {
    // ismailKos: level 100, tüm düşük kıdemlileri görebilir
    asUser(ismailKos);
    const req = new Request("http://localhost/api/users/assignable?projectDept=BAGIMSIZ_DENETIM");
    const res = await assignableGET(req as any);
    expect(res.status).toBe(200);
    const users = await json(res);
    const ids = users.map((u: any) => u.id);
    expect(ids).not.toContain(ymmDeptUser.id);
    expect(ids).toContain(bdDeptUser.id);
  });

  it("Vergi filtresi: BAGIMSIZ_DENETIM kadrosundan kimse dönmez", async () => {
    asUser(ismailKos);
    const req = new Request("http://localhost/api/users/assignable?projectDept=VERGI");
    const res = await assignableGET(req as any);
    expect(res.status).toBe(200);
    const users = await json(res);
    const ids = users.map((u: any) => u.id);
    expect(ids).not.toContain(bdDeptUser.id);
    expect(ids).toContain(ymmDeptUser.id);
  });

  it("BD filtresi: MUHASEBE/IDARI_ISLER/OUTSOURCE kadrosundan kimse dönmez", async () => {
    asUser(ismailKos);
    const req = new Request("http://localhost/api/users/assignable?projectDept=BAGIMSIZ_DENETIM");
    const res = await assignableGET(req as any);
    const users = await json(res);
    const ids = users.map((u: any) => u.id);
    // MUHASEBE bloklu
    expect(ids).not.toContain(muhasebeDeptUser.id);
    // OUTSOURCE bloklu (tüm test kullanıcıları OUTSOURCE — hiçbiri görünmemeli)
    expect(ids).not.toContain(outsider.id);
    expect(ids).not.toContain(bdUser1.id); // bdUser1 dept=OUTSOURCE
  });
});

describe("Proje güncelleme — PATCH /api/projects/[id]", () => {
  it("Projeyi oluşturan kişi PATCH ile güncelleyebilir → 200", async () => {
    // manager projeyi oluşturuyor
    const proj = await prisma.project.create({
      data: { name: `${PREFIX} PATCH T-Kurucu`, department: "BAGIMSIZ_DENETIM", createdById: manager.id },
    });
    createdProjectIds.push(proj.id);
    await prisma.projectMember.create({
      data: { projectId: proj.id, userId: manager.id, assignedBy: manager.id },
    });

    asUser(manager);
    const req = new Request(`http://localhost/api/projects/${proj.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: `${PREFIX} Güncellenmiş Proje` }),
    });
    const res = await projectPATCH(req as any, { params: { id: proj.id } });
    expect(res.status).toBe(200);
    const data = await json(res);
    expect(data.name).toBe(`${PREFIX} Güncellenmiş Proje`);
    // department değişmemeli (body'de gönderilmedi; PATCH dept kabul etmez)
    expect(data.department).toBe("BAGIMSIZ_DENETIM");
  });

  it("İlgisiz üye (kurucu değil, gözetmen değil, admin değil) PATCH yapamaz → 404", async () => {
    // bdUser1, bdProj1Id'nin üyesi ama kurucusu adminUser
    asUser(bdUser1);
    const req = new Request(`http://localhost/api/projects/${bdProj1Id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: `${PREFIX} Yasak Güncelleme` }),
    });
    const res = await projectPATCH(req as any, { params: { id: bdProj1Id } });
    expect(res.status).toBe(404);

    // Proje adı değişmemiş olmalı
    const proj = await prisma.project.findUnique({ where: { id: bdProj1Id } });
    expect(proj?.name).not.toBe(`${PREFIX} Yasak Güncelleme`);
  });

  it("department alanı PATCH ile değiştirilemez", async () => {
    const proj = await prisma.project.create({
      data: { name: `${PREFIX} Dept Koruması`, department: "BAGIMSIZ_DENETIM", createdById: manager.id },
    });
    createdProjectIds.push(proj.id);
    await prisma.projectMember.create({
      data: { projectId: proj.id, userId: manager.id, assignedBy: manager.id },
    });

    asUser(manager);
    const req = new Request(`http://localhost/api/projects/${proj.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: proj.name, department: "VERGI" }),
    });
    const res = await projectPATCH(req as any, { params: { id: proj.id } });
    expect(res.status).toBe(200);
    const data = await json(res);
    // department gönderilse bile değişmemeli
    expect(data.department).toBe("BAGIMSIZ_DENETIM");
  });
});

describe("T17: Görev atama — kıdem kontrolü", () => {
  it("Senior 2 (level 3), Manager 1 (level 5) kişiye görev atayamaz → 403", async () => {
    asUser(senior2User); // seniorityLevel=3
    const postReq = new Request("http://localhost/api/tasks", {
      method: "POST",
      body: JSON.stringify({
        title: `${PREFIX} Kıdem Test Görevi`,
        assigneeIds: [manager.id], // manager seniorityLevel=5
      }),
      headers: { "Content-Type": "application/json" },
    });
    const res = await tasksPOST(postReq as any);
    expect(res.status).toBe(403);
    // Görev oluşturulmamış olmalı
    const leaked = await prisma.task.findFirst({ where: { title: `${PREFIX} Kıdem Test Görevi` } });
    expect(leaked).toBeNull();
  });

  it("Senior 2 (level 3), Senior 1 (level 2) kişiye görev atayabilir → 201", async () => {
    asUser(senior2User); // seniorityLevel=3
    const postReq = new Request("http://localhost/api/tasks", {
      method: "POST",
      body: JSON.stringify({
        title: `${PREFIX} Geçerli Atama Görevi`,
        assigneeIds: [bdUser2.id], // bdUser2 seniorityLevel=1
      }),
      headers: { "Content-Type": "application/json" },
    });
    const res = await tasksPOST(postReq as any);
    expect(res.status).toBe(201);
    const data = await json(res);
    // Temizlik
    await prisma.taskAssignee.deleteMany({ where: { taskId: data.id } });
    await prisma.task.delete({ where: { id: data.id } });
  });
});
