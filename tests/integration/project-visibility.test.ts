/**
 * Proje görünürlüğü entegrasyon testleri — kişiye özgü görev görünürlük modeli
 *
 * Gerçek Prisma (dev.db) ve gerçek route handler'ları kullanır.
 * next-auth session/token katmanı mock'lanır; geri kalan her şey gerçek.
 *
 * Senaryolar:
 *   T1   BD üyesi 1 yalnızca kendine atanmış görevleri görür (üye olduğu projedeki başka üyenin görevi GÖRÜNMEz)
 *   T2   BD üyesi 2 yalnızca kendine atanmış görevi görür
 *   T3   BD üyesi, Vergi projesinin görevlerini API'de GÖRMEZ
 *   T4   Vergi üyesi, BD görevlerini GÖRMEZ
 *   T5   Proje dışı kullanıcı → hiçbir görev göremez
 *   T5b  Proje dışı kullanıcı → görev ID'sine GET → 404
 *   T6   Ahmet Oruç (overseesDept=BAGIMSIZ_DENETIM) → tüm BD görevlerini görür, Vergi'yi GÖRMEZ
 *   T7   Murat Özgür (overseesDept=VERGI) → tüm Vergi görevlerini görür, BD'yi GÖRMEZ
 *   T8   İsmail Koş (canViewAllProjects) → her iki birimin görevlerini de görür
 *   T9   seniorityLevel < 8 → POST /api/projects → 403
 *   T10  level 2 → level 4'e üye ekleme → 403
 *   T11  Vergi üyesi (Senior 1) → GET /api/projects/[bdProj] → 404
 *   T12  Ebubekir (overseesDept=VERGI, canViewAllProjects=false) → BD projesini göremez → 404
 *   T13  canViewAllProjects=true → her iki birimi görür (Murat Özgür gerçek davranışı)
 *   T14  Ahmet Oruç → Vergi görevini silmeye çalışır → 404
 *   T15  Asistant Manager (level 4) → POST /api/projects → 403
 *   T16  Manager 1 (level 8) → POST /api/projects → 201
 *   T17  Senior 2 (level 3) → level 8 kişiye görev atar → 403
 *   T-A  A üyesi, B üyesinin görevini ID ile çekemez → 404 (yeni kural)
 *   T-B  Proje kurucusu, kendi projesindeki başkasına atanan görevi görür → 200
 *   T-REG Vergi projesi üye listesi → YEMINLI_MALI_MUSAVIR kullanıcıları döner (regresyon)
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
import { POST as projectStatusPOST } from "../../app/api/projects/[id]/status/route";
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
  department?: string;
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
    department: u.department ?? "OUTSOURCE",
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
      department: u.department ?? "OUTSOURCE",
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
let manager: TestUser;     // seniorityLevel = 8 (Manager 1), proje oluşturabilir
let junior: TestUser;      // seniorityLevel = 2, proje oluşturamaz
let midLevel: TestUser;    // seniorityLevel = 4, üye olunabilir ama junior (2) ekleyemez
// Yeni test kullanıcıları
let ebubekirTest: TestUser;   // overseesDepartment=VERGI, canViewAllProjects=false (istisna testi)
let muratViewAll: TestUser;   // canViewAllProjects=true, overseesDepartment=null (gerçek Murat davranışı)
let assistantManager: TestUser; // seniorityLevel = 4, proje oluşturamaz
let senior2User: TestUser;    // seniorityLevel = 3, yüksek kıdemliye atama yapamaz
// ADMIN/canViewAll seniority bypass testleri için
let adminLow: TestUser;       // role=ADMIN, seniorityLevel=0
let canViewAllLow: TestUser;  // canViewAllProjects=true, seniorityLevel=0
let highTarget: TestUser;     // seniorityLevel=9, yüksek kıdemli hedef
// canBeAssignedTasks testleri için
let notAssignable: TestUser;  // canBeAssignedTasks=false, seniorityLevel=8 (görev atayabilir, kendisine atanamaz)

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
const softDeletedTaskIds: string[] = []; // C BLOĞU: soft-delete ile silinen görevler

beforeAll(async () => {
  async function mkUser(
    slug: string,
    level: number,
    canViewAll: boolean,
    overseeDept: string | null,
    name: string,
    dept = "OUTSOURCE"
  ): Promise<TestUser> {
    const u = await prisma.user.create({
      data: {
        name,
        email: email(slug),
        password: await hash("test123"),
        role: "EMPLOYEE",
        department: dept,
        seniorityLevel: level,
        canViewAllProjects: canViewAll,
        overseesDepartment: overseeDept,
        canViewAllTasks: false,
      },
    });
    createdUserIds.push(u.id);
    return { id: u.id, email: u.email, name: u.name, role: u.role, seniorityLevel: level, canViewAllProjects: canViewAll, overseesDepartment: overseeDept, department: u.department };
  }

  // Kullanıcılar
  // A BLOĞU: departman kapısı — kullanıcı departmanı proje departmanıyla eşleşmeli
  bdUser1         = await mkUser("bd1",   2,   false, null,               `${PREFIX} BD Üye 1`,   "BAGIMSIZ_DENETIM");
  bdUser2         = await mkUser("bd2",   1,   false, null,               `${PREFIX} BD Üye 2`,   "BAGIMSIZ_DENETIM");
  vergiUser       = await mkUser("vg1",   1,   false, null,               `${PREFIX} Vergi Üye`,  "YEMINLI_MALI_MUSAVIR");
  outsider        = await mkUser("out",   0,   false, null,               `${PREFIX} Dışarıdan`);
  ahmetOruc       = await mkUser("ahmet", 8,   false, "BAGIMSIZ_DENETIM", `${PREFIX} Ahmet Oruç`);
  muratOzgur      = await mkUser("murat", 100, false, "YMM",              `${PREFIX} Murat Özgür`);
  ismailKos       = await mkUser("ismail",100, true,  null,               `${PREFIX} İsmail Koş`);
  manager         = await mkUser("mgr",   8,   false, null,               `${PREFIX} Müdür`,  "BAGIMSIZ_DENETIM");
  junior          = await mkUser("jnr",   2,   false, null,               `${PREFIX} Junior`);
  midLevel        = await mkUser("mid",   4,   false, null,               `${PREFIX} MidLevel`);
  // Yeni kullanıcılar
  ebubekirTest    = await mkUser("ebub",  9,   false, "YMM",              `${PREFIX} Ebubekir Test`);
  muratViewAll    = await mkUser("mrvw",  100, true,  null,               `${PREFIX} Murat ViewAll`);
  assistantManager= await mkUser("amgr",  4,   false, null,               `${PREFIX} Asistan Müdür`);
  senior2User     = await mkUser("sr2",   3,   false, null,               `${PREFIX} Senior 2`);
  highTarget      = await mkUser("htgt",  9,   false, null,               `${PREFIX} High Target`);
  canViewAllLow   = await mkUser("cvla",  0,   true,  null,               `${PREFIX} CanViewAll Low`);

  // ADMIN (low seniority) — mkUser "EMPLOYEE" atar, doğrudan oluştur
  const adminLowDb = await prisma.user.create({
    data: {
      name: `${PREFIX} Admin Low`,
      email: email("adminlow"),
      password: await hash("test123"),
      role: "ADMIN",
      department: "ADMIN",
      seniorityLevel: 0,
      canViewAllProjects: false,
      overseesDepartment: null,
      canViewAllTasks: false,
    },
  });
  createdUserIds.push(adminLowDb.id);
  adminLow = { id: adminLowDb.id, email: adminLowDb.email, name: adminLowDb.name, role: "ADMIN", seniorityLevel: 0, canViewAllProjects: false, overseesDepartment: null };

  // canBeAssignedTasks=false kullanıcı
  const notAssignableDb = await prisma.user.create({
    data: {
      name: `${PREFIX} Atanamaz`,
      email: email("notassign"),
      password: await hash("test123"),
      role: "EMPLOYEE",
      department: "OUTSOURCE",
      seniorityLevel: 8,
      canViewAllProjects: false,
      canBeAssignedTasks: false,
      overseesDepartment: null,
      canViewAllTasks: false,
    },
  });
  createdUserIds.push(notAssignableDb.id);
  notAssignable = {
    id: notAssignableDb.id,
    email: notAssignableDb.email,
    name: notAssignableDb.name,
    role: notAssignableDb.role,
    seniorityLevel: 8,
    canViewAllProjects: false,
    overseesDepartment: null,
  };

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
  vergiProj1Id = await mkProject(`${PREFIX} Vergi Proje 1`, "YMM", adminUser.id, [vergiUser.id]);
  vergiProj2Id = await mkProject(`${PREFIX} Vergi Proje 2`, "YMM", adminUser.id, [vergiUser.id]);

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
  // Önce tüm görevleri temizle (soft-delete edilenler dahil) — kullanıcı silmeden önce
  const allTaskIds = [...new Set([...createdTaskIds, ...softDeletedTaskIds])];
  if (allTaskIds.length > 0) {
    await prisma.taskLog.deleteMany({ where: { taskId: { in: allTaskIds } } });
    await prisma.task.deleteMany({ where: { id: { in: allTaskIds } } });
  }
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
  it("T1: BD üyesi 1 yalnızca kendine atanmış görevleri görür", async () => {
    asUser(bdUser1);
    const res = await tasksGET();
    expect(res.status).toBe(200);
    const tasks = await json(res);
    const ids = tasks.map((t: any) => t.id);
    expect(ids).toContain(task_bd1_user1);       // kendine atanmış
    expect(ids).toContain(task_bd2);              // kendine atanmış (farklı projede)
    expect(ids).not.toContain(task_bd1_user2);    // aynı projede ama başka üyenin görevi
    expect(ids).not.toContain(task_vergi1);        // Vergi projesinde değil
  });

  it("T2: BD üyesi 2 yalnızca kendine atanmış görevi görür", async () => {
    asUser(bdUser2);
    const res = await tasksGET();
    const tasks = await json(res);
    const ids = tasks.map((t: any) => t.id);
    expect(ids).toContain(task_bd1_user2);         // kendine atanmış
    expect(ids).not.toContain(task_bd1_user1);     // başka üyenin görevi
    expect(ids).not.toContain(task_bd2);           // BD Proje 2'ye atanmış ama başkasının görevi
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

  it("BD üyesi → kendi görevi → 200", async () => {
    asUser(bdUser2);
    const res = await taskByIdGET(fakeReq(), { params: { id: task_bd1_user2 } });
    expect(res.status).toBe(200);
    const task = await json(res);
    expect(task.id).toBe(task_bd1_user2);
  });
});

describe("T-A / T-B: Yeni görünürlük modeli — kişiye özgü erişim", () => {
  it("T-A: A üyesi, B üyesinin görevini ID ile çekemez → 404", async () => {
    // bdUser1, task_bd1_user2'yi göremez (task_bd1_user2 = bdUser2'ye atanmış)
    asUser(bdUser1);
    const res = await taskByIdGET(fakeReq(), { params: { id: task_bd1_user2 } });
    expect(res.status).toBe(404);
  });

  it("T-B: Proje kurucusu kendi departmanındaki projenin görevini görür → 200", async () => {
    // manager.dept=BAGIMSIZ_DENETIM, proje.dept=BAGIMSIZ_DENETIM → dept kapısı geçer.
    // Kural 7 (görevi oluşturan) veya Kural 8 (projeyi oluşturan) → canViewTask=true.
    const proj = await prisma.project.create({
      data: {
        name: `${PREFIX} Kurucu Görev Test`,
        department: "BAGIMSIZ_DENETIM",
        createdById: manager.id,
      },
    });
    createdProjectIds.push(proj.id);
    const task = await prisma.task.create({
      data: {
        title: `${PREFIX} Kurucu Görevi`,
        projectId: proj.id,
        assignedToId: bdUser1.id,
        createdById: manager.id,
        status: "TODO",
        priority: "MEDIUM",
      },
    });
    createdTaskIds.push(task.id);

    // manager (BAGIMSIZ_DENETIM dept, projeyi + görevi oluşturan) görevi görebilir
    asUser(manager);
    const res = await taskByIdGET(fakeReq(`http://localhost/api/tasks/${task.id}`), {
      params: { id: task.id },
    });
    expect(res.status).toBe(200);
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

  it("T8: İsmail Koş (canViewAllProjects=true) her iki birimin görevlerini GÖRÜR", async () => {
    // canViewAllProjects=true → departman kapısı uygulanmaz, tüm görevler görünür.
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
  it("T9: seniorityLevel < 8 proje oluşturamaz → 403", async () => {
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

  it("seniorityLevel >= 8 proje oluşturabilir → 201", async () => {
    asUser(manager); // level 8

    const postReq = new Request("http://localhost/api/projects", {
      method: "POST",
      body: JSON.stringify({ name: `${PREFIX} Manager Projesi`, department: "OUTSOURCE" }),
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
    expect(depts.has("YMM")).toBe(true);
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

describe("T12: Ebubekir istisna testi — overseesDept=YMM, canViewAllProjects=false", () => {
  it("Ebubekir (overseesDept=YMM) BD projesini göremez → 404", async () => {
    asUser(ebubekirTest); // level 9 ama canViewAllProjects=false, overseesDept=YMM
    const req = fakeReq(`http://localhost/api/projects/${bdProj1Id}`);
    const res = await projectByIdGET(req, { params: { id: bdProj1Id } });
    expect(res.status).toBe(404);
  });

  it("Ebubekir (overseesDept=YMM) BD görevlerini listede görmez", async () => {
    asUser(ebubekirTest);
    const res = await tasksGET();
    const tasks = await json(res);
    const ids = tasks.map((t: any) => t.id);
    expect(ids).not.toContain(task_bd1_user1);
    expect(ids).not.toContain(task_bd1_user2);
    expect(ids).not.toContain(task_bd2);
  });
});

describe("T13: canViewAllProjects=true → tüm departmanların görevlerini görür", () => {
  it("İsmail Koş (canViewAllProjects=true) BD/YMM görevlerini GÖRÜR", async () => {
    // canViewAllProjects=true → departman kapısı UYGULANMAZ → tüm görevler görünür
    asUser(ismailKos);
    const res = await tasksGET();
    const tasks = await json(res);
    const ids = tasks.map((t: any) => t.id);
    expect(ids).toContain(task_bd1_user1);
    expect(ids).toContain(task_vergi1);
  });

  it("Murat (canViewAllProjects=true) BD/YMM görevlerini GÖRÜR", async () => {
    // canViewAllProjects=true → departman kapısı UYGULANMAZ
    asUser(muratViewAll); // canViewAllProjects=true, overseesDepartment=null, dept=OUTSOURCE
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
      body: JSON.stringify({ name: `${PREFIX} AsstMgr Projesi`, department: "OUTSOURCE" }),
      headers: { "Content-Type": "application/json" },
    });
    const res = await projectsPOST(postReq as any);
    expect(res.status).toBe(403);
    // Proje oluşturulmamış olmalı
    const leaked = await prisma.project.findFirst({ where: { name: `${PREFIX} AsstMgr Projesi` } });
    expect(leaked).toBeNull();
  });

  it("T16: Manager 1 (level 8) proje oluşturabilir → 201", async () => {
    asUser(manager); // level 8
    const postReq = new Request("http://localhost/api/projects", {
      method: "POST",
      body: JSON.stringify({ name: `${PREFIX} Mgr1 Projesi`, department: "OUTSOURCE" }),
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

  it("T19: Aynı projedeki başka bir üye silemiyor → 403", async () => {
    // bdUser1: üye ama level 2 < 8 → canManageProject false → 403
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

    asUser(bdUser1); // üye ama level 2 < 8 → canManageProject false
    const req = fakeReq(`http://localhost/api/projects/${proj.id}`);
    const res = await projectDELETE(req, { params: { id: proj.id } });
    expect(res.status).toBe(403);

    // Proje silinmemiş olmalı
    const still = await prisma.project.findUnique({ where: { id: proj.id } });
    expect(still).not.toBeNull();
  });

  it("T20: Başka birimden bir kullanıcı silemiyor → 403", async () => {
    // vergiUser: level 1, üye değil, overseesDept=null → canManageProject false → 403
    const proj = await prisma.project.create({
      data: { name: `${PREFIX} Silme T20`, department: "BAGIMSIZ_DENETIM", createdById: manager.id },
    });
    createdProjectIds.push(proj.id);
    await prisma.projectMember.create({
      data: { projectId: proj.id, userId: manager.id, assignedBy: manager.id },
    });

    asUser(vergiUser); // YMM projesinde üye, BD projesinde değil, level 1 → canManageProject false
    const req = fakeReq(`http://localhost/api/projects/${proj.id}`);
    const res = await projectDELETE(req, { params: { id: proj.id } });
    expect(res.status).toBe(403);

    const still = await prisma.project.findUnique({ where: { id: proj.id } });
    expect(still).not.toBeNull();
  });

  it("T18: Aktif proje doğrudan silinemez — önce arşivlenmeli → 409", async () => {
    // Yeni lifecycle kuralı: DELETE yalnızca ARCHIVED projeler için çalışır
    const proj = await prisma.project.create({
      data: { name: `${PREFIX} Silme T18`, department: "BAGIMSIZ_DENETIM", createdById: manager.id },
    });
    createdProjectIds.push(proj.id);
    await prisma.projectMember.create({
      data: { projectId: proj.id, userId: manager.id, assignedBy: manager.id },
    });

    asUser(manager); // yönetim yetkisi var ama proje ACTIVE
    const req = fakeReq(`http://localhost/api/projects/${proj.id}`);
    const res = await projectDELETE(req, { params: { id: proj.id } });
    expect(res.status).toBe(409);

    // Proje silinmemiş olmalı
    const still = await prisma.project.findUnique({ where: { id: proj.id } });
    expect(still).not.toBeNull();
    expect(still?.deletedAt).toBeNull();
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

  it("YMM filtresi: BAGIMSIZ_DENETIM kadrosundan kimse dönmez", async () => {
    asUser(ismailKos);
    const req = new Request("http://localhost/api/users/assignable?projectDept=YMM");
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
    // OUTSOURCE bloklu
    expect(ids).not.toContain(outsider.id);
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

  it("İlgisiz üye (kurucu değil, gözetmen değil, admin değil) PATCH yapamaz → 403", async () => {
    // bdUser1, bdProj1Id'nin üyesi ama kurucusu adminUser; level 2 < 8 → canManageProject false → 403
    asUser(bdUser1);
    const req = new Request(`http://localhost/api/projects/${bdProj1Id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: `${PREFIX} Yasak Güncelleme` }),
    });
    const res = await projectPATCH(req as any, { params: { id: bdProj1Id } });
    expect(res.status).toBe(403);

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
      body: JSON.stringify({ name: proj.name, department: "YMM" }),
    });
    const res = await projectPATCH(req as any, { params: { id: proj.id } });
    // department alanı body'de gönderildiğinde 400 döner
    expect(res.status).toBe(400);
  });
});

describe("T17: Görev atama — kıdem kontrolü", () => {
  it("Senior 2 (level 3), Manager 1 (level 8) kişiye görev atayamaz → 403", async () => {
    asUser(senior2User); // seniorityLevel=3
    const postReq = new Request("http://localhost/api/tasks", {
      method: "POST",
      body: JSON.stringify({
        title: `${PREFIX} Kıdem Test Görevi`,
        assigneeIds: [manager.id], // manager seniorityLevel=8
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
        // getEligibleAssignees: projesiz görevde target görevin departmanında olmalı —
        // bdUser2 BAGIMSIZ_DENETIM'de, bu yüzden departmentId açıkça eşleştirilir.
        departmentId: "BAGIMSIZ_DENETIM",
        dueDate: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(),
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

// ── Proje içi görev atama — yeni testler ─────────────────────────────────────

describe("Proje içi görev atama — POST /api/tasks (projectId + yetki)", () => {
  const futureDate = () => new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString();

  it("Projeyi oluşturan kişi (manager), kendinden düşük kıdemli üyeye görev atayabilir → 201", async () => {
    const proj = await prisma.project.create({
      data: { name: `${PREFIX} Proje-Atama-201`, department: "BAGIMSIZ_DENETIM", createdById: manager.id },
    });
    createdProjectIds.push(proj.id);
    await prisma.projectMember.create({ data: { projectId: proj.id, userId: bdUser1.id, assignedBy: manager.id } });

    asUser(manager); // level 8, proje kurucusu
    const req = new Request("http://localhost/api/tasks", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        title: `${PREFIX} Atama 201 Görevi`,
        projectId: proj.id,
        assigneeIds: [bdUser1.id], // bdUser1 = level 2
        dueDate: futureDate(),
      }),
    });
    const res = await tasksPOST(req as any);
    expect(res.status).toBe(201);
    const data = await json(res);
    createdTaskIds.push(data.id);
    expect(data.assignedToId).toBe(bdUser1.id);
  });

  it("Eşit kıdemdeki kişiye atayamıyor → 403", async () => {
    // manager (level 8) eşit kıdemli bir kullanıcıya atama yapıyor
    const sameLevel = await prisma.user.create({
      data: {
        name: `${PREFIX} Eşit Kıdem`,
        email: email("eq-level"),
        password: await hash("test"),
        role: "EMPLOYEE",
        department: "OUTSOURCE",
        seniorityLevel: 8,
        canViewAllProjects: false,
        overseesDepartment: null,
        canViewAllTasks: false,
      },
    });
    createdUserIds.push(sameLevel.id);

    const proj = await prisma.project.create({
      data: { name: `${PREFIX} Proje-Atama-403`, department: "BAGIMSIZ_DENETIM", createdById: manager.id },
    });
    createdProjectIds.push(proj.id);

    asUser(manager); // level 8, sameLevel de level 8 → seniority eşit → 403
    const req = new Request("http://localhost/api/tasks", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        title: `${PREFIX} Eşit Kıdem Görevi`,
        projectId: proj.id,
        assigneeIds: [sameLevel.id],
        dueDate: futureDate(),
      }),
    });
    const res = await tasksPOST(req as any);
    expect(res.status).toBe(403);
    const leaked = await prisma.task.findFirst({ where: { title: `${PREFIX} Eşit Kıdem Görevi` } });
    expect(leaked).toBeNull();
  });

  it("Projeyle ilgisi olmayan biri bu projeye görev ekleyemiyor → 404", async () => {
    const proj = await prisma.project.create({
      data: { name: `${PREFIX} Proje-Atama-404`, department: "BAGIMSIZ_DENETIM", createdById: manager.id },
    });
    createdProjectIds.push(proj.id);

    // bdUser1: proje kurucusu değil, gözetmen değil, ADMIN değil, canViewAllProjects değil
    asUser(bdUser1); // level 2, bu projenin üyesi/kurucusu/gözetmeni değil
    const req = new Request("http://localhost/api/tasks", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        title: `${PREFIX} Yetkisiz Proje Görevi`,
        projectId: proj.id,
        assigneeIds: [bdUser2.id],
        dueDate: futureDate(),
      }),
    });
    const res = await tasksPOST(req as any);
    expect(res.status).toBe(404);
    const leaked = await prisma.task.findFirst({ where: { title: `${PREFIX} Yetkisiz Proje Görevi` } });
    expect(leaked).toBeNull();
  });

  it("dueDate boş gönderilirse görev oluşturulur → 201 (B Bloğu: dueDate opsiyonel)", async () => {
    asUser(manager); // seniority geçecek, dueDate yok ama artık zorunlu değil
    const req = new Request("http://localhost/api/tasks", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        title: `${PREFIX} DueDate Eksik`,
        assigneeIds: [bdUser1.id],
        // dueDate kasıtlı olarak yok — artık opsiyonel
      }),
    });
    const res = await tasksPOST(req as any);
    expect(res.status).toBe(201);
    const created = await prisma.task.findFirst({ where: { title: `${PREFIX} DueDate Eksik` } });
    expect(created).not.toBeNull();
    if (created) createdTaskIds.push(created.id);
  });
});

// ── ADMIN / canViewAll kıdem bypass regresyon testleri ────────────────────────

describe("ADMIN/canViewAll kıdem bypass — POST /api/tasks (projectId)", () => {
  const futureDate = () => new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString();

  it("ADMIN (seniorityLevel=0) → yüksek kıdemli üyeye (level 9) proje görevi atayabilir → 201", async () => {
    const proj = await prisma.project.create({
      data: { name: `${PREFIX} AdminBypass-201`, department: "BAGIMSIZ_DENETIM", createdById: adminLow.id },
    });
    createdProjectIds.push(proj.id);
    // getEligibleAssignees: projeli görevde target projenin aktif üyesi olmalı
    await prisma.projectMember.create({ data: { projectId: proj.id, userId: highTarget.id, assignedBy: adminLow.id } });

    asUser(adminLow); // role=ADMIN, seniorityLevel=0
    const req = new Request("http://localhost/api/tasks", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        title: `${PREFIX} AdminBypass Görevi`,
        projectId: proj.id,
        assigneeIds: [highTarget.id], // seniorityLevel=9 > 0 — kıdem bypass ile geçmeli
        dueDate: futureDate(),
      }),
    });
    const res = await tasksPOST(req as any);
    expect(res.status).toBe(201);
    const data = await res.json();
    createdTaskIds.push(data.id);
  });

  it("canViewAllProjects=true (seniorityLevel=0) → yüksek kıdemli üyeye proje görevi atayabilir → 201", async () => {
    const proj = await prisma.project.create({
      data: { name: `${PREFIX} ViewAllBypass-201`, department: "BAGIMSIZ_DENETIM", createdById: canViewAllLow.id },
    });
    createdProjectIds.push(proj.id);
    // getEligibleAssignees: projeli görevde target projenin aktif üyesi olmalı
    await prisma.projectMember.create({ data: { projectId: proj.id, userId: highTarget.id, assignedBy: canViewAllLow.id } });

    asUser(canViewAllLow); // canViewAllProjects=true, seniorityLevel=0
    const req = new Request("http://localhost/api/tasks", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        title: `${PREFIX} ViewAllBypass Görevi`,
        projectId: proj.id,
        assigneeIds: [highTarget.id], // seniorityLevel=9 > 0 — kıdem bypass ile geçmeli
        dueDate: futureDate(),
      }),
    });
    const res = await tasksPOST(req as any);
    expect(res.status).toBe(201);
    const data = await res.json();
    createdTaskIds.push(data.id);
  });

  it("Regresyon — overseer (level 8) → daha yüksek kıdemliye (level 9) atayamaz → 403", async () => {
    // ahmetOruc: overseesDept=BAGIMSIZ_DENETIM, seniorityLevel=8
    // highTarget: seniorityLevel=9 → kıdem koşulu başarısız (8 > 9 = false)
    const proj = await prisma.project.create({
      data: { name: `${PREFIX} OverseerSeniority-403`, department: "BAGIMSIZ_DENETIM", createdById: manager.id },
    });
    createdProjectIds.push(proj.id);

    asUser(ahmetOruc); // level=8, overseer BD
    const req = new Request("http://localhost/api/tasks", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        title: `${PREFIX} Overseer Kıdem 403`,
        projectId: proj.id,
        assigneeIds: [highTarget.id], // seniorityLevel=9 — kıdem yetersiz
        dueDate: futureDate(),
      }),
    });
    const res = await tasksPOST(req as any);
    expect(res.status).toBe(403);
    const leaked = await prisma.task.findFirst({ where: { title: `${PREFIX} Overseer Kıdem 403` } });
    expect(leaked).toBeNull();
  });

  it("Regresyon — kurucu (level 8) → daha yüksek kıdemliye (level 9) atayamaz → 403", async () => {
    // manager: seniorityLevel=5, proje kurucusu
    // highTarget: seniorityLevel=9 → kıdem koşulu başarısız (5 > 9 = false)
    const proj = await prisma.project.create({
      data: { name: `${PREFIX} CreatorSeniority-403`, department: "BAGIMSIZ_DENETIM", createdById: manager.id },
    });
    createdProjectIds.push(proj.id);

    asUser(manager); // level=8, proje kurucusu
    const req = new Request("http://localhost/api/tasks", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        title: `${PREFIX} Kurucu Kıdem 403`,
        projectId: proj.id,
        assigneeIds: [highTarget.id], // seniorityLevel=9 — kıdem yetersiz
        dueDate: futureDate(),
      }),
    });
    const res = await tasksPOST(req as any);
    expect(res.status).toBe(403);
    const leaked = await prisma.task.findFirst({ where: { title: `${PREFIX} Kurucu Kıdem 403` } });
    expect(leaked).toBeNull();
  });
});

// ── canBeAssignedTasks testleri ───────────────────────────────────────────────

describe("canBeAssignedTasks — görev atama engeli", () => {
  const futureDate = () => new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString();

  it("ADMIN, canBeAssignedTasks=false olan kişiye görev atayamıyor → 403", async () => {
    const proj = await prisma.project.create({
      data: { name: `${PREFIX} NotAssign-Admin`, department: "BAGIMSIZ_DENETIM", createdById: adminLow.id },
    });
    createdProjectIds.push(proj.id);

    asUser(adminLow); // role=ADMIN
    const req = new Request("http://localhost/api/tasks", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        title: `${PREFIX} Admin→Atanamaz`,
        projectId: proj.id,
        assigneeIds: [notAssignable.id], // canBeAssignedTasks=false
        dueDate: futureDate(),
      }),
    });
    const res = await tasksPOST(req as any);
    expect(res.status).toBe(403);
    const leaked = await prisma.task.findFirst({ where: { title: `${PREFIX} Admin→Atanamaz` } });
    expect(leaked).toBeNull();
  });

  it("/api/users/assignable yanıtında canBeAssignedTasks=false kullanıcı dönmüyor", async () => {
    asUser(ismailKos); // canViewAllProjects=true → tüm kıdemlileri görebilir
    const req = new Request("http://localhost/api/users/assignable");
    const res = await assignableGET(req as any);
    expect(res.status).toBe(200);
    const users = await json(res);
    const ids = users.map((u: any) => u.id);
    expect(ids).not.toContain(notAssignable.id); // canBeAssignedTasks=false → listede olmamalı
  });

  it("canBeAssignedTasks=false olan kişi, başkasına görev atayabiliyor → 201", async () => {
    // notAssignable (level=8, dept=OUTSOURCE), bdUser1 (level=2, dept=BAGIMSIZ_DENETIM)'e atıyor — ATAYAN olarak geçerli
    asUser(notAssignable);
    const req = new Request("http://localhost/api/tasks", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        title: `${PREFIX} Atanamaz Atayan 201`,
        assigneeIds: [bdUser1.id], // bdUser1 level=2, canBeAssignedTasks=true
        // getEligibleAssignees: projesiz görevde target görevin departmanında olmalı —
        // bdUser1 BAGIMSIZ_DENETIM'de, notAssignable ise OUTSOURCE'ta; departmentId açıkça eşleştirilir.
        departmentId: "BAGIMSIZ_DENETIM",
        dueDate: futureDate(),
      }),
    });
    const res = await tasksPOST(req as any);
    expect(res.status).toBe(201);
    const data = await res.json();
    createdTaskIds.push(data.id);
  });
});

// ── ASSIGN_EXCEPTIONS — Murat Özgür özel atama istisnası ──────────────────────
//
// Bu testler gerçek e-posta adreslerine dayanır (muratozgur@, ebubekirozturk@).
// Kullanıcılar seed ile oluşturulmuş olmalıdır; yoksa test içinde oluşturulur.
// Seed çalıştırılmamışsa upsert ile doğru konfigürasyonda oluşturulur.

describe("ASSIGN_EXCEPTIONS — Murat Özgür özel atama istisnası", () => {
  const futureDate = () => new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString();

  let muratReal: TestUser;
  let ebubekirReal: TestUser;
  let exceptionProjId: string;

  beforeAll(async () => {
    // ── Murat Özgür: ASSIGN_EXCEPTIONS atayan ────────────────────────────
    // Seed çalışmamış olabilir; upsert ile gereken konfigürasyonu garantile.
    // update bloğu: DB'yi test için gereken değerlere çeker (canViewAllProjects=false, overseesDeptment=YMM).
    const muratDb = await prisma.user.upsert({
      where: { email: "muratozgur@vezin.com.tr" },
      update: { canViewAllProjects: false, overseesDepartment: "YMM", canBeAssignedTasks: false, canViewAllTasks: true, seniorityLevel: 14 },
      create: {
        name: "Murat Özgür", email: "muratozgur@vezin.com.tr",
        password: await hash("test"), role: "EMPLOYEE",
        department: "YEMINLI_MALI_MUSAVIR", seniorityLevel: 14,
        canViewAllProjects: false, overseesDepartment: "YMM",
        canBeAssignedTasks: false, canViewAllTasks: true,
      },
      select: { id: true, email: true, name: true, role: true, seniorityLevel: true, canViewAllProjects: true, overseesDepartment: true },
    });
    muratReal = {
      id: muratDb.id, email: muratDb.email, name: muratDb.name,
      role: muratDb.role, seniorityLevel: muratDb.seniorityLevel,
      canViewAllProjects: muratDb.canViewAllProjects,
      overseesDepartment: muratDb.overseesDepartment,
    };

    // ── Ebubekir Öztürk: canBeAssignedTasks=false, ASSIGN_EXCEPTIONS hedefi ──
    const ebubekirDb = await prisma.user.upsert({
      where: { email: "ebubekirozturk@vezin.com.tr" },
      update: { canBeAssignedTasks: false, seniorityLevel: 12, canViewAllProjects: false, overseesDepartment: "YMM" },
      create: {
        name: "Ebubekir Öztürk", email: "ebubekirozturk@vezin.com.tr",
        password: await hash("test"), role: "EMPLOYEE",
        department: "YEMINLI_MALI_MUSAVIR", seniorityLevel: 12,
        canViewAllProjects: false, overseesDepartment: "YMM",
        canBeAssignedTasks: false,
      },
      select: { id: true, email: true, name: true, role: true, seniorityLevel: true, canViewAllProjects: true, overseesDepartment: true },
    });
    ebubekirReal = {
      id: ebubekirDb.id, email: ebubekirDb.email, name: ebubekirDb.name,
      role: ebubekirDb.role, seniorityLevel: ebubekirDb.seniorityLevel,
      canViewAllProjects: ebubekirDb.canViewAllProjects,
      overseesDepartment: ebubekirDb.overseesDepartment,
    };

    // YMM projesi — Murat atayan/kurucu olarak
    const proj = await prisma.project.create({
      data: { name: `${PREFIX} Exception Proje`, department: "YMM", createdById: muratReal.id },
    });
    exceptionProjId = proj.id;
    createdProjectIds.push(proj.id);

    // getEligibleAssignees: projeli görevde target projenin aktif üyesi olmalı —
    // ASSIGN_EXCEPTIONS yalnızca canBeAssignedTasks kuralını atlar, üyelik kuralını atlamaz.
    await prisma.projectMember.create({
      data: { projectId: exceptionProjId, userId: ebubekirReal.id, assignedBy: muratReal.id },
    });
  });

  afterAll(async () => {
    // Proje ve görevler ana afterAll tarafından temizlenir.
    // Murat ve Ebubekir gerçek seeded kullanıcılar olduğundan silinmez.
  });

  it("TE1: Murat Özgür → Ebubekir'e proje görevi atayabiliyor → 201", async () => {
    asUser({ ...muratReal, canViewAllProjects: false, overseesDepartment: "YMM" } as TestUser);
    const req = new Request("http://localhost/api/tasks", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        title: `${PREFIX} Murat→Ebubekir Görev`,
        projectId: exceptionProjId,
        assigneeIds: [ebubekirReal.id],
        dueDate: futureDate(),
      }),
    });
    const res = await tasksPOST(req as any);
    expect(res.status).toBe(201);
    const data = await res.json();
    createdTaskIds.push(data.id);
  });

  it("TE2: İsmail Koş (ASSIGN_EXCEPTIONS dışı, canViewAllProjects=true) → Ebubekir'e görev atayamıyor → 403", async () => {
    // ismailKos: canViewAllProjects=true → authority geçer
    // ama "ismailkos@vezin.com.tr" ASSIGN_EXCEPTIONS'da YOK → canBeAssignedTasks=false engeller
    // Gerçek İsmail (ismailkos@vezin.com.tr) yerine aynı davranışı sergileyen
    // test kullanıcısı ismailKos kullanılır (email PREFIX tabanlı, exceptions'da yok)
    asUser(ismailKos); // canViewAllProjects=true, email → exceptions boş
    const req = new Request("http://localhost/api/tasks", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        title: `${PREFIX} İsmail→Ebubekir Görev`,
        projectId: exceptionProjId,
        assigneeIds: [ebubekirReal.id],
        dueDate: futureDate(),
      }),
    });
    const res = await tasksPOST(req as any);
    expect(res.status).toBe(403);
    const leaked = await prisma.task.findFirst({ where: { title: `${PREFIX} İsmail→Ebubekir Görev` } });
    expect(leaked).toBeNull();
  });

  it("TE3: Murat Özgür (canViewAllProjects=false, overseesDept=VERGI) BD projesini göremiyor → 404", async () => {
    asUser({ ...muratReal, canViewAllProjects: false, overseesDepartment: "YMM" } as TestUser);
    const req = fakeReq(`http://localhost/api/projects/${bdProj1Id}`);
    const res = await projectByIdGET(req, { params: { id: bdProj1Id } });
    expect(res.status).toBe(404);
  });

  it("TE4: Göç sonrası 'Manager 1' unvanlı kullanıcının seniorityLevel'ı 8", async () => {
    // Göç öncesi durumu simüle et: title='Manager 1', seniorityLevel=0
    const u = await prisma.user.create({
      data: {
        name: `${PREFIX} Manager1 Göç Test`,
        email: email("mgr1-migtest"),
        password: await hash("test"),
        role: "EMPLOYEE",
        department: "OUTSOURCE",
        title: "Manager 1",
        seniorityLevel: 0,
      },
    });
    createdUserIds.push(u.id);

    // Migration SQL'deki UPDATE'i doğrudan uygula
    await prisma.$executeRaw`UPDATE "User" SET "title" = 'Manager 1', "seniorityLevel" = 8 WHERE "title" = 'Manager 1' AND "id" = ${u.id}`;

    const updated = await prisma.user.findUnique({ where: { id: u.id } });
    expect(updated?.title).toBe("Manager 1");
    expect(updated?.seniorityLevel).toBe(8);
  });
});

// ── endDate doğrulama testleri ────────────────────────────────────────────────

describe("Proje endDate doğrulama — POST /api/projects", () => {
  it("endDate < startDate ise proje oluşturulamaz → 400", async () => {
    asUser(manager); // level=8, proje oluşturabilir
    const postReq = new Request("http://localhost/api/projects", {
      method: "POST",
      body: JSON.stringify({
        name: `${PREFIX} EndDate Hatalı`,
        department: "BAGIMSIZ_DENETIM",
        startDate: "2026-09-10",
        endDate: "2026-09-01", // bitiş başlangıçtan önce → hata
      }),
      headers: { "Content-Type": "application/json" },
    });
    const res = await projectsPOST(postReq as any);
    expect(res.status).toBe(400);
    const leaked = await prisma.project.findFirst({ where: { name: `${PREFIX} EndDate Hatalı` } });
    expect(leaked).toBeNull();
  });

  it("endDate >= startDate ise proje oluşturulur → 201", async () => {
    asUser(manager);
    const postReq = new Request("http://localhost/api/projects", {
      method: "POST",
      body: JSON.stringify({
        name: `${PREFIX} EndDate Geçerli`,
        department: "BAGIMSIZ_DENETIM",
        startDate: "2026-09-01",
        endDate: "2026-12-31",
      }),
      headers: { "Content-Type": "application/json" },
    });
    const res = await projectsPOST(postReq as any);
    expect(res.status).toBe(201);
    const data = await res.json();
    createdProjectIds.push(data.id);
    await prisma.projectMember.deleteMany({ where: { projectId: data.id } });
    await prisma.project.delete({ where: { id: data.id } });
    createdProjectIds.pop();
  });
});

// ── canDeleteTask — görev silme yetkisi ──────────────────────────────────────

describe("Görev silme yetkisi — DELETE /api/tasks/[id]", () => {
  let delProj: string;
  let task_creator: string;  // created by manager, assigned to bdUser1
  let task_projcreator: string; // created by adminLow, assigned to bdUser2, proj by manager

  beforeAll(async () => {
    const proj = await prisma.project.create({
      data: { name: `${PREFIX} Del Yetki Projesi`, department: "BAGIMSIZ_DENETIM", createdById: manager.id },
    });
    createdProjectIds.push(proj.id);
    delProj = proj.id;

    const t1 = await prisma.task.create({
      data: {
        title: `${PREFIX} Del Kurucu Görevi`,
        projectId: delProj,
        assignedToId: bdUser1.id,
        createdById: manager.id,
        status: "TODO",
        priority: "MEDIUM",
      },
    });
    createdTaskIds.push(t1.id);
    task_creator = t1.id;

    const t2 = await prisma.task.create({
      data: {
        title: `${PREFIX} Del ProjKurucu Görevi`,
        projectId: delProj,
        assignedToId: bdUser2.id,
        createdById: adminLow.id,
        status: "TODO",
        priority: "MEDIUM",
      },
    });
    createdTaskIds.push(t2.id);
    task_projcreator = t2.id;
  });

  it("TD1: Görevi oluşturan kişi silebilir → 200", async () => {
    asUser(manager); // manager created task_creator
    const req = fakeReq(`http://localhost/api/tasks/${task_creator}`);
    const res = await tasksDELETE(req, { params: { id: task_creator } });
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.ok).toBe(true);
    // C BLOĞU: soft-delete — task hâlâ DB'de ama deletedAt set
    const gone = await prisma.task.findUnique({ where: { id: task_creator }, select: { deletedAt: true } });
    expect(gone?.deletedAt).not.toBeNull();
    softDeletedTaskIds.push(task_creator);
    const idx = createdTaskIds.indexOf(task_creator);
    if (idx > -1) createdTaskIds.splice(idx, 1);
  });

  it("TD2: Göreve atanan kişi silemez → 404", async () => {
    // task_projcreator assigned to bdUser2
    asUser(bdUser2);
    const req = fakeReq(`http://localhost/api/tasks/${task_projcreator}`);
    const res = await tasksDELETE(req, { params: { id: task_projcreator } });
    expect(res.status).toBe(404);
    const still = await prisma.task.findUnique({ where: { id: task_projcreator } });
    expect(still).not.toBeNull();
  });

  it("TD3: Projeyi oluşturan kişi silebilir → 200", async () => {
    // task_projcreator: proj by manager, task by adminLow, assigned to bdUser2
    asUser(manager); // project creator
    const req = fakeReq(`http://localhost/api/tasks/${task_projcreator}`);
    const res = await tasksDELETE(req, { params: { id: task_projcreator } });
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.ok).toBe(true);
    // C BLOĞU: soft-delete
    const gone = await prisma.task.findUnique({ where: { id: task_projcreator }, select: { deletedAt: true } });
    expect(gone?.deletedAt).not.toBeNull();
    softDeletedTaskIds.push(task_projcreator);
    const idx = createdTaskIds.indexOf(task_projcreator);
    if (idx > -1) createdTaskIds.splice(idx, 1);
  });

  it("TD4: Gözetmen (kendi birimi BD) BD görevi silebilir → 200", async () => {
    const t = await prisma.task.create({
      data: {
        title: `${PREFIX} Del Overseer Görevi`,
        projectId: delProj,
        assignedToId: bdUser1.id,
        createdById: adminLow.id,
        status: "TODO",
        priority: "MEDIUM",
      },
    });
    asUser(ahmetOruc); // overseesDept=BAGIMSIZ_DENETIM, not the assignee
    const req = fakeReq(`http://localhost/api/tasks/${t.id}`);
    const res = await tasksDELETE(req, { params: { id: t.id } });
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.ok).toBe(true);
    // C BLOĞU: soft-delete
    const gone = await prisma.task.findUnique({ where: { id: t.id }, select: { deletedAt: true } });
    expect(gone?.deletedAt).not.toBeNull();
    softDeletedTaskIds.push(t.id);
  });

  it("TD5: ADMIN silebilir → 200", async () => {
    const t = await prisma.task.create({
      data: {
        title: `${PREFIX} Del Admin Görevi`,
        projectId: delProj,
        assignedToId: bdUser1.id,
        createdById: manager.id,
        status: "TODO",
        priority: "MEDIUM",
      },
    });
    asUser(adminLow); // role=ADMIN, not the assignee
    const req = fakeReq(`http://localhost/api/tasks/${t.id}`);
    const res = await tasksDELETE(req, { params: { id: t.id } });
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.ok).toBe(true);
    // C BLOĞU: soft-delete
    const gone = await prisma.task.findUnique({ where: { id: t.id }, select: { deletedAt: true } });
    expect(gone?.deletedAt).not.toBeNull();
    softDeletedTaskIds.push(t.id);
  });
});

// ── Yeni senaryolar (YMM + lifecycle) ─────────────────────────────────────────

describe("Çakışan proje adı — POST /api/projects → 409", () => {
  it("Aynı departmanda aynı isimde ikinci proje oluşturulamaz", async () => {
    asUser(manager); // level 8, dept OUTSOURCE → auto-assigned
    const name = `${PREFIX} Çakışan Proje Adı`;
    const mkReq = () =>
      new Request("http://localhost/api/projects", {
        method: "POST",
        body: JSON.stringify({ name }),
        headers: { "Content-Type": "application/json" },
      });

    const first = await projectsPOST(mkReq() as any);
    expect(first.status).toBe(201);
    const data = await first.json();
    createdProjectIds.push(data.id);

    const second = await projectsPOST(mkReq() as any);
    expect(second.status).toBe(409);
  });
});

describe("Açık görevli üye kaldırma — POST /api/projects/[id]/members → 409", () => {
  it("Açık görevi olan üye projeden çıkarılamaz", async () => {
    const proj = await prisma.project.create({
      data: { name: `${PREFIX} OpenTask Member`, department: "OUTSOURCE", createdById: manager.id },
    });
    createdProjectIds.push(proj.id);
    await prisma.projectMember.createMany({
      data: [
        { projectId: proj.id, userId: manager.id, assignedBy: manager.id },
        { projectId: proj.id, userId: junior.id, assignedBy: manager.id },
      ],
    });
    const openTask = await prisma.task.create({
      data: {
        title: `${PREFIX} Açık Görev Üye`,
        projectId: proj.id,
        assignedToId: junior.id,
        createdById: manager.id,
        status: "TODO",
        priority: "MEDIUM",
      },
    });
    createdTaskIds.push(openTask.id);

    asUser(manager);
    const req = new Request(`http://localhost/api/projects/${proj.id}/members`, {
      method: "POST",
      body: JSON.stringify({ removeUserIds: [junior.id] }),
      headers: { "Content-Type": "application/json" },
    });
    const res = await projectMembersPOST(req as any, { params: { id: proj.id } });
    expect(res.status).toBe(409);

    const member = await prisma.projectMember.findFirst({
      where: { projectId: proj.id, userId: junior.id },
    });
    expect(member).not.toBeNull();
  });
});

describe("Açık görev incelemesinden sorumlu üye projeden çıkarılamaz (D BLOĞU)", () => {
  it("reviewOwner olan ama assignedToId olmayan üye çıkarılamaz → 409", async () => {
    const proj = await prisma.project.create({
      data: { name: `${PREFIX} ReviewOwner Member`, department: "OUTSOURCE", createdById: manager.id },
    });
    createdProjectIds.push(proj.id);
    await prisma.projectMember.createMany({
      data: [
        { projectId: proj.id, userId: manager.id, assignedBy: manager.id },
        { projectId: proj.id, userId: junior.id, assignedBy: manager.id },
      ],
    });
    const openTask = await prisma.task.create({
      data: {
        title: `${PREFIX} Review Owner Açık Görev`,
        projectId: proj.id,
        assignedToId: junior.id,
        createdById: manager.id,
        reviewOwnerId: manager.id,
        status: "IN_PROGRESS",
        priority: "MEDIUM",
      },
    });
    createdTaskIds.push(openTask.id);

    asUser(manager);
    const req = new Request(`http://localhost/api/projects/${proj.id}/members`, {
      method: "POST",
      body: JSON.stringify({ removeUserIds: [manager.id] }),
      headers: { "Content-Type": "application/json" },
    });
    const res = await projectMembersPOST(req as any, { params: { id: proj.id } });
    expect(res.status).toBe(409);

    const member = await prisma.projectMember.findFirst({
      where: { projectId: proj.id, userId: manager.id },
    });
    expect(member).not.toBeNull();
  });
});

describe("Açık görevli projeyi tamamlama — POST /api/projects/[id]/status → 409", () => {
  it("Tamamlanmamış görev varken proje DONE yapılamaz", async () => {
    const proj = await prisma.project.create({
      data: { name: `${PREFIX} OpenTask Complete`, department: "OUTSOURCE", createdById: manager.id },
    });
    createdProjectIds.push(proj.id);
    await prisma.projectMember.create({
      data: { projectId: proj.id, userId: manager.id, assignedBy: manager.id },
    });
    const openTask = await prisma.task.create({
      data: {
        title: `${PREFIX} Bitmemiş Görev`,
        projectId: proj.id,
        assignedToId: manager.id,
        createdById: manager.id,
        status: "TODO",
        priority: "MEDIUM",
      },
    });
    createdTaskIds.push(openTask.id);

    asUser(manager);
    const req = new Request(`http://localhost/api/projects/${proj.id}/status`, {
      method: "POST",
      body: JSON.stringify({ action: "complete" }),
      headers: { "Content-Type": "application/json" },
    });
    const res = await projectStatusPOST(req as any, { params: { id: proj.id } });
    expect(res.status).toBe(409);

    const still = await prisma.project.findUnique({ where: { id: proj.id } });
    expect(still?.status).toBe("ACTIVE");
  });
});

describe("Senior Manager — üyelik olmadan departman görünürlüğü", () => {
  let seniorMgr: TestUser;

  beforeAll(async () => {
    const u = await prisma.user.create({
      data: {
        name: `${PREFIX} Senior Mgr BD`,
        email: email("sr-mgr-bd"),
        password: await hash("test123"),
        role: "EMPLOYEE",
        department: "BAGIMSIZ_DENETIM",
        seniorityLevel: 11,
        canViewAllProjects: false,
        overseesDepartment: null,
        canViewAllTasks: false,
      },
    });
    createdUserIds.push(u.id);
    seniorMgr = {
      id: u.id, email: u.email, name: u.name, role: u.role,
      seniorityLevel: 11, canViewAllProjects: false, overseesDepartment: null,
      department: "BAGIMSIZ_DENETIM",
    };
  });

  it("Senior Manager 1 (BD dept), üye olmadan BD projesini görebilir → 200", async () => {
    asUser(seniorMgr); // seniorityLevel=11, dept=BAGIMSIZ_DENETIM
    const req = fakeReq(`http://localhost/api/projects/${bdProj1Id}`);
    const res = await projectByIdGET(req, { params: { id: bdProj1Id } });
    expect(res.status).toBe(200);
    const data = await json(res);
    expect(data.department).toBe("BAGIMSIZ_DENETIM");
  });

  it("Senior Manager 1 (BD dept) proje listesinde BD projelerini görür", async () => {
    asUser(seniorMgr);
    const req = new Request("http://localhost/api/projects?status=ACTIVE");
    const res = await projectsGET(req as any);
    expect(res.status).toBe(200);
    const projects = await json(res);
    const testBdProjs = projects.filter(
      (p: any) => p.name.startsWith(PREFIX) && p.department === "BAGIMSIZ_DENETIM"
    );
    expect(testBdProjs.length).toBeGreaterThan(0);
  });
});

describe("Manager 1 — üyelik olmadan proje göremez → 404", () => {
  it("Manager 1 (level 8), üye olmadığı projeyi göremez", async () => {
    // manager (level 8, dept OUTSOURCE) is NOT a member of bdProj1Id
    asUser(manager);
    const req = fakeReq(`http://localhost/api/projects/${bdProj1Id}`);
    const res = await projectByIdGET(req, { params: { id: bdProj1Id } });
    expect(res.status).toBe(404);
  });
});
