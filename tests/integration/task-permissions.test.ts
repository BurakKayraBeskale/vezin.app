/**
 * Görev permission sistemi entegrasyon testleri — 10 senaryo
 *
 * lib/task-permissions.ts içindeki 9-kural sistemini uçtan uca test eder.
 * Gerçek Prisma (dev.db) ve gerçek route handler'ları kullanır.
 * next-auth session/token katmanı mock'lanır.
 *
 * Test senaryoları:
 *   TP1  Silinmiş görev → kimse göremez (GET 200 ama listede yok, GET by-id 404)
 *   TP2  ADMIN → çapraz departman görevi görür (dept kapısı atlanır)
 *   TP3  canViewAllProjects=true → çapraz departman görevi görür (dept kapısı atlanır)
 *   TP4  Dept mismatch → dept kapısı engeller (listede yok, by-id 404)
 *   TP5  overseesDepartment eşleşmesi → dept kapısını geçer, tüm dept görevlerini görür
 *   TP6  overseesDepartment başka dept → farklı dept görevini göremez
 *   TP7  seniorityLevel >= 11, aynı dept → aynı deptteki tüm görevleri görür
 *   TP8  seniorityLevel < 11, assignedToId = userId → kendi görevini görür
 *   TP9  createdById = userId, aynı dept → oluşturduğu görevi görür
 *   TP10 projectCreatedById = userId, aynı dept → projenin başka kullanıcıya ait görevini görür
 */

import { describe, it, expect, beforeAll, afterAll, vi } from "vitest";
import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";

vi.mock("next-auth", () => ({ getServerSession: vi.fn() }));
vi.mock("next-auth/jwt", () => ({ getToken: vi.fn() }));

import { GET as tasksGET } from "../../app/api/tasks/route";
import { GET as taskByIdGET } from "../../app/api/tasks/[id]/route";
import { getServerSession } from "next-auth";
import { getToken } from "next-auth/jwt";

const prisma = new PrismaClient();
const hash = (pw: string) => bcrypt.hash(pw, 10);
const PREFIX = `test-tp-${Date.now()}`;
const email = (slug: string) => `${PREFIX}-${slug}@tp.test`;

type TUser = {
  id: string;
  email: string;
  name: string;
  role: string;
  department: string;
  seniorityLevel: number;
  canViewAllProjects: boolean;
  overseesDepartment: string | null;
};

function asUser(u: TUser) {
  const token = {
    id: u.id, name: u.name, email: u.email, role: u.role,
    department: u.department, seniorityLevel: u.seniorityLevel,
    canViewAllProjects: u.canViewAllProjects, canViewAllTasks: false,
    overseesDepartment: u.overseesDepartment,
  };
  const session = { user: token, expires: new Date(Date.now() + 86_400_000).toISOString() };
  vi.mocked(getServerSession).mockResolvedValue(session as any);
  vi.mocked(getToken).mockResolvedValue(token as any);
}

function fakeReq(url = "http://localhost/api/tasks"): any {
  return new Request(url);
}

async function json(res: Response) { return res.json(); }

// ── Test kullanıcıları ───────────────────────────────────────────────────────

let adminUser: TUser;        // role=ADMIN, dept=ADMIN          → TP2
let cvapUser: TUser;         // canViewAllProjects=true, OUTSOURCE → TP3
let bdUser: TUser;           // dept=BAGIMSIZ_DENETIM, level=2   → TP4,TP8,TP9
let outsideUser: TUser;      // dept=OUTSOURCE, level=2          → TP4 (dept mismatch)
let overseerBD: TUser;       // overseesDepartment=BAGIMSIZ_DENETIM → TP5,TP6
let seniorMgrBD: TUser;      // dept=BAGIMSIZ_DENETIM, level=11  → TP7
let projCreator: TUser;      // dept=BAGIMSIZ_DENETIM, level=8   → TP10

// ── Projeler & Görevler ──────────────────────────────────────────────────────

let bdProjId: string;         // BAGIMSIZ_DENETIM projesi
let ymmProjId: string;        // YMM projesi (farklı dept)
let task_bd_assigned: string; // BD projesi, bdUser'a atanmış, projCreator oluşturmadı
let task_bd_created: string;  // BD projesi, outsideUser'a atanmış, bdUser oluşturdu
let task_bd_projcreator: string; // BD projesi, bdUser'a atanmış, projCreator oluşturdu
let task_bd_reviewer: string; // BD projesi, outsideUser'a atanmış, bdUser reviewOwner
let task_bd_seniorlevel: string; // BD projesi, outsideUser'a atanmış → seniorMgr görür
let task_ymm: string;         // YMM projesi, bdUser değil
let task_deleted: string;     // BD projesi, silinmiş

const createdUserIds: string[] = [];
const createdProjectIds: string[] = [];
const createdTaskIds: string[] = [];

beforeAll(async () => {
  async function mkUser(
    slug: string, role: string, dept: string, level: number,
    cvap: boolean, overseeDept: string | null, name: string
  ): Promise<TUser> {
    const u = await prisma.user.create({
      data: {
        name, email: email(slug), password: await hash("test"),
        role, department: dept, seniorityLevel: level,
        canViewAllProjects: cvap, overseesDepartment: overseeDept,
        canViewAllTasks: false,
      },
    });
    createdUserIds.push(u.id);
    return { id: u.id, email: u.email, name: u.name, role: u.role, department: dept,
             seniorityLevel: level, canViewAllProjects: cvap, overseesDepartment: overseeDept };
  }

  // Kullanıcılar
  adminUser    = await mkUser("admin",   "ADMIN",    "ADMIN",             100, false, null,                  `${PREFIX} Admin`);
  cvapUser     = await mkUser("cvap",    "EMPLOYEE", "OUTSOURCE",          2,  true,  null,                  `${PREFIX} CanViewAll`);
  bdUser       = await mkUser("bd",      "EMPLOYEE", "BAGIMSIZ_DENETIM",   2,  false, null,                  `${PREFIX} BD Üye`);
  outsideUser  = await mkUser("out",     "EMPLOYEE", "OUTSOURCE",          2,  false, null,                  `${PREFIX} Outsider`);
  overseerBD   = await mkUser("ovbd",    "EMPLOYEE", "OUTSOURCE",          8,  false, "BAGIMSIZ_DENETIM",    `${PREFIX} Overseer BD`);
  seniorMgrBD  = await mkUser("smgr",    "EMPLOYEE", "BAGIMSIZ_DENETIM",  11,  false, null,                  `${PREFIX} Senior Mgr BD`);
  projCreator  = await mkUser("pcreat",  "EMPLOYEE", "BAGIMSIZ_DENETIM",   8,  false, null,                  `${PREFIX} Proje Kurucu`);

  // Projeler
  const bdProj = await prisma.project.create({
    data: { name: `${PREFIX} BD Projesi`, department: "BAGIMSIZ_DENETIM", createdById: projCreator.id },
  });
  bdProjId = bdProj.id;
  createdProjectIds.push(bdProjId);

  const ymmProj = await prisma.project.create({
    data: { name: `${PREFIX} YMM Projesi`, department: "YMM", createdById: adminUser.id },
  });
  ymmProjId = ymmProj.id;
  createdProjectIds.push(ymmProjId);

  // Görevler
  async function mkTask(
    title: string, projectId: string, assignedToId: string, createdById: string,
    reviewOwnerId?: string | null
  ) {
    const t = await prisma.task.create({
      data: {
        title, projectId, assignedToId, createdById,
        status: "TODO", priority: "MEDIUM",
        ...(reviewOwnerId ? { reviewOwnerId } : {}),
      },
    });
    createdTaskIds.push(t.id);
    return t.id;
  }

  // TP8: bdUser'a atanmış, bdUser oluşturmadı
  task_bd_assigned     = await mkTask(`${PREFIX} BD Atanmış`,      bdProjId,  bdUser.id,       adminUser.id);
  // TP9: bdUser oluşturdu (ama outsideUser'a atanmış)
  task_bd_created      = await mkTask(`${PREFIX} BD Oluşturan`,    bdProjId,  outsideUser.id,  bdUser.id);
  // TP10: projCreator'ın projesi, bdUser'a atanmış, adminUser oluşturdu
  task_bd_projcreator  = await mkTask(`${PREFIX} BD ProjKurucu`,   bdProjId,  bdUser.id,       adminUser.id);
  // Reviewer testi
  task_bd_reviewer     = await mkTask(`${PREFIX} BD Reviewer`,     bdProjId,  outsideUser.id,  adminUser.id, bdUser.id);
  // TP7: Senior Mgr görür (atanan o değil, oluşturan o değil)
  task_bd_seniorlevel  = await mkTask(`${PREFIX} BD SeniorMgr`,    bdProjId,  outsideUser.id,  adminUser.id);
  // TP4 / TP2 / TP3: YMM görevi
  task_ymm             = await mkTask(`${PREFIX} YMM Görevi`,      ymmProjId, bdUser.id,       adminUser.id);

  // TP1: silinmiş görev
  const deleted = await prisma.task.create({
    data: {
      title: `${PREFIX} Silinmiş Görev`, projectId: bdProjId,
      assignedToId: bdUser.id, createdById: adminUser.id,
      status: "TODO", priority: "LOW",
      deletedAt: new Date(),
    },
  });
  task_deleted = deleted.id;
  createdTaskIds.push(task_deleted);
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

// ── Testler ──────────────────────────────────────────────────────────────────

describe("TP1: Silinmiş görev → kimse göremez", () => {
  it("BD üyesi (assignee) silinmiş görevi listede göremez", async () => {
    asUser(bdUser);
    const res = await tasksGET();
    expect(res.status).toBe(200);
    const tasks = await json(res);
    const ids = tasks.map((t: any) => t.id);
    expect(ids).not.toContain(task_deleted);
  });

  it("ADMIN silinmiş görevi ID ile çekemez → 404", async () => {
    asUser(adminUser);
    const res = await taskByIdGET(fakeReq(), { params: { id: task_deleted } });
    expect(res.status).toBe(404);
  });
});

describe("TP2: ADMIN → departman kapısı uygulanmaz, çapraz dept görevi görür", () => {
  it("ADMIN, YMM projesinin görevini listede görür", async () => {
    asUser(adminUser);
    const res = await tasksGET();
    expect(res.status).toBe(200);
    const tasks = await json(res);
    const ids = tasks.map((t: any) => t.id);
    expect(ids).toContain(task_ymm);
    expect(ids).toContain(task_bd_assigned);
  });

  it("ADMIN, YMM görevini ID ile çekebilir → 200", async () => {
    asUser(adminUser);
    const res = await taskByIdGET(fakeReq(), { params: { id: task_ymm } });
    expect(res.status).toBe(200);
    const task = await json(res);
    expect(task.id).toBe(task_ymm);
  });
});

describe("TP3: canViewAllProjects=true → departman kapısı uygulanmaz", () => {
  it("cvapUser (OUTSOURCE dept), YMM görevini listede görür", async () => {
    asUser(cvapUser);
    const res = await tasksGET();
    expect(res.status).toBe(200);
    const tasks = await json(res);
    const ids = tasks.map((t: any) => t.id);
    expect(ids).toContain(task_ymm);
    expect(ids).toContain(task_bd_assigned);
  });

  it("cvapUser, YMM görevini ID ile çekebilir → 200", async () => {
    asUser(cvapUser);
    const res = await taskByIdGET(fakeReq(), { params: { id: task_ymm } });
    expect(res.status).toBe(200);
    const task = await json(res);
    expect(task.id).toBe(task_ymm);
  });
});

describe("TP4: Dept mismatch → departman kapısı engeller", () => {
  it("outsideUser (OUTSOURCE dept), BD görevini listede göremez", async () => {
    asUser(outsideUser);
    const res = await tasksGET();
    expect(res.status).toBe(200);
    const tasks = await json(res);
    const ids = tasks.map((t: any) => t.id);
    // outsideUser OUTSOURCE dept — BD projesinin görevleri görünmemeli
    expect(ids).not.toContain(task_bd_assigned);
    expect(ids).not.toContain(task_bd_seniorlevel);
  });

  it("outsideUser, BD görevini ID ile çekemez → 404", async () => {
    asUser(outsideUser);
    const res = await taskByIdGET(fakeReq(), { params: { id: task_bd_assigned } });
    expect(res.status).toBe(404);
  });
});

describe("TP5: overseesDepartment eşleşmesi → dept kapısını geçer, tüm dept görevlerini görür", () => {
  it("overseerBD (OUTSOURCE dept, overseesDept=BAGIMSIZ_DENETIM) tüm BD görevlerini görür", async () => {
    asUser(overseerBD);
    const res = await tasksGET();
    expect(res.status).toBe(200);
    const tasks = await json(res);
    const ids = tasks.map((t: any) => t.id);
    expect(ids).toContain(task_bd_assigned);
    expect(ids).toContain(task_bd_created);
    expect(ids).toContain(task_bd_projcreator);
    expect(ids).toContain(task_bd_seniorlevel);
  });

  it("overseerBD, BD görevini ID ile çekebilir → 200", async () => {
    asUser(overseerBD);
    const res = await taskByIdGET(fakeReq(), { params: { id: task_bd_seniorlevel } });
    expect(res.status).toBe(200);
    const task = await json(res);
    expect(task.id).toBe(task_bd_seniorlevel);
  });
});

describe("TP6: overseesDepartment farklı dept → başka dept görevini göremez", () => {
  it("overseerBD (overseesDept=BD), YMM görevini göremez → 404", async () => {
    asUser(overseerBD);
    const res = await taskByIdGET(fakeReq(), { params: { id: task_ymm } });
    expect(res.status).toBe(404);
  });

  it("overseerBD, YMM görevini listede göremez", async () => {
    asUser(overseerBD);
    const res = await tasksGET();
    const tasks = await json(res);
    const ids = tasks.map((t: any) => t.id);
    expect(ids).not.toContain(task_ymm);
  });
});

describe("TP7: seniorityLevel >= 11, aynı dept → tüm dept görevlerini görür", () => {
  it("seniorMgrBD (BD dept, level=11) BD'deki tüm görevleri görür", async () => {
    asUser(seniorMgrBD);
    const res = await tasksGET();
    expect(res.status).toBe(200);
    const tasks = await json(res);
    const ids = tasks.map((t: any) => t.id);
    expect(ids).toContain(task_bd_assigned);
    expect(ids).toContain(task_bd_seniorlevel); // atanan o değil, oluşturan o değil
    expect(ids).toContain(task_bd_projcreator);
  });

  it("seniorMgrBD, YMM görevini göremez (farklı dept) → 404", async () => {
    asUser(seniorMgrBD);
    const res = await taskByIdGET(fakeReq(), { params: { id: task_ymm } });
    expect(res.status).toBe(404);
  });
});

describe("TP8: assignedToId = userId → kendi görevini görür", () => {
  it("bdUser (BD dept, level=2) kendine atanmış görevi görür", async () => {
    asUser(bdUser);
    const res = await taskByIdGET(fakeReq(), { params: { id: task_bd_assigned } });
    expect(res.status).toBe(200);
    const task = await json(res);
    expect(task.id).toBe(task_bd_assigned);
  });

  it("bdUser, kendine atanmayan BD görevini (task_bd_seniorlevel) göremez → 404", async () => {
    asUser(bdUser);
    const res = await taskByIdGET(fakeReq(), { params: { id: task_bd_seniorlevel } });
    expect(res.status).toBe(404);
  });
});

describe("TP9: createdById = userId → oluşturduğu görevi görür", () => {
  it("bdUser (createdById=bdUser), başka kişiye atanmış görevi görür (kural 7)", async () => {
    asUser(bdUser);
    const res = await taskByIdGET(fakeReq(), { params: { id: task_bd_created } });
    expect(res.status).toBe(200);
    const task = await json(res);
    expect(task.id).toBe(task_bd_created);
  });
});

describe("TP10: projectCreatedById = userId → projenin görevlerini görür", () => {
  it("projCreator (BD dept), projesindeki başka kişiye atanmış görevi görür (kural 8)", async () => {
    // task_bd_projcreator: bdProj'un createdById=projCreator, task assignedToId=bdUser
    asUser(projCreator);
    const res = await taskByIdGET(fakeReq(), { params: { id: task_bd_projcreator } });
    expect(res.status).toBe(200);
    const task = await json(res);
    expect(task.id).toBe(task_bd_projcreator);
  });

  it("projCreator, listede kendi projesinin görevlerini görür", async () => {
    asUser(projCreator);
    const res = await tasksGET();
    expect(res.status).toBe(200);
    const tasks = await json(res);
    const ids = tasks.map((t: any) => t.id);
    // projCreator, bdProj'u oluşturdu → tüm bdProj görevleri görünmeli
    expect(ids).toContain(task_bd_projcreator);
    expect(ids).toContain(task_bd_assigned);
    expect(ids).toContain(task_bd_seniorlevel);
  });
});
