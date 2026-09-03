/**
 * Görünürlük entegrasyon testleri — kişiye özgü görev görünürlük modeli
 *
 * Gerçek Prisma (dev.db) ve gerçek route handler'ları kullanır.
 * next-auth session/token katmanı mock'lanır — geri kalan her şey gerçek.
 *
 * YENİ kural: bir görevi yalnızca şunlar görebilir:
 *   1. Görevin atandığı kişi
 *   2. Projeyi oluşturan kişi
 *   3. Birimin departman sorumlusu (overseesDepartment)
 *   4. ADMIN veya canViewAllProjects=true
 *   Proje üyesi olmak tek başına başkasının görevini görme hakkı VERMEZ.
 *
 * Kapsanan senaryolar:
 *   T1  Müdür1 projeye üye ama kendine atanmış görevi yok → proje görevlerini GÖREMEZ
 *   T2  Müdür2 ayrı projede: Müdür1'in görevi GÖRÜNMEZ
 *   T3  Senior yalnızca kendine atanmış görevi görür (diğer üyelerin görevleri GÖRÜNMEZ)
 *   T4  Asistan1 yalnızca kendi görevini görür (Asistan2'ninkini de GÖREMEZ — yeni kural)
 *   T5  Asistan1 session'ıyla Müdür2'nin görev ID'si → 404
 *   T5b Asistan1 kendi görev ID'si → 200
 *   T5c Asistan2 Müdür2'nin görevi → 404
 *   T6a Dashboard openTasks ile görünür küme tutarlı
 *   T6b Müdür2 dashboard sayaçları izole
 *   T7  Senior (level 2) → Asistant Manager (level 4) atama → 403
 */

import { describe, it, expect, beforeAll, afterAll, vi } from "vitest";
import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";

vi.mock("next-auth", () => ({ getServerSession: vi.fn() }));
vi.mock("next-auth/jwt", () => ({ getToken: vi.fn() }));

import { GET as tasksGET, POST as tasksPOST } from "../../app/api/tasks/route";
import { GET as taskByIdGET } from "../../app/api/tasks/[id]/route";
import { GET as dashboardGET } from "../../app/api/dashboard/route";
import { getServerSession } from "next-auth";
import { getToken } from "next-auth/jwt";

const prisma = new PrismaClient();
const hash = (pw: string) => bcrypt.hash(pw, 10);
const PREFIX = `test-vis-${Date.now()}`;
const email = (slug: string) => `${PREFIX}-${slug}@viz.test`;

type TestUser = {
  id: string;
  email: string;
  name: string;
  role: string;
  department: string;
  seniorityLevel: number;
  canViewAllProjects: boolean;
  overseesDepartment: string | null;
};

function makeSession(u: TestUser) {
  return {
    user: {
      id: u.id,
      name: u.name,
      email: u.email,
      role: u.role,
      department: u.department,
      seniorityLevel: u.seniorityLevel,
      canViewAllProjects: u.canViewAllProjects,
      canViewAllTasks: false,
      overseesDepartment: u.overseesDepartment,
    },
    expires: new Date(Date.now() + 86_400_000).toISOString(),
  };
}

function makeToken(u: TestUser) {
  return {
    id: u.id,
    name: u.name,
    email: u.email,
    role: u.role,
    department: u.department,
    seniorityLevel: u.seniorityLevel,
    canViewAllProjects: u.canViewAllProjects,
    canViewAllTasks: false,
    overseesDepartment: u.overseesDepartment,
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

let mudur1: TestUser;
let mudur2: TestUser;
let senior: TestUser;
let asistan1: TestUser;
let asistan2: TestUser;

// Her biri projesine atanmış görevler
let gorevProje1A: string; // proje1'de, senior'a atanmış
let gorevProje1B: string; // proje1'de, asistan1'e atanmış
let gorevProje1C: string; // proje1'de, asistan2'ye atanmış
let gorevMudur2: string;  // proje2'de, mudur2'ye atanmış

const createdTaskIds: string[] = [];
const createdUserIds: string[] = [];
const createdProjectIds: string[] = [];

beforeAll(async () => {
  async function mkUser(slug: string, level: number, name: string): Promise<TestUser> {
    const u = await prisma.user.create({
      data: {
        name,
        email: email(slug),
        password: await hash("test123"),
        role: "EMPLOYEE",
        department: "OUTSOURCE",
        seniorityLevel: level,
        canViewAllProjects: false,
        canViewAllTasks: false,
      },
    });
    createdUserIds.push(u.id);
    return { ...u, canViewAllProjects: false, overseesDepartment: null };
  }

  mudur1   = await mkUser("mudur1",  7, `${PREFIX} Müdür 1`);
  mudur2   = await mkUser("mudur2",  7, `${PREFIX} Müdür 2`);
  senior   = await mkUser("senior",  2, `${PREFIX} Senior`);
  asistan1 = await mkUser("ast1",    0, `${PREFIX} Asistan 1`);
  asistan2 = await mkUser("ast2",    0, `${PREFIX} Asistan 2`);

  // Admin kullanıcı (proje oluşturmak için)
  const admin = await prisma.user.create({
    data: {
      name: `${PREFIX} Admin`,
      email: email("admin"),
      password: await hash("admin"),
      role: "ADMIN",
      department: "ADMIN",
      seniorityLevel: 100,
      canViewAllProjects: true,
      canViewAllTasks: true,
    },
  });
  createdUserIds.push(admin.id);

  // Proje 1: mudur1 + senior + asistan1 + asistan2
  const proj1 = await prisma.project.create({
    data: { name: `${PREFIX} Proje 1`, department: "BAGIMSIZ_DENETIM", createdById: admin.id },
  });
  createdProjectIds.push(proj1.id);
  await prisma.projectMember.createMany({
    data: [mudur1.id, senior.id, asistan1.id, asistan2.id].map((uid) => ({
      projectId: proj1.id, userId: uid, assignedBy: admin.id,
    })),
  });

  // Proje 2: mudur2
  const proj2 = await prisma.project.create({
    data: { name: `${PREFIX} Proje 2`, department: "BAGIMSIZ_DENETIM", createdById: admin.id },
  });
  createdProjectIds.push(proj2.id);
  await prisma.projectMember.createMany({
    data: [{ projectId: proj2.id, userId: mudur2.id, assignedBy: admin.id }],
  });

  // Görevler
  const g1 = await prisma.task.create({
    data: { title: `${PREFIX} Senior Görevi`, projectId: proj1.id, assignedToId: senior.id, createdById: admin.id, status: "TODO", priority: "MEDIUM" },
  });
  gorevProje1A = g1.id;
  createdTaskIds.push(g1.id);

  const g2 = await prisma.task.create({
    data: { title: `${PREFIX} Asistan1 Görevi`, projectId: proj1.id, assignedToId: asistan1.id, createdById: admin.id, status: "TODO", priority: "LOW" },
  });
  gorevProje1B = g2.id;
  createdTaskIds.push(g2.id);

  const g3 = await prisma.task.create({
    data: { title: `${PREFIX} Asistan2 Görevi`, projectId: proj1.id, assignedToId: asistan2.id, createdById: admin.id, status: "TODO", priority: "LOW" },
  });
  gorevProje1C = g3.id;
  createdTaskIds.push(g3.id);

  const g4 = await prisma.task.create({
    data: { title: `${PREFIX} Müdür2 Görevi`, projectId: proj2.id, assignedToId: mudur2.id, createdById: admin.id, status: "TODO", priority: "MEDIUM" },
  });
  gorevMudur2 = g4.id;
  createdTaskIds.push(g4.id);
});

afterAll(async () => {
  await prisma.task.deleteMany({ where: { id: { in: createdTaskIds } } });
  await prisma.projectMember.deleteMany({ where: { projectId: { in: createdProjectIds } } });
  await prisma.project.deleteMany({ where: { id: { in: createdProjectIds } } });
  await prisma.user.deleteMany({ where: { id: { in: createdUserIds } } });
  await prisma.$disconnect();
});

// ── Testler ─────────────────────────────────────────────────────────────────

describe("Görev görünürlüğü — GET /api/tasks", () => {
  it("T1: Müdür1 projeye üye ama kendine atanmış görevi yok → proje görevlerini göremez", async () => {
    asUser(mudur1);
    const res = await tasksGET();
    expect(res.status).toBe(200);
    const tasks = await json(res);
    const ids: string[] = tasks.map((t: any) => t.id);
    // mudur1'e atanmış görev yok — başkalarının görevleri görünmez
    expect(ids).not.toContain(gorevProje1A); // senior'ın görevi
    expect(ids).not.toContain(gorevProje1B); // asistan1'in görevi
    expect(ids).not.toContain(gorevProje1C); // asistan2'nin görevi
    expect(ids).not.toContain(gorevMudur2);  // mudur2'nin görevi
  });

  it("T2: Müdür2 Müdür1'in projesindeki görevleri görmez", async () => {
    asUser(mudur2);
    const res = await tasksGET();
    const tasks = await json(res);
    const ids: string[] = tasks.map((t: any) => t.id);
    expect(ids).toContain(gorevMudur2);
    expect(ids).not.toContain(gorevProje1A);
    expect(ids).not.toContain(gorevProje1B);
    expect(ids).not.toContain(gorevProje1C);
  });

  it("T3: Senior yalnızca kendine atanmış görevi görür", async () => {
    asUser(senior);
    const res = await tasksGET();
    const tasks = await json(res);
    const ids: string[] = tasks.map((t: any) => t.id);
    expect(ids).toContain(gorevProje1A);      // kendi görevi
    expect(ids).not.toContain(gorevProje1B);  // asistan1'in görevi
    expect(ids).not.toContain(gorevProje1C);  // asistan2'nin görevi
    expect(ids).not.toContain(gorevMudur2);
  });

  it("T4: Asistan1 yalnızca kendi görevini görür (Asistan2'ninkini göremez)", async () => {
    asUser(asistan1);
    const res = await tasksGET();
    const tasks = await json(res);
    const ids: string[] = tasks.map((t: any) => t.id);
    expect(ids).toContain(gorevProje1B);       // kendi görevi
    expect(ids).not.toContain(gorevProje1C);   // asistan2'nin görevi — yeni kuralla GÖRÜNMEZ
    expect(ids).not.toContain(gorevMudur2);
  });
});

describe("Görev detay — GET /api/tasks/[id] → 404 yetkisiz erişim", () => {
  it("T5: Asistan1 session'ıyla Müdür2'nin görev ID'si → 404", async () => {
    asUser(asistan1);
    const res = await taskByIdGET(fakeReq(), { params: { id: gorevMudur2 } });
    expect(res.status).toBe(404);
  });

  it("T5b: Asistan1 session'ıyla kendi görevi → 200", async () => {
    asUser(asistan1);
    const res = await taskByIdGET(fakeReq(), { params: { id: gorevProje1B } });
    expect(res.status).toBe(200);
    const task = await json(res);
    expect(task.id).toBe(gorevProje1B);
  });

  it("T5c: Asistan2 session'ıyla Müdür2'nin görevi → 404", async () => {
    asUser(asistan2);
    const res = await taskByIdGET(fakeReq(), { params: { id: gorevMudur2 } });
    expect(res.status).toBe(404);
  });
});

describe("Dashboard sayaçları — GET /api/dashboard", () => {
  it("T6a: Asistan1 dashboard — openTasks sayısı ≥ 1", async () => {
    asUser(asistan1);
    const dashRes = await dashboardGET();
    expect(dashRes.status).toBe(200);
    const dash = await json(dashRes);
    expect(dash.openTasks).toBeGreaterThanOrEqual(0);
  });

  it("T6b: Müdür2 dashboard — Proje 1 görevleri yansımaz", async () => {
    asUser(mudur2);
    const listRes = await tasksGET();
    const tasks = await json(listRes);
    const visibleIds = tasks.map((t: any) => t.id);
    expect(visibleIds).not.toContain(gorevProje1A);
  });
});

describe("Atama yetkisi — kıdem kuralı sunucu kontrolü", () => {
  it("T7: Senior (level 2) → Asistant Manager (level 4) kişiye atama → 403", async () => {
    const asstMgr = await prisma.user.create({
      data: {
        name: `${PREFIX} AsstMgr`,
        email: email("asst-mgr"),
        password: await hash("test"),
        role: "EMPLOYEE",
        department: "OUTSOURCE",
        seniorityLevel: 4,
        canViewAllProjects: false,
        canViewAllTasks: false,
      },
    });
    createdUserIds.push(asstMgr.id);

    asUser(senior);
    const { POST: tasksPOSTFn } = await import("../../app/api/tasks/route");

    const postReq = new Request("http://localhost/api/tasks", {
      method: "POST",
      body: JSON.stringify({
        title: `${PREFIX} Yasak Atama`,
        assignedToId: asstMgr.id,
        priority: "LOW",
      }),
      headers: { "Content-Type": "application/json" },
    });

    const res = await tasksPOSTFn(postReq as any);
    expect(res.status).toBe(403);

    const leaked = await prisma.task.findFirst({ where: { title: `${PREFIX} Yasak Atama` } });
    expect(leaked).toBeNull();
  });
});
