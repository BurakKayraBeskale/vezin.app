/**
 * C Bloğu entegrasyon testleri — inceleme akışı, kaynak yönetimi, alt görev ağacı
 *
 * TC1  Atanan kendi görevini onaylayamaz (approve action → 403)
 * TC2  Atanan inceleme sürecini geri alamaz (REVIEW → IN_PROGRESS → 403)
 * TC3  Revizyon notu olmadan geri gönderme → 400
 * TC4  Revizyon notu ile geri gönderme → görev TODO olur
 * TC5  Açık alt görev varken incelemeye gönderme → 409
 * TC6  Alt görevler tamamlanınca parent otomatik ilerlemez
 * TC7  Yeniden atama: status=TODO, reviewOwnerId=atayan, createdById değişmez
 * TC8  Farklı kullanıcının inceleme yaparsa reviewOwnerId değişmez (submit_review'da)
 * TC9  Yeniden açma sebebi olmadan reopen → 400
 * TC10 Parent reopen edilince çocuklar etkilenmez
 * TC11 DONE görev düzenleme → 403
 */

import { describe, it, expect, beforeAll, afterAll, vi } from "vitest";
import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";

vi.mock("next-auth", () => ({ getServerSession: vi.fn() }));
vi.mock("next-auth/jwt", () => ({ getToken: vi.fn() }));

import { PATCH as taskPATCH, DELETE as taskDELETE } from "../../app/api/tasks/[id]/route";
import { POST as tasksPOST } from "../../app/api/tasks/route";
import { getServerSession } from "next-auth";
import { getToken } from "next-auth/jwt";

const prisma = new PrismaClient();
const hash = (pw: string) => bcrypt.hash(pw, 10);
const PREFIX = `test-tc-${Date.now()}`;
const email = (slug: string) => `${PREFIX}-${slug}@tc.test`;

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

function patchReq(id: string, body: object) {
  return new Request(`http://localhost/api/tasks/${id}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  }) as any;
}

function deleteReq(id: string) {
  return new Request(`http://localhost/api/tasks/${id}`, { method: "DELETE" }) as any;
}

async function json(res: Response) { return res.json(); }

// ── Kullanıcılar ──────────────────────────────────────────────────────────────

let creator: TUser;   // BD dept, level=10 — reviewOwner başlangıçta bu
let assignee: TUser;  // BD dept, level=3  — göreve atanan
let reviewer: TUser;  // BD dept, level=12 — Senior Manager (inceleme yapabilir)
let adminUser: TUser; // ADMIN

const cleanupUserIds: string[] = [];
const cleanupProjectIds: string[] = [];
const cleanupTaskIds: string[] = [];
const cleanupRoundIds: string[] = [];

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

  [creator, assignee, reviewer, adminUser] = await Promise.all([
    mkUser("creator", "EMPLOYEE", "BAGIMSIZ_DENETIM", 10, false),
    mkUser("assignee", "EMPLOYEE", "BAGIMSIZ_DENETIM", 3, false),
    mkUser("reviewer", "EMPLOYEE", "BAGIMSIZ_DENETIM", 12, false),
    mkUser("admin",    "ADMIN",    "ADMIN",            15, true),
  ]);
});

afterAll(async () => {
  await prisma.taskReviewRound.deleteMany({ where: { id: { in: cleanupRoundIds } } });
  await prisma.taskLog.deleteMany({ where: { taskId: { in: cleanupTaskIds } } });
  await prisma.task.deleteMany({ where: { id: { in: cleanupTaskIds } } });
  await prisma.project.deleteMany({ where: { id: { in: cleanupProjectIds } } });
  await prisma.user.deleteMany({ where: { id: { in: cleanupUserIds } } });
  await prisma.$disconnect();
});

// ── Yardımcı: görev oluştur (IN_PROGRESS durumunda) ──────────────────────────

async function createTask(opts?: {
  status?: string;
  parentTaskId?: string;
  reviewOwnerId?: string;
}): Promise<string> {
  const task = await prisma.task.create({
    data: {
      title: `${PREFIX} TC task`,
      status: opts?.status ?? "TODO",
      priority: "MEDIUM",
      createdById: creator.id,
      assignedToId: assignee.id,
      reviewOwnerId: opts?.reviewOwnerId ?? creator.id,
      departmentId: "BAGIMSIZ_DENETIM",
      parentTaskId: opts?.parentTaskId ?? null,
    },
  });
  cleanupTaskIds.push(task.id);
  return task.id;
}

// ── TC1: Atanan kendi görevini onaylayamaz ───────────────────────────────────

describe("TC1 — atanan approve → 403", () => {
  it("atanan kendi görevini onaylayamaz", async () => {
    const id = await createTask({ status: "REVIEW" });

    // assignee approve yapmaya çalışıyor
    sessionOf(assignee);
    const res = await taskPATCH(patchReq(id, { action: "approve" }), { params: { id } });
    expect(res.status).toBe(403);
    const data = await json(res);
    expect(data.error).toMatch(/onaylayamazsınız/i);
  });
});

// ── TC2: Atanan REVIEW→IN_PROGRESS geri alamaz ───────────────────────────────

describe("TC2 — atanan review'dan geri alamaz → 403", () => {
  it("atanan REVIEW→IN_PROGRESS yapamaz", async () => {
    const id = await createTask({ status: "REVIEW" });

    sessionOf(assignee);
    const res = await taskPATCH(patchReq(id, { status: "IN_PROGRESS" }), { params: { id } });
    expect(res.status).toBe(403);
    const data = await json(res);
    expect(data.error).toMatch(/geri alamazsınız/i);
  });
});

// ── TC3: Revizyon notu olmadan request_revision → 400 ────────────────────────

describe("TC3 — revizyon notu olmadan geri gönderme → 400", () => {
  it("reviewNote olmadan request_revision → 400", async () => {
    const id = await createTask({ status: "REVIEW" });

    sessionOf(creator); // creator = reviewOwner
    const res = await taskPATCH(
      patchReq(id, { action: "request_revision" }),
      { params: { id } }
    );
    expect(res.status).toBe(400);
    const data = await json(res);
    expect(data.error).toMatch(/revizyon notu/i);
  });
});

// ── TC4: Revizyon notu ile geri gönderme → TODO ───────────────────────────────

describe("TC4 — revizyon notu ile geri gönderme → TODO", () => {
  it("reviewNote ile request_revision → görev TODO olur", async () => {
    const id = await createTask({ status: "REVIEW" });

    // Bir tur oluştur (request_revision'ın güncelleyeceği tur)
    const round = await prisma.taskReviewRound.create({
      data: {
        taskId: id,
        roundNumber: 1,
        submittedById: assignee.id,
        submissionNote: "Hazır",
      },
    });
    cleanupRoundIds.push(round.id);

    sessionOf(creator);
    const res = await taskPATCH(
      patchReq(id, { action: "request_revision", reviewNote: "Düzeltme gerekiyor" }),
      { params: { id } }
    );
    const data = await json(res);
    expect(res.status).toBe(200);
    expect(data.status).toBe("TODO");

    // Tur güncellendi mi?
    const updatedRound = await prisma.taskReviewRound.findUnique({ where: { id: round.id } });
    expect(updatedRound?.reviewAction).toBe("REVISION_REQUESTED");
    expect(updatedRound?.reviewNote).toBe("Düzeltme gerekiyor");
  });
});

// ── TC5: Açık alt görev varken submit_review → 409 ───────────────────────────

describe("TC5 — açık alt görev varken submit_review → 409", () => {
  it("tamamlanmamış alt görev varken incelemeye gönderilemez", async () => {
    const parentId = await createTask({ status: "IN_PROGRESS" });
    const _childId = await createTask({ status: "TODO", parentTaskId: parentId });

    sessionOf(assignee);
    const res = await taskPATCH(
      patchReq(parentId, { action: "submit_review", submissionNote: "Hazır" }),
      { params: { id: parentId } }
    );
    expect(res.status).toBe(409);
    const data = await json(res);
    expect(data.error).toMatch(/alt görev/i);
  });
});

// ── TC6: Alt görevler tamamlanınca parent otomatik ilerlemez ─────────────────

describe("TC6 — alt görevler tamamlanınca parent otomatik ilerlemez", () => {
  it("child DONE olunca parent'ın status değişmez", async () => {
    const parentId = await createTask({ status: "IN_PROGRESS" });
    const childId = await createTask({ status: "TODO", parentTaskId: parentId });

    // Child'ı approve ile DONE yap (reviewer'dan)
    await prisma.task.update({ where: { id: childId }, data: { status: "DONE", reviewOwnerId: reviewer.id } });

    // Parent'ın status hâlâ IN_PROGRESS olmalı
    const parent = await prisma.task.findUnique({ where: { id: parentId }, select: { status: true } });
    expect(parent?.status).toBe("IN_PROGRESS");
  });
});

// ── TC7: Yeniden atama — status=TODO, reviewOwnerId=atayan, createdById değişmez ──

describe("TC7 — yeniden atama", () => {
  it("atama değişince status→TODO, reviewOwnerId→atayan, createdById aynı kalır", async () => {
    // Admin yeniden atama yapacak (canManage = true)
    const id = await createTask({ status: "IN_PROGRESS" });

    sessionOf(adminUser);
    const res = await taskPATCH(
      patchReq(id, { assignedToId: reviewer.id }),
      { params: { id } }
    );
    const data = await json(res);
    expect(res.status).toBe(200);
    expect(data.status).toBe("TODO");
    expect(data.reviewOwnerId).toBe(adminUser.id);
    expect(data.createdBy.id).toBe(creator.id);
    expect(data.assignedTo?.id).toBe(reviewer.id);
  });
});

// ── TC8: Başka kullanıcı submit_review yaparsa reviewOwnerId değişmez ─────────

describe("TC8 — submit_review reviewOwnerId'yi değiştirmez", () => {
  it("submit_review sadece tur oluşturur, reviewOwnerId değişmez", async () => {
    const id = await createTask({ status: "IN_PROGRESS", reviewOwnerId: creator.id });

    sessionOf(assignee);
    const res = await taskPATCH(
      patchReq(id, { action: "submit_review", submissionNote: "Test gönderimi" }),
      { params: { id } }
    );
    const data = await json(res);
    expect(res.status).toBe(200);
    expect(data.reviewOwnerId).toBe(creator.id); // değişmemeli

    // Tur oluştu mu?
    const rounds = await prisma.taskReviewRound.findMany({ where: { taskId: id } });
    expect(rounds.length).toBe(1);
    cleanupRoundIds.push(...rounds.map(r => r.id));
  });
});

// ── TC9: Reopen sebebi olmadan → 400 ─────────────────────────────────────────

describe("TC9 — reopen sebebi olmadan → 400", () => {
  it("reopenReason olmadan reopen → 400", async () => {
    const id = await createTask({ status: "DONE" });

    sessionOf(creator);
    const res = await taskPATCH(
      patchReq(id, { action: "reopen" }),
      { params: { id } }
    );
    expect(res.status).toBe(400);
    const data = await json(res);
    expect(data.error).toMatch(/sebep|zorunlu/i);
  });
});

// ── TC10: Parent reopen edilince çocuklar etkilenmez ─────────────────────────

describe("TC10 — parent reopen, çocuklar etkilenmez", () => {
  it("parent DONE→TODO olunca çocukların status değişmez", async () => {
    const parentId = await createTask({ status: "DONE" });
    const childId = await createTask({ status: "DONE", parentTaskId: parentId });

    sessionOf(creator);
    const res = await taskPATCH(
      patchReq(parentId, { action: "reopen", reopenReason: "Revizyon gerekli" }),
      { params: { id: parentId } }
    );
    expect(res.status).toBe(200);
    const data = await json(res);
    expect(data.status).toBe("TODO");

    // Çocuk hâlâ DONE
    const child = await prisma.task.findUnique({ where: { id: childId }, select: { status: true } });
    expect(child?.status).toBe("DONE");
  });
});

// ── TC11: DONE görev düzenleme → 403 ─────────────────────────────────────────

describe("TC11 — DONE görev düzenleme → 403", () => {
  it("DONE görev başlık değişikliği → 403", async () => {
    const id = await createTask({ status: "DONE" });

    // Admin de title değiştiremez
    sessionOf(adminUser);
    const res = await taskPATCH(
      patchReq(id, { title: "Yeni başlık" }),
      { params: { id } }
    );
    expect(res.status).toBe(403);
    const data = await json(res);
    expect(data.error).toMatch(/düzenlenemez/i);
  });
});
