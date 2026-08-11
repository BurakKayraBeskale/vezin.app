/**
 * Proje görünürlüğü entegrasyon testleri — proje üyeliği modeli
 *
 * Gerçek Prisma (dev.db) ve gerçek route handler'ları kullanır.
 * next-auth session/token katmanı mock'lanır; geri kalan her şey gerçek.
 *
 * Senaryolar:
 *   T1  BD projesinin üyesi, aynı projedeki TÜM görevleri görür (kendi + diğer üyenin)
 *   T2  BD üyesi, yalnızca üyesi olduğu projenin görevlerini görür (diğer BD projesini değil)
 *   T3  BD üyesi, Vergi projesinin görevlerini API'de GÖRMEZ
 *   T4  Vergi üyesi, BD görevlerini GÖRMEZ
 *   T5  Proje dışı kullanıcı → hiçbir görev göremez
 *   T5b Proje dışı kullanıcı → görev ID'sine GET → 404
 *   T6  Ahmet Oruç (overseesDept=BAGIMSIZ_DENETIM) → tüm BD görevlerini görür, Vergi'yi GÖRMEZ
 *   T7  Murat Özgür (overseesDept=VERGI) → tüm Vergi görevlerini görür, BD'yi GÖRMEZ
 *   T8  İsmail Koş (canViewAllProjects) → her iki birimin görevlerini de görür
 *   T9  seniorityLevel < 5 → POST /api/projects → 403
 *   T10 level 2 → level 4'e üye ekleme → 403
 */

import { describe, it, expect, beforeAll, afterAll, vi } from "vitest";
import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";

// ── next-auth mock'ları ─────────────────────────────────────────────────────
vi.mock("next-auth", () => ({ getServerSession: vi.fn() }));
vi.mock("next-auth/jwt", () => ({ getToken: vi.fn() }));

import { GET as tasksGET } from "../../app/api/tasks/route";
import { GET as taskByIdGET } from "../../app/api/tasks/[id]/route";
import { GET as projectsGET, POST as projectsPOST } from "../../app/api/projects/route";
import { POST as projectMembersPOST } from "../../app/api/projects/[id]/members/route";
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

let bdUser1: TestUser;  // BD projesinin üyesi
let bdUser2: TestUser;  // Aynı BD projesinin üyesi
let vergiUser: TestUser; // Vergi projesinin üyesi
let outsider: TestUser;  // Hiçbir projeye üye değil
let ahmetOruc: TestUser; // overseesDepartment = BAGIMSIZ_DENETIM
let muratOzgur: TestUser; // overseesDepartment = VERGI
let ismailKos: TestUser;  // canViewAllProjects = true
let manager: TestUser;    // seniorityLevel = 5, proje oluşturabilir
let junior: TestUser;     // seniorityLevel = 2, proje oluşturamaz
let midLevel: TestUser;   // seniorityLevel = 4, üye olunabilir ama junior (2) ekleyemez

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
  bdUser1    = await mkUser("bd1", 2, false, null, `${PREFIX} BD Üye 1`);
  bdUser2    = await mkUser("bd2", 1, false, null, `${PREFIX} BD Üye 2`);
  vergiUser  = await mkUser("vg1", 1, false, null, `${PREFIX} Vergi Üye`);
  outsider   = await mkUser("out", 0, false, null, `${PREFIX} Dışarıdan`);
  ahmetOruc  = await mkUser("ahmet", 8, false, "BAGIMSIZ_DENETIM", `${PREFIX} Ahmet Oruç`);
  muratOzgur = await mkUser("murat", 100, false, "VERGI", `${PREFIX} Murat Özgür`);
  ismailKos  = await mkUser("ismail", 100, true, null, `${PREFIX} İsmail Koş`);
  manager    = await mkUser("mgr", 5, false, null, `${PREFIX} Müdür`);
  junior     = await mkUser("jnr", 2, false, null, `${PREFIX} Junior`);
  midLevel   = await mkUser("mid", 4, false, null, `${PREFIX} MidLevel`);

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
      data: memberIds.map((uid) => ({ projectId: p.id, userId: uid, assignedBy: createdById })),
      skipDuplicates: true,
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
