/**
 * B Bloğu entegrasyon testleri
 *
 * TB1  dueDate boş → 201 (son tarih zorunluluğu kaldırıldı)
 * TB2  Atanan boş (assignedToId yok) → 400
 * TB3  Proje detayından oluşturulan görevde projectId dolu gelir
 * TB4  Projesiz görevde departmentId oluşturanın departmanı
 * TB5  Backlog (GET /api/tasks) ve proje detayı (GET /api/tasks/:id) aynı görevi döndürür
 */

import { describe, it, expect, beforeAll, afterAll, vi } from "vitest";
import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";

vi.mock("next-auth", () => ({ getServerSession: vi.fn() }));
vi.mock("next-auth/jwt", () => ({ getToken: vi.fn() }));

import { GET as tasksGET, POST as tasksPOST } from "../../app/api/tasks/route";
import { GET as taskByIdGET } from "../../app/api/tasks/[id]/route";
import { getServerSession } from "next-auth";
import { getToken } from "next-auth/jwt";

const prisma = new PrismaClient();
const hash = (pw: string) => bcrypt.hash(pw, 10);
const PREFIX = `test-tb-${Date.now()}`;
const email = (slug: string) => `${PREFIX}-${slug}@tb.test`;

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

function sessionOf(u: TUser) {
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

function postReq(body: object) {
  return new Request("http://localhost/api/tasks", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}

function getReq(url = "http://localhost/api/tasks") {
  return new Request(url) as any;
}

async function json(res: Response) {
  return res.json();
}

// ── Test kullanıcıları ───────────────────────────────────────────────────────

let creator: TUser;   // BD dept, level=8, canViewAllProjects=false — görevi oluşturan
let assignee: TUser;  // BD dept, level=3 — göreve atanan
let adminUser: TUser; // ADMIN

const cleanupUserIds: string[] = [];
const cleanupProjectIds: string[] = [];
const cleanupTaskIds: string[] = [];

beforeAll(async () => {
  async function mkUser(
    slug: string, role: string, dept: string, level: number, cvap: boolean
  ): Promise<TUser> {
    const u = await prisma.user.create({
      data: {
        name: `${PREFIX} ${slug}`, email: email(slug), password: await hash("test"),
        role, department: dept, seniorityLevel: level,
        canViewAllProjects: cvap, overseesDepartment: null, canViewAllTasks: cvap,
      },
    });
    cleanupUserIds.push(u.id);
    return {
      id: u.id, email: u.email, name: u.name, role: u.role,
      department: dept, seniorityLevel: level, canViewAllProjects: cvap, overseesDepartment: null,
    };
  }

  [creator, assignee, adminUser] = await Promise.all([
    mkUser("creator", "EMPLOYEE", "BAGIMSIZ_DENETIM", 8, false),
    mkUser("assignee", "EMPLOYEE", "BAGIMSIZ_DENETIM", 3, false),
    mkUser("admin",    "ADMIN",    "ADMIN",            15, true),
  ]);
});

afterAll(async () => {
  await prisma.taskLog.deleteMany({ where: { taskId: { in: cleanupTaskIds } } });
  await prisma.task.deleteMany({ where: { id: { in: cleanupTaskIds } } });
  await prisma.project.deleteMany({ where: { id: { in: cleanupProjectIds } } });
  await prisma.user.deleteMany({ where: { id: { in: cleanupUserIds } } });
  await prisma.$disconnect();
});

// ── TB1: dueDate boş → 201 ───────────────────────────────────────────────────

describe("TB1 — dueDate boş → 201", () => {
  it("son tarih olmadan görev oluşturulabilir", async () => {
    sessionOf(creator);
    const res = await tasksPOST(postReq({
      title: `${PREFIX} TB1 dueDate-omitted`,
      assignedToId: assignee.id,
      priority: "MEDIUM",
      // dueDate intentionally omitted
    }) as any);
    const data = await json(res);
    expect(res.status).toBe(201);
    expect(data.dueDate).toBeNull();
    cleanupTaskIds.push(data.id);
  });
});

// ── TB2: atanan boş → 400 ────────────────────────────────────────────────────

describe("TB2 — atanan boş → 400", () => {
  it("assignedToId yok → 400", async () => {
    sessionOf(creator);
    const res = await tasksPOST(postReq({
      title: `${PREFIX} TB2 no-assignee`,
      priority: "MEDIUM",
      // assignedToId intentionally omitted
    }) as any);
    expect(res.status).toBe(400);
    const data = await json(res);
    expect(data.error).toMatch(/atanan/i);
  });
});

// ── TB3: projectId proje detayından geçilince dolu gelir ─────────────────────

describe("TB3 — projectId dolu", () => {
  it("projectId geçirilince oluşturulan görevde projectId dolu", async () => {
    // Proje oluştur
    const proj = await prisma.project.create({
      data: {
        name: `${PREFIX} TB3 Proje`,
        department: "BAGIMSIZ_DENETIM",
        status: "ACTIVE",
        createdById: creator.id,
      },
    });
    cleanupProjectIds.push(proj.id);

    // Proje üyesi ekle (creator ve assignee)
    await prisma.projectMember.createMany({
      data: [
        { projectId: proj.id, userId: creator.id },
        { projectId: proj.id, userId: assignee.id },
      ],
    });

    sessionOf(creator);
    const res = await tasksPOST(postReq({
      title: `${PREFIX} TB3 task-with-project`,
      assignedToId: assignee.id,
      priority: "LOW",
      projectId: proj.id,
    }) as any);
    const data = await json(res);
    expect(res.status).toBe(201);
    expect(data.projectId).toBe(proj.id);
    cleanupTaskIds.push(data.id);
  });
});

// ── TB4: projesiz görevde departmentId = oluşturanın departmanı ──────────────

describe("TB4 — projesiz görevde departmentId", () => {
  it("projectId yoksa departmentId creator'ın departmanına atanır", async () => {
    sessionOf(creator);
    const res = await tasksPOST(postReq({
      title: `${PREFIX} TB4 projesiz`,
      assignedToId: assignee.id,
      priority: "MEDIUM",
      // projectId omitted → projesiz
    }) as any);
    const data = await json(res);
    expect(res.status).toBe(201);
    // departmentId creator'ın department'ıyla eşleşmeli
    const saved = await prisma.task.findUnique({ where: { id: data.id }, select: { departmentId: true } });
    expect(saved?.departmentId).toBe(creator.department);
    cleanupTaskIds.push(data.id);
  });
});

// ── TB5: GET /api/tasks ve GET /api/tasks/:id aynı veriyi döndürür ───────────

describe("TB5 — backlog ve proje detayı aynı veriyi döndürür", () => {
  it("liste ve tekil endpoint aynı görevi tutarlı döndürür", async () => {
    // Görevi doğrudan oluştur
    const task = await prisma.task.create({
      data: {
        title: `${PREFIX} TB5 consistency`,
        status: "TODO",
        priority: "HIGH",
        createdById: creator.id,
        assignedToId: assignee.id,
        departmentId: "BAGIMSIZ_DENETIM",
      },
    });
    cleanupTaskIds.push(task.id);

    // creator olarak session
    sessionOf(creator);

    // Listeden al
    const listRes = await tasksGET();
    const listData: any[] = await json(listRes);
    expect(listRes.status).toBe(200);
    const fromList = listData.find((t: any) => t.id === task.id);
    expect(fromList).toBeDefined();

    // Tekil endpoint
    const byIdReq = new Request(`http://localhost/api/tasks/${task.id}`) as any;
    const byIdRes = await taskByIdGET(byIdReq, { params: { id: task.id } });
    const byIdData = await json(byIdRes);
    expect(byIdRes.status).toBe(200);
    expect(byIdData.id).toBe(task.id);

    // Başlık, status, priority tutarlı olmalı
    expect(fromList.title).toBe(byIdData.title);
    expect(fromList.status).toBe(byIdData.status);
    expect(fromList.priority).toBe(byIdData.priority);
  });
});
