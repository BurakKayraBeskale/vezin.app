/**
 * Toplu silme (bulk delete) entegrasyon testleri — POST /api/tasks/bulk {action:"delete"}
 *
 * TBD1  Yetkisi olmayan bir görev seçiliyse toplu silme tamamen reddedilir → 403,
 *       hiçbir görev silinmez (kısmi uygulama yok)
 * TBD2  Açık (tamamlanmamış) alt görevi olan görev toplu silmede engellenir → 409,
 *       hiçbir görev silinmez
 * TBD3  Başarılı toplu silmede deletedAt doluyor, kayıt fiziksel olarak silinmiyor
 *       (DB'de taskId hâlâ var) ve taskLog'a DELETED kaydı düşüyor
 * TBD4  Silinen görevler ne /api/tasks listesinde ne de /api/tasks/[id] GET'inde görünür
 * TBD5  ADMIN toplu silme yaptığında hiçbir görev "yetki yok" diye engellenmiyor
 *       (regresyon: canDeleteTask'taki "atanan kişi silemez" kuralı ADMIN
 *       istisnasından ÖNCE çalışıyordu — ADMIN kendi üzerine atanmış bir görevi
 *       toplu silmeye çalışınca yanlışlıkla reddediliyordu)
 * TBD6  Engellenen görev olduğunda hata yanıtındaki "blocked" listesi görev
 *       BAŞLIĞINI içeriyor — sıra numarası/indeks değil
 * TBD7  Tekil silme (DELETE /api/tasks/[id]) ve toplu silme AYNI yetki
 *       sonucunu veriyor: aynı görev + aynı kullanıcı → ikisi de izin verir
 *       veya ikisi de reddeder (durum kodları farklı olabilir — tekil uç
 *       yetki reddini kasıtlı olarak 404 ile gizler, toplu uç 403 döner —
 *       ama silinip silinmediği sonucu aynı olmalı)
 */

import { describe, it, expect, beforeAll, afterAll, vi } from "vitest";
import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";

vi.mock("next-auth", () => ({ getServerSession: vi.fn() }));
vi.mock("next-auth/jwt", () => ({ getToken: vi.fn() }));

import { POST as bulkPOST } from "../../app/api/tasks/bulk/route";
import { GET as tasksGET } from "../../app/api/tasks/route";
import { GET as taskByIdGET, DELETE as taskDELETE } from "../../app/api/tasks/[id]/route";
import { getServerSession } from "next-auth";
import { getToken } from "next-auth/jwt";

const prisma = new PrismaClient();
const hash = (pw: string) => bcrypt.hash(pw, 10);
const PREFIX = `test-tbd-${Date.now()}`;
const email = (slug: string) => `${PREFIX}-${slug}@tbd.test`;

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

function postReq(url: string, body: object) {
  return new Request(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  }) as any;
}

function getReq(url: string) {
  return new Request(url) as any;
}

function deleteReq(id: string) {
  return new Request(`http://localhost/api/tasks/${id}`, { method: "DELETE" }) as any;
}

async function json(res: Response) { return res.json(); }

// ── Kullanıcılar ──────────────────────────────────────────────────────────────

let creator: TUser;    // BD dept, level=8 — görevleri oluşturan (silme yetkisi var)
let assignee: TUser;   // BD dept, level=3 — göreve atanan (kendi görevini silemez)
let bystander: TUser;  // BD dept, level=3 — görevle ilişkisi yok, silme yetkisi yok
let adminUser: TUser;  // ADMIN dept, role=ADMIN
let bdProject: { id: string };

const cleanupUserIds: string[] = [];
const cleanupTaskIds: string[] = [];
const cleanupProjectIds: string[] = [];

beforeAll(async () => {
  async function mkUser(slug: string, level: number): Promise<TUser> {
    const u = await prisma.user.create({
      data: {
        name: `${PREFIX} ${slug}`, email: email(slug), password: await hash("test"),
        role: "EMPLOYEE", department: "BAGIMSIZ_DENETIM", seniorityLevel: level,
        canViewAllProjects: false, overseesDepartment: null, canViewAllTasks: false,
      },
    });
    cleanupUserIds.push(u.id);
    return {
      id: u.id, email: u.email, name: u.name, role: u.role,
      department: "BAGIMSIZ_DENETIM", seniorityLevel: level, canViewAllProjects: false, overseesDepartment: null,
    };
  }

  [creator, assignee, bystander] = await Promise.all([
    mkUser("creator", 8),
    mkUser("assignee", 3),
    mkUser("bystander", 3),
  ]);

  const adminRecord = await prisma.user.create({
    data: {
      name: `${PREFIX} admin`, email: email("admin"), password: await hash("test"),
      role: "ADMIN", department: "ADMIN", seniorityLevel: 15,
      canViewAllProjects: true, overseesDepartment: null, canViewAllTasks: true,
    },
  });
  cleanupUserIds.push(adminRecord.id);
  adminUser = {
    id: adminRecord.id, email: adminRecord.email, name: adminRecord.name, role: adminRecord.role,
    department: "ADMIN", seniorityLevel: 15, canViewAllProjects: true, overseesDepartment: null,
  };

  const proj = await prisma.project.create({
    data: { name: `${PREFIX} BD Proje`, department: "BAGIMSIZ_DENETIM", createdById: creator.id },
  });
  cleanupProjectIds.push(proj.id);
  bdProject = { id: proj.id };
});

afterAll(async () => {
  await prisma.taskLog.deleteMany({ where: { taskId: { in: cleanupTaskIds } } });
  await prisma.task.deleteMany({ where: { id: { in: cleanupTaskIds } } });
  if (cleanupProjectIds.length > 0) {
    await prisma.project.deleteMany({ where: { id: { in: cleanupProjectIds } } });
  }
  await prisma.user.deleteMany({ where: { id: { in: cleanupUserIds } } });
  await prisma.$disconnect();
});

async function mkTask(opts: {
  title: string; assignedToId: string; createdById: string; parentTaskId?: string | null; status?: string;
  reviewOwnerId?: string | null; projectId?: string | null;
}): Promise<string> {
  const t = await prisma.task.create({
    data: {
      title: opts.title,
      status: opts.status ?? "TODO",
      priority: "MEDIUM",
      assignedToId: opts.assignedToId,
      createdById: opts.createdById,
      reviewOwnerId: opts.reviewOwnerId ?? null,
      projectId: opts.projectId ?? null,
      departmentId: opts.projectId ? null : "BAGIMSIZ_DENETIM",
      parentTaskId: opts.parentTaskId ?? null,
    },
  });
  cleanupTaskIds.push(t.id);
  return t.id;
}

// ── TBD1: Yetkisi olmayan görev seçiliyse toplu silme tamamen reddedilir ─────

describe("TBD1 — yetkisi olmayan görev seçiliyse toplu silme tamamen reddedilir", () => {
  it("bystander: kendi oluşturduğu (silinebilir) görev + yalnızca reviewOwner olduğu (silinemez) görev birlikte seçilirse → 403, hiçbiri silinmez", async () => {
    const ownTaskId = await mkTask({
      title: `${PREFIX} TBD1-own`, assignedToId: assignee.id, createdById: bystander.id,
    });
    // reviewOwnerId ile GÖRÜNÜR (visibility kural 9) ama canDeleteTask reviewOwner'ı
    // kontrol etmez — creator ne atanan ne oluşturan ne proje sahibi olduğundan silemez.
    const reviewOwnerOnlyTaskId = await mkTask({
      title: `${PREFIX} TBD1-review-owner-only`, assignedToId: assignee.id, createdById: creator.id,
      projectId: bdProject.id, reviewOwnerId: bystander.id,
    });

    sessionOf(bystander);
    const res = await bulkPOST(postReq("http://localhost/api/tasks/bulk", {
      ids: [ownTaskId, reviewOwnerOnlyTaskId], action: "delete",
    }));
    expect(res.status).toBe(403);
    const data = await json(res);
    expect(Array.isArray(data.blocked)).toBe(true);
    expect(data.blocked.some((b: any) => b.id === reviewOwnerOnlyTaskId)).toBe(true);

    // Kısmen uygulanmadı — ikisi de hâlâ silinmemiş durumda (silinebilir olan da dahil)
    const own = await prisma.task.findUnique({ where: { id: ownTaskId }, select: { deletedAt: true } });
    const reviewOwnerOnly = await prisma.task.findUnique({ where: { id: reviewOwnerOnlyTaskId }, select: { deletedAt: true } });
    expect(own?.deletedAt).toBeNull();
    expect(reviewOwnerOnly?.deletedAt).toBeNull();
  });

  it("assignee kendi atandığı görevi bile toplu silemez (assignedToId === user.id → canDeleteTask false)", async () => {
    const taskId = await mkTask({
      title: `${PREFIX} TBD1-self-assigned`, assignedToId: assignee.id, createdById: creator.id,
    });

    sessionOf(assignee);
    const res = await bulkPOST(postReq("http://localhost/api/tasks/bulk", {
      ids: [taskId], action: "delete",
    }));
    expect(res.status).toBe(403);

    const task = await prisma.task.findUnique({ where: { id: taskId }, select: { deletedAt: true } });
    expect(task?.deletedAt).toBeNull();
  });
});

// ── TBD2: Açık alt görevi olan görev toplu silmede engellenir ────────────────

describe("TBD2 — açık alt görevi olan görev toplu silmede engellenir", () => {
  it("tamamlanmamış alt görevi olan parent + bağımsız başka bir görev birlikte seçilirse → 409, hiçbiri silinmez", async () => {
    const parentId = await mkTask({
      title: `${PREFIX} TBD2-parent`, assignedToId: assignee.id, createdById: creator.id,
    });
    await mkTask({
      title: `${PREFIX} TBD2-child-open`, assignedToId: assignee.id, createdById: creator.id,
      parentTaskId: parentId, status: "TODO",
    });
    const independentId = await mkTask({
      title: `${PREFIX} TBD2-independent`, assignedToId: assignee.id, createdById: creator.id,
    });

    sessionOf(creator);
    const res = await bulkPOST(postReq("http://localhost/api/tasks/bulk", {
      ids: [parentId, independentId], action: "delete",
    }));
    expect(res.status).toBe(409);
    const data = await json(res);
    expect(Array.isArray(data.blocked)).toBe(true);
    expect(data.blocked).toHaveLength(1);
    expect(data.blocked[0].id).toBe(parentId);
    expect(data.blocked[0].title).toBe(`${PREFIX} TBD2-parent`);
    expect(data.blocked[0].reason).toMatch(/alt görev/i);

    // Kısmen uygulanmadı — bağımsız görev de silinmedi
    const parent = await prisma.task.findUnique({ where: { id: parentId }, select: { deletedAt: true } });
    const independent = await prisma.task.findUnique({ where: { id: independentId }, select: { deletedAt: true } });
    expect(parent?.deletedAt).toBeNull();
    expect(independent?.deletedAt).toBeNull();
  });

  it("alt görev DONE ise engel kalkar — parent normal şekilde silinebilir", async () => {
    const parentId = await mkTask({
      title: `${PREFIX} TBD2b-parent`, assignedToId: assignee.id, createdById: creator.id,
    });
    await mkTask({
      title: `${PREFIX} TBD2b-child-done`, assignedToId: assignee.id, createdById: creator.id,
      parentTaskId: parentId, status: "DONE",
    });

    sessionOf(creator);
    const res = await bulkPOST(postReq("http://localhost/api/tasks/bulk", {
      ids: [parentId], action: "delete",
    }));
    expect(res.status).toBe(200);

    const parent = await prisma.task.findUnique({ where: { id: parentId }, select: { deletedAt: true } });
    expect(parent?.deletedAt).not.toBeNull();
  });
});

// ── TBD3: Başarılı silmede deletedAt doluyor, kayıt fiziksel silinmiyor, log düşüyor ─

describe("TBD3 — başarılı toplu silme: soft-delete + geçmiş kaydı", () => {
  it("deletedAt set edilir, satır DB'de kalır, taskLog'a DELETED kaydı düşer", async () => {
    const t1 = await mkTask({ title: `${PREFIX} TBD3-a`, assignedToId: assignee.id, createdById: creator.id });
    const t2 = await mkTask({ title: `${PREFIX} TBD3-b`, assignedToId: assignee.id, createdById: creator.id });

    sessionOf(creator);
    const res = await bulkPOST(postReq("http://localhost/api/tasks/bulk", {
      ids: [t1, t2], action: "delete",
    }));
    expect(res.status).toBe(200);
    const data = await json(res);
    expect(data.deletedCount).toBe(2);
    expect(new Set(data.deletedIds)).toEqual(new Set([t1, t2]));

    for (const id of [t1, t2]) {
      const row = await prisma.task.findUnique({ where: { id } });
      // Fiziksel olarak silinmedi — satır hâlâ var
      expect(row).not.toBeNull();
      expect(row?.deletedAt).not.toBeNull();

      const log = await prisma.taskLog.findFirst({ where: { taskId: id, action: "DELETED" } });
      expect(log).not.toBeNull();
      expect(log?.userId).toBe(creator.id);
    }
  });
});

// ── TBD5: ADMIN toplu silme — hiçbir görev "yetki yok" diye engellenmiyor ────

describe("TBD5 — ADMIN toplu silme: yetkisizlik nedeniyle hiçbir görev engellenmez", () => {
  it("ADMIN'e atanmış, farklı kişilerce oluşturulmuş, proje içi/dışı 4 görev sorunsuz silinir", async () => {
    const ids = await Promise.all([
      mkTask({ title: `${PREFIX} TBD5-1`, assignedToId: adminUser.id, createdById: adminUser.id }),
      mkTask({ title: `${PREFIX} TBD5-2`, assignedToId: adminUser.id, createdById: creator.id }),
      mkTask({ title: `${PREFIX} TBD5-3`, assignedToId: adminUser.id, createdById: creator.id, projectId: bdProject.id }),
      mkTask({ title: `${PREFIX} TBD5-4`, assignedToId: adminUser.id, createdById: bystander.id }),
    ]);

    sessionOf(adminUser);
    const res = await bulkPOST(postReq("http://localhost/api/tasks/bulk", { ids, action: "delete" }));
    expect(res.status).toBe(200);
    const data = await json(res);
    expect(data.deletedCount).toBe(4);
    expect(new Set(data.deletedIds)).toEqual(new Set(ids));

    for (const id of ids) {
      const row = await prisma.task.findUnique({ where: { id }, select: { deletedAt: true } });
      expect(row?.deletedAt).not.toBeNull();
    }
  });
});

// ── TBD6: Engellenen görevin hata yanıtı BAŞLIĞI içerir, sıra numarası değil ─

describe("TBD6 — engellenen görev hata yanıtında başlık görünür", () => {
  it("403 'blocked' listesindeki title gerçek görev başlığıdır, indeks/sayaç değildir", async () => {
    const ownTitle = `${PREFIX} TBD6-own-görevi`;
    const blockedTitle = `${PREFIX} TBD6-erişilemeyen-görev`;
    const ownTaskId = await mkTask({ title: ownTitle, assignedToId: assignee.id, createdById: bystander.id });
    // reviewOwnerId ile GÖRÜNÜR ama canDeleteTask reviewOwner'ı kontrol etmediği için silinemez
    const blockedTaskId = await mkTask({
      title: blockedTitle, assignedToId: assignee.id, createdById: creator.id,
      projectId: bdProject.id, reviewOwnerId: bystander.id,
    });

    sessionOf(bystander);
    const res = await bulkPOST(postReq("http://localhost/api/tasks/bulk", {
      ids: [ownTaskId, blockedTaskId], action: "delete",
    }));
    expect(res.status).toBe(403);
    const data = await json(res);
    expect(Array.isArray(data.blocked)).toBe(true);
    expect(data.blocked).toHaveLength(1);

    const entry = data.blocked[0];
    expect(entry.id).toBe(blockedTaskId);
    // Başlık tam olarak görevin gerçek başlığı olmalı — indeks/sayaç (ör. "1") değil
    expect(entry.title).toBe(blockedTitle);
    expect(entry.title).not.toMatch(/^\d+$/);
    expect(entry.reason).toBeTruthy();
  });
});

// ── TBD7: Tekil silme ve toplu silme AYNI yetki sonucunu verir ───────────────

describe("TBD7 — tekil ve toplu silme aynı yetki sonucunu verir", () => {
  it("İzin verilen durumda: ADMIN kendi üzerine atanmış görevi hem tekil hem toplu uçtan silebilir", async () => {
    const singleTaskId = await mkTask({ title: `${PREFIX} TBD7-allow-single`, assignedToId: adminUser.id, createdById: creator.id });
    const bulkTaskId = await mkTask({ title: `${PREFIX} TBD7-allow-bulk`, assignedToId: adminUser.id, createdById: creator.id });

    sessionOf(adminUser);

    const singleRes = await taskDELETE(deleteReq(singleTaskId), { params: { id: singleTaskId } });
    expect(singleRes.status).toBe(200);

    const bulkRes = await bulkPOST(postReq("http://localhost/api/tasks/bulk", { ids: [bulkTaskId], action: "delete" }));
    expect(bulkRes.status).toBe(200);

    const singleRow = await prisma.task.findUnique({ where: { id: singleTaskId }, select: { deletedAt: true } });
    const bulkRow = await prisma.task.findUnique({ where: { id: bulkTaskId }, select: { deletedAt: true } });
    expect(singleRow?.deletedAt).not.toBeNull();
    expect(bulkRow?.deletedAt).not.toBeNull();
  });

  it("Reddedilen durumda: bystander reviewOwner-only görevi hem tekil hem toplu uçtan silemez (durum kodları farklı olabilir, sonuç aynı: silinmez)", async () => {
    const singleTaskId = await mkTask({
      title: `${PREFIX} TBD7-deny-single`, assignedToId: assignee.id, createdById: creator.id,
      projectId: bdProject.id, reviewOwnerId: bystander.id,
    });
    const bulkTaskId = await mkTask({
      title: `${PREFIX} TBD7-deny-bulk`, assignedToId: assignee.id, createdById: creator.id,
      projectId: bdProject.id, reviewOwnerId: bystander.id,
    });

    sessionOf(bystander);

    const singleRes = await taskDELETE(deleteReq(singleTaskId), { params: { id: singleTaskId } });
    // Tekil uç yetki reddini kasıtlı olarak 404 ile gizler (bkz. tasks/[id]/route.ts)
    expect(singleRes.status).toBe(404);

    const bulkRes = await bulkPOST(postReq("http://localhost/api/tasks/bulk", { ids: [bulkTaskId], action: "delete" }));
    // Toplu uç aynı reddi 403 ile açıkça bildirir (kullanıcı zaten kendi listesinden seçim yaptı)
    expect(bulkRes.status).toBe(403);

    const singleRow = await prisma.task.findUnique({ where: { id: singleTaskId }, select: { deletedAt: true } });
    const bulkRow = await prisma.task.findUnique({ where: { id: bulkTaskId }, select: { deletedAt: true } });
    // Sonuç eşdeğer: ikisi de silinmedi
    expect(singleRow?.deletedAt).toBeNull();
    expect(bulkRow?.deletedAt).toBeNull();
  });
});

// ── TBD4: Silinen görevler hiçbir listede görünmüyor ─────────────────────────

describe("TBD4 — silinen görevler hiçbir listede görünmüyor", () => {
  it("toplu silinen görev ne /api/tasks listesinde ne de tekil GET'te görünür", async () => {
    const taskId = await mkTask({ title: `${PREFIX} TBD4`, assignedToId: assignee.id, createdById: creator.id });

    sessionOf(creator);
    const delRes = await bulkPOST(postReq("http://localhost/api/tasks/bulk", { ids: [taskId], action: "delete" }));
    expect(delRes.status).toBe(200);

    // Liste ucu (getServerSession tabanlı) — silinen görev artık dönmemeli
    const listRes = await tasksGET();
    const list = await json(listRes);
    expect(list.map((t: any) => t.id)).not.toContain(taskId);

    // Tekil uç (getToken tabanlı) — 404
    const oneRes = await taskByIdGET(getReq(`http://localhost/api/tasks/${taskId}`), { params: { id: taskId } });
    expect(oneRes.status).toBe(404);
  });
});
