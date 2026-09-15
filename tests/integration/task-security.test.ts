/**
 * Güvenlik açığı kapatma entegrasyon testleri — backend güvenlik turu
 *
 * Kapsanan senaryolar:
 *   TS1  Bulk atama: uygun olmayan hedefle → tamamen reddediliyor, kısmen uygulanmıyor
 *   TS2  Bulk atama: assignedToId null/boş → 400
 *   TS3  PATCH {status:"DONE"} doğrudan (REVIEW'dan) → 400, approve aksiyonu gerekli
 *   TS4  canReviewTask'ı olmayan kullanıcı approve action ile görevi tamamlayamıyor → 403
 *   TS5  Görülemeyen parent'ın id/title'ı GET yanıtında dönmüyor (restricted flag)
 *   TS6  Normal kullanıcı POST /api/tasks body.departmentId ile departman değiştiremiyor
 *   TS7  Görevin atananı dosya/kaynak ekleyemiyor → 403
 *   TS8  Alt görev parent'ın projesini/departmanını miras alıyor, body'deki değer yok sayılıyor
 *   TS9  PATCH {status:"DONE"} doğrudan TODO/IN_PROGRESS'ten → 400 (2. tur smoke testinde bulunan
 *        gerçek bypass: atanan kişi onay akışını tamamen atlayıp kendi görevini DONE yapabiliyordu)
 *   TS10 Görevle ilgisi olmayan (atanan/yönetici değil) görünür kullanıcı TODO↔IN_PROGRESS
 *        durumunu değiştiremez → 403
 */

import { describe, it, expect, beforeAll, afterAll, vi } from "vitest";
import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";

vi.mock("next-auth", () => ({ getServerSession: vi.fn() }));
vi.mock("next-auth/jwt", () => ({ getToken: vi.fn() }));

import { GET as taskByIdGET, PATCH as taskPATCH } from "../../app/api/tasks/[id]/route";
import { POST as tasksPOST } from "../../app/api/tasks/route";
import { POST as bulkPOST } from "../../app/api/tasks/bulk/route";
import { POST as filesPOST } from "../../app/api/tasks/[id]/files/route";
import { getServerSession } from "next-auth";
import { getToken } from "next-auth/jwt";

const prisma = new PrismaClient();
const hash = (pw: string) => bcrypt.hash(pw, 10);
const PREFIX = `test-ts-${Date.now()}`;
const email = (slug: string) => `${PREFIX}-${slug}@ts.test`;

type TUser = {
  id: string; email: string; name: string; role: string;
  department: string; seniorityLevel: number;
  canViewAllProjects: boolean; overseesDepartment: string | null;
};

function tokenOf(u: TUser) {
  return {
    id: u.id, name: u.name, email: u.email, role: u.role,
    department: u.department, seniorityLevel: u.seniorityLevel,
    canViewAllProjects: u.canViewAllProjects, canViewAllTasks: false,
    overseesDepartment: u.overseesDepartment,
  };
}

function sessionOf(u: TUser) {
  const token = tokenOf(u);
  const session = { user: token, expires: new Date(Date.now() + 86_400_000).toISOString() };
  vi.mocked(getServerSession).mockResolvedValue(session as any);
  vi.mocked(getToken).mockResolvedValue(token as any);
}

function getReq(url = "http://localhost/api/tasks") {
  return new Request(url) as any;
}

function postReq(url: string, body: object) {
  return new Request(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  }) as any;
}

function patchReq(id: string, body: object) {
  return new Request(`http://localhost/api/tasks/${id}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  }) as any;
}

async function json(res: Response) { return res.json(); }

// ── Kullanıcılar ──────────────────────────────────────────────────────────────

let adminUser: TUser;   // ADMIN
let creator: TUser;     // BD dept, level=8 — oluşturan / proje kurucusu
let assignee: TUser;    // BD dept, level=3 — göreve atanan
let reviewer: TUser;    // BD dept, level=12 — Senior Manager (inceleme yapabilir)
let bystander: TUser;   // BD dept, level=3 — görevle ilişkisi yok, inceleme yetkisi yok
let bdTarget: TUser;    // BD dept, level=1 — bulk atama hedefi (yalnızca BD'de uygun)
let outCreator: TUser;  // OUTSOURCE dept, level=8 — OUTSOURCE görevinin sahibi

let bdProject: { id: string };

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

  [adminUser, creator, assignee, reviewer, bystander, bdTarget, outCreator] = await Promise.all([
    mkUser("admin",     "ADMIN",    "ADMIN",            15, true),
    mkUser("creator",   "EMPLOYEE", "BAGIMSIZ_DENETIM",  8, false),
    mkUser("assignee",  "EMPLOYEE", "BAGIMSIZ_DENETIM",  3, false),
    mkUser("reviewer",  "EMPLOYEE", "BAGIMSIZ_DENETIM", 12, false),
    mkUser("bystander", "EMPLOYEE", "BAGIMSIZ_DENETIM",  3, false),
    mkUser("bdtarget",  "EMPLOYEE", "BAGIMSIZ_DENETIM",  1, false),
    mkUser("outcreator","EMPLOYEE", "OUTSOURCE",         8, false),
  ]);

  const proj = await prisma.project.create({
    data: { name: `${PREFIX} BD Proje`, department: "BAGIMSIZ_DENETIM", createdById: creator.id },
  });
  cleanupProjectIds.push(proj.id);
  bdProject = { id: proj.id };
});

afterAll(async () => {
  await prisma.taskLog.deleteMany({ where: { taskId: { in: cleanupTaskIds } } });
  await prisma.file.deleteMany({ where: { taskId: { in: cleanupTaskIds } } });
  await prisma.task.deleteMany({ where: { id: { in: cleanupTaskIds } } });
  if (cleanupProjectIds.length > 0) {
    await prisma.projectMember.deleteMany({ where: { projectId: { in: cleanupProjectIds } } });
    await prisma.project.deleteMany({ where: { id: { in: cleanupProjectIds } } });
  }
  await prisma.user.deleteMany({ where: { id: { in: cleanupUserIds } } });
  await prisma.$disconnect();
});

async function mkTask(opts: {
  title: string; status?: string; assignedToId: string; createdById: string;
  reviewOwnerId?: string | null; departmentId?: string | null; projectId?: string | null;
  parentTaskId?: string | null;
}): Promise<string> {
  const t = await prisma.task.create({
    data: {
      title: opts.title,
      status: opts.status ?? "TODO",
      priority: "MEDIUM",
      assignedToId: opts.assignedToId,
      createdById: opts.createdById,
      reviewOwnerId: opts.reviewOwnerId ?? null,
      departmentId: opts.departmentId ?? null,
      projectId: opts.projectId ?? null,
      parentTaskId: opts.parentTaskId ?? null,
    },
  });
  cleanupTaskIds.push(t.id);
  return t.id;
}

// ── TS1: Bulk atama — uygun olmayan hedef varsa tamamen reddedilir ───────────

describe("TS1 — bulk atama: uygun olmayan hedefle tamamen reddedilir", () => {
  it("BD ve OUTSOURCE görevleri birlikte atanırsa, OUTSOURCE için uygun olmayan hedef tüm işlemi reddeder", async () => {
    const bdTaskId = await mkTask({
      title: `${PREFIX} TS1 BD`, assignedToId: creator.id, createdById: creator.id,
      departmentId: "BAGIMSIZ_DENETIM",
    });
    const outTaskId = await mkTask({
      title: `${PREFIX} TS1 OUT`, assignedToId: outCreator.id, createdById: outCreator.id,
      departmentId: "OUTSOURCE",
    });

    sessionOf(adminUser);
    const res = await bulkPOST(postReq("http://localhost/api/tasks/bulk", {
      ids: [bdTaskId, outTaskId], action: "assign", assignedToId: bdTarget.id,
    }));
    expect(res.status).toBe(403);

    // Kısmen uygulanmadı — her iki görev de eski atananında kaldı
    const bdTask = await prisma.task.findUnique({ where: { id: bdTaskId }, select: { assignedToId: true } });
    const outTask = await prisma.task.findUnique({ where: { id: outTaskId }, select: { assignedToId: true } });
    expect(bdTask?.assignedToId).toBe(creator.id);
    expect(outTask?.assignedToId).toBe(outCreator.id);
  });
});

// ── TS2: Bulk atama — assignedToId null/boş → 400 ────────────────────────────

describe("TS2 — bulk atama: assignedToId boş → 400", () => {
  it("assignedToId olmadan bulk assign → 400", async () => {
    const taskId = await mkTask({
      title: `${PREFIX} TS2`, assignedToId: creator.id, createdById: creator.id,
      departmentId: "BAGIMSIZ_DENETIM",
    });

    sessionOf(adminUser);
    const res = await bulkPOST(postReq("http://localhost/api/tasks/bulk", {
      ids: [taskId], action: "assign", assignedToId: null,
    }));
    expect(res.status).toBe(400);
    const data = await json(res);
    expect(data.error).toMatch(/atanan/i);
  });
});

// ── TS3: PATCH {status:"DONE"} doğrudan → 400 ────────────────────────────────

describe("TS3 — PATCH status:DONE doğrudan (REVIEW'dan) → 400", () => {
  it("reviewer bile genel PATCH ile REVIEW→DONE yapamaz, approve aksiyonu gerekir", async () => {
    const taskId = await mkTask({
      title: `${PREFIX} TS3`, status: "REVIEW", assignedToId: assignee.id, createdById: creator.id,
      reviewOwnerId: reviewer.id, projectId: bdProject.id,
    });

    sessionOf(reviewer);
    const res = await taskPATCH(patchReq(taskId, { status: "DONE" }), { params: { id: taskId } });
    expect(res.status).toBe(400);
    const data = await json(res);
    expect(data.error).toMatch(/onayla/i);

    const task = await prisma.task.findUnique({ where: { id: taskId }, select: { status: true } });
    expect(task?.status).toBe("REVIEW");
  });
});

// ── TS4: canReviewTask yetkisi olmayan kullanıcı approve edemez ──────────────

describe("TS4 — inceleme yetkisi olmayan kullanıcı approve action ile tamamlayamaz", () => {
  it("bystander (reviewOwner değil, yönetici değil) approve → 403", async () => {
    // bystander görevi görebilir (createdById=bystander → kural 7) ama reviewOwner
    // creator olduğu için canReviewTask false döner — görünürlük ile inceleme
    // yetkisinin ayrı kavramlar olduğunu doğrular.
    const taskId = await mkTask({
      title: `${PREFIX} TS4`, status: "REVIEW", assignedToId: assignee.id, createdById: bystander.id,
      reviewOwnerId: creator.id, projectId: bdProject.id,
    });

    sessionOf(bystander);
    const res = await taskPATCH(patchReq(taskId, { action: "approve" }), { params: { id: taskId } });
    expect(res.status).toBe(403);
    const data = await json(res);
    // Not: "İnceleme" TR büyük İ, /i bayrağıyla ASCII "i" ile case-fold edilmeyebilir —
    // baştaki büyük harfi içermeyen güvenli bir alt dizeyle eşleştir.
    expect(data.error).toMatch(/yetkisi yok/);

    const task = await prisma.task.findUnique({ where: { id: taskId }, select: { status: true } });
    expect(task?.status).toBe("REVIEW");
  });
});

// ── TS5: Görülemeyen parent'ın id/title'ı yanıtta dönmüyor ───────────────────

describe("TS5 — görülemeyen parent bilgisi sızmaz", () => {
  it("bdUser'ın kendi görevinin parent'ı farklı departmandaysa restricted döner", async () => {
    const parentId = await mkTask({
      title: `${PREFIX} TS5 Parent (gizli)`, assignedToId: outCreator.id, createdById: outCreator.id,
      departmentId: "OUTSOURCE",
    });
    const childId = await mkTask({
      title: `${PREFIX} TS5 Child`, assignedToId: assignee.id, createdById: assignee.id,
      departmentId: "BAGIMSIZ_DENETIM", parentTaskId: parentId,
    });

    sessionOf(assignee);
    const res = await taskByIdGET(getReq(`http://localhost/api/tasks/${childId}`), { params: { id: childId } });
    expect(res.status).toBe(200);
    const data = await json(res);
    expect(data.parent).toBeTruthy();
    expect(data.parent.restricted).toBe(true);
    expect(data.parent.id).toBeUndefined();
    expect(data.parent.title).toBeUndefined();
  });
});

// ── TS6: Normal kullanıcı body.departmentId ile departman değiştiremez ───────

describe("TS6 — normal kullanıcı body.departmentId ile departman değiştiremez", () => {
  it("creator (BD dept) departmentId=OUTSOURCE gönderse de görev BD departmanında oluşur", async () => {
    sessionOf(creator);
    const res = await tasksPOST(postReq("http://localhost/api/tasks", {
      title: `${PREFIX} TS6`,
      assignedToId: assignee.id,
      priority: "MEDIUM",
      departmentId: "OUTSOURCE",
    }));
    const data = await json(res);
    expect(res.status).toBe(201);
    cleanupTaskIds.push(data.id);

    const saved = await prisma.task.findUnique({ where: { id: data.id }, select: { departmentId: true } });
    expect(saved?.departmentId).toBe(creator.department);
    expect(saved?.departmentId).not.toBe("OUTSOURCE");
  });

  it("ADMIN body.departmentId ile departmanı belirleyebilir (istisna)", async () => {
    sessionOf(adminUser);
    const res = await tasksPOST(postReq("http://localhost/api/tasks", {
      title: `${PREFIX} TS6-admin`,
      assignedToId: outCreator.id, // OUTSOURCE dept üyesi — departmentId=OUTSOURCE ile uygunluk sağlanır
      priority: "MEDIUM",
      departmentId: "OUTSOURCE",
    }));
    const data = await json(res);
    expect(res.status).toBe(201);
    cleanupTaskIds.push(data.id);

    const saved = await prisma.task.findUnique({ where: { id: data.id }, select: { departmentId: true } });
    expect(saved?.departmentId).toBe("OUTSOURCE");
  });
});

// ── TS7: Görevin atananı dosya/kaynak ekleyemez ──────────────────────────────

describe("TS7 — görevin atananı dosya ekleyemez", () => {
  it("assignee kendi göreve dosya yükleyemez → 403", async () => {
    const taskId = await mkTask({
      title: `${PREFIX} TS7`, assignedToId: assignee.id, createdById: creator.id,
      reviewOwnerId: creator.id, departmentId: "BAGIMSIZ_DENETIM",
    });

    sessionOf(assignee);
    const res = await filesPOST(
      new Request(`http://localhost/api/tasks/${taskId}/files`, { method: "POST" }) as any,
      { params: { id: taskId } }
    );
    expect(res.status).toBe(403);
  });

  it("reviewOwner dosya yükleyebilir (yetki reddi assignee'ye özgü)", async () => {
    const taskId = await mkTask({
      title: `${PREFIX} TS7b`, assignedToId: assignee.id, createdById: creator.id,
      reviewOwnerId: creator.id, departmentId: "BAGIMSIZ_DENETIM",
    });

    sessionOf(creator);
    const formData = new FormData();
    formData.append("file", new File(["içerik"], "test.txt", { type: "text/plain" }));
    const req = new Request(`http://localhost/api/tasks/${taskId}/files`, {
      method: "POST",
      body: formData,
    }) as any;
    const res = await filesPOST(req, { params: { id: taskId } });
    expect(res.status).toBe(201);
  });
});

// ── TS8: Alt görev parent'ın projesini/departmanını miras alır ──────────────

describe("TS8 — alt görev parent'ın proje/departmanını miras alır", () => {
  it("parent projeliyse alt görev aynı projede oluşur, body.projectId yok sayılır", async () => {
    const proj = await prisma.project.create({
      data: { name: `${PREFIX} TS8 Proje`, department: "BAGIMSIZ_DENETIM", createdById: creator.id },
    });
    cleanupProjectIds.push(proj.id);
    await prisma.projectMember.createMany({
      data: [{ projectId: proj.id, userId: creator.id }, { projectId: proj.id, userId: assignee.id }],
    });

    const parentId = await mkTask({
      title: `${PREFIX} TS8 Parent-proj`, assignedToId: assignee.id, createdById: creator.id,
      projectId: proj.id, reviewOwnerId: creator.id,
    });

    sessionOf(creator);
    const res = await tasksPOST(postReq("http://localhost/api/tasks", {
      title: `${PREFIX} TS8 Child-proj`,
      assignedToId: assignee.id,
      priority: "MEDIUM",
      parentTaskId: parentId,
      projectId: "should-be-ignored-project-id",
      departmentId: "OUTSOURCE",
    }));
    const data = await json(res);
    expect(res.status).toBe(201);
    cleanupTaskIds.push(data.id);

    const saved = await prisma.task.findUnique({ where: { id: data.id }, select: { projectId: true, departmentId: true } });
    expect(saved?.projectId).toBe(proj.id);
    expect(saved?.departmentId).toBeNull();
  });

  it("parent projesizse alt görev de projesiz olur ve parent'ın departmanını miras alır", async () => {
    const parentId = await mkTask({
      title: `${PREFIX} TS8 Parent-dept`, assignedToId: assignee.id, createdById: creator.id,
      departmentId: "BAGIMSIZ_DENETIM", reviewOwnerId: creator.id,
    });

    sessionOf(creator);
    const res = await tasksPOST(postReq("http://localhost/api/tasks", {
      title: `${PREFIX} TS8 Child-dept`,
      assignedToId: assignee.id,
      priority: "MEDIUM",
      parentTaskId: parentId,
      projectId: "should-be-ignored-project-id",
      departmentId: "OUTSOURCE",
    }));
    const data = await json(res);
    expect(res.status).toBe(201);
    cleanupTaskIds.push(data.id);

    const saved = await prisma.task.findUnique({ where: { id: data.id }, select: { projectId: true, departmentId: true } });
    expect(saved?.projectId).toBeNull();
    expect(saved?.departmentId).toBe("BAGIMSIZ_DENETIM");
  });
});

// ── TS9: PATCH {status:"DONE"} doğrudan TODO/IN_PROGRESS'ten → 400 ───────────

describe("TS9 — PATCH status:DONE doğrudan (TODO/IN_PROGRESS'ten) → 400", () => {
  it("atanan kişi TODO'dan doğrudan DONE yapamaz — approve aksiyonu şart", async () => {
    const taskId = await mkTask({
      title: `${PREFIX} TS9-todo`, status: "TODO", assignedToId: assignee.id, createdById: creator.id,
      departmentId: "BAGIMSIZ_DENETIM",
    });

    sessionOf(assignee);
    const res = await taskPATCH(patchReq(taskId, { status: "DONE" }), { params: { id: taskId } });
    expect(res.status).toBe(400);
    const data = await json(res);
    expect(data.error).toMatch(/onayla/i);

    const task = await prisma.task.findUnique({ where: { id: taskId }, select: { status: true } });
    expect(task?.status).toBe("TODO");
  });

  it("atanan kişi IN_PROGRESS'ten doğrudan DONE yapamaz — approve aksiyonu şart", async () => {
    const taskId = await mkTask({
      title: `${PREFIX} TS9-inprog`, status: "IN_PROGRESS", assignedToId: assignee.id, createdById: creator.id,
      departmentId: "BAGIMSIZ_DENETIM",
    });

    sessionOf(assignee);
    const res = await taskPATCH(patchReq(taskId, { status: "DONE" }), { params: { id: taskId } });
    expect(res.status).toBe(400);

    const task = await prisma.task.findUnique({ where: { id: taskId }, select: { status: true } });
    expect(task?.status).toBe("IN_PROGRESS");
  });
});

// ── TS10: İlgisiz görünür kullanıcı TODO↔IN_PROGRESS değiştiremez ────────────

describe("TS10 — görevle ilgisiz (atanan/yönetici değil) kullanıcı durum değiştiremez", () => {
  it("createdById üzerinden görünür ama atanan/yönetici olmayan kullanıcı → 403", async () => {
    // bystander görevi görebilir (createdById=bystander → kural 7) ama ne atanan
    // ne de yönetim yetkisi (canManageTask) var — durum değişikliği reddedilmeli.
    const taskId = await mkTask({
      title: `${PREFIX} TS10`, status: "TODO", assignedToId: assignee.id, createdById: bystander.id,
      departmentId: "BAGIMSIZ_DENETIM",
    });

    sessionOf(bystander);
    const res = await taskPATCH(patchReq(taskId, { status: "IN_PROGRESS" }), { params: { id: taskId } });
    expect(res.status).toBe(403);
    const data = await json(res);
    expect(data.error).toMatch(/yetkiniz yok/i);

    const task = await prisma.task.findUnique({ where: { id: taskId }, select: { status: true } });
    expect(task?.status).toBe("TODO");
  });
});
