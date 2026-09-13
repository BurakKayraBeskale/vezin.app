/**
 * D Bloğu entegrasyon testleri — tekrarlayan görevler, bildirimler, dosya saklama
 *
 * TD1  Eski tekrar açıkken yeni tekrar yine oluşturulur
 * TD2  Atanan pasifse tekrar oluşmaz, seri sahibine bildirim gider
 * TD3  Seriyi durdurmak geçmiş görevleri silmez
 * TD4  Alt görev tamamlanınca yalnızca parent atananına bildirim gider
 * TD5  Görevi gören üst yöneticilere review bildirimi yağmaz
 * TD6  Açık görevi olan kullanıcı pasife alınamaz → 409
 * TD7  retentionUntil = completedAt + 1 yıl (approve sonrası)
 * TD8  Yeniden açılan görevde retention sıfırlanır
 * TD9  OneDrive linki (TaskAttachment type=LINK) fiziksel storage'a kopyalanmaz
 */

import { describe, it, expect, beforeAll, afterAll, vi } from "vitest";
import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";

vi.mock("next-auth", () => ({ getServerSession: vi.fn() }));
vi.mock("next-auth/jwt", () => ({ getToken: vi.fn() }));

import { PATCH as taskPATCH } from "../../app/api/tasks/[id]/route";
import { POST as tasksPOST } from "../../app/api/tasks/route";
import { PATCH as userPATCH } from "../../app/api/users/[id]/route";
import { getServerSession } from "next-auth";
import { getToken } from "next-auth/jwt";
import { generateOccurrencesForSeries } from "../../lib/recurring-test-helper";

const prisma = new PrismaClient();
const hash = (pw: string) => bcrypt.hash(pw, 10);
const PREFIX = `test-td-${Date.now()}`;
const email = (slug: string) => `${PREFIX}-${slug}@td.test`;

type TUser = {
  id: string; email: string; name: string; role: string;
  department: string; seniorityLevel: number;
  canViewAllProjects: boolean; overseesDepartment: string | null;
};

function sessionOf(u: TUser) {
  const token = {
    id: u.id, name: u.name, email: u.email, role: u.role,
    department: u.department, seniorityLevel: u.seniorityLevel,
    canViewAllProjects: u.canViewAllProjects, canViewAllTasks: u.canViewAllProjects,
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

function userPatchReq(id: string, body: object) {
  return new Request(`http://localhost/api/users/${id}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  }) as any;
}

function postReq(body: object) {
  return new Request(`http://localhost/api/tasks`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  }) as any;
}

async function json(res: Response) { return res.json(); }

// ── Kullanıcılar ──────────────────────────────────────────────────────────────
let creator: TUser;   // BD dept, level=10 — reviewOwner başlangıçta
let assignee: TUser;  // BD dept, level=3
let seniorMgr: TUser; // BD dept, level=12 — tüm BD görevlerini görür
let adminUser: TUser; // ADMIN

const cleanupUserIds: string[] = [];
const cleanupTaskIds: string[] = [];
const cleanupSeriesIds: string[] = [];
const cleanupRoundIds: string[] = [];
const cleanupFileIds: string[] = [];
const cleanupAttachmentIds: string[] = [];

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
    return { id: u.id, email: u.email, name: u.name, role: u.role,
      department: dept, seniorityLevel: level, canViewAllProjects: cvap, overseesDepartment: null };
  }

  [creator, assignee, seniorMgr, adminUser] = await Promise.all([
    mkUser("creator", "EMPLOYEE", "BAGIMSIZ_DENETIM", 10, false),
    mkUser("assignee", "EMPLOYEE", "BAGIMSIZ_DENETIM", 3, false),
    mkUser("senior",   "EMPLOYEE", "BAGIMSIZ_DENETIM", 12, false),
    mkUser("admin",    "ADMIN",    "ADMIN",            15, true),
  ]);
});

afterAll(async () => {
  await prisma.taskReviewRound.deleteMany({ where: { id: { in: cleanupRoundIds } } });
  await prisma.taskAttachment.deleteMany({ where: { id: { in: cleanupAttachmentIds } } });
  await prisma.file.deleteMany({ where: { id: { in: cleanupFileIds } } });
  await prisma.taskLog.deleteMany({ where: { taskId: { in: cleanupTaskIds } } });
  await prisma.notification.deleteMany({ where: { relatedId: { in: cleanupTaskIds } } });
  await prisma.task.deleteMany({ where: { id: { in: cleanupTaskIds } } });
  await prisma.recurringSeries.deleteMany({ where: { id: { in: cleanupSeriesIds } } });
  await prisma.user.deleteMany({ where: { id: { in: cleanupUserIds } } });
  await prisma.$disconnect();
});

// ── Yardımcı ──────────────────────────────────────────────────────────────────

async function mkTask(opts?: {
  status?: string;
  parentTaskId?: string;
  reviewOwnerId?: string;
  assignedToId?: string;
}): Promise<string> {
  const task = await prisma.task.create({
    data: {
      title: `${PREFIX} TD task`,
      status: opts?.status ?? "TODO",
      priority: "MEDIUM",
      createdById: creator.id,
      assignedToId: opts?.assignedToId ?? assignee.id,
      reviewOwnerId: opts?.reviewOwnerId ?? creator.id,
      departmentId: "BAGIMSIZ_DENETIM",
      parentTaskId: opts?.parentTaskId ?? null,
    },
  });
  cleanupTaskIds.push(task.id);
  return task.id;
}

async function countNotifs(userId: string, relatedId: string) {
  return prisma.notification.count({ where: { userId, relatedId } });
}

// ── TD1: Eski tekrar açıkken yeni tekrar yine oluşturulur ─────────────────────

describe("TD1 — eski tekrar açıkken yeni tekrar oluşur", () => {
  it("önceki occurrence TODO olsa bile yeni occurrence üretilir", async () => {
    const past = new Date(Date.now() - 2 * 86_400_000); // 2 gün önce
    const series = await prisma.recurringSeries.create({
      data: {
        title: `${PREFIX} TD1 recurring`,
        recurringType: "DAILY",
        startDate: past,
        nextOccurrenceAt: past,
        endType: "INDEFINITE",
        assignedToId: assignee.id,
        ownerId: creator.id,
        priority: "MEDIUM",
        departmentId: "BAGIMSIZ_DENETIM",
      },
    });
    cleanupSeriesIds.push(series.id);

    // İlk tekrarı elle oluştur (açık bırakıyoruz)
    const firstTask = await prisma.task.create({
      data: {
        title: series.title,
        status: "TODO", // açık kalıyor
        priority: "MEDIUM",
        createdById: creator.id,
        assignedToId: assignee.id,
        reviewOwnerId: creator.id,
        departmentId: "BAGIMSIZ_DENETIM",
        recurringSeriesId: series.id,
      },
    });
    cleanupTaskIds.push(firstTask.id);

    // generateOccurrencesForSeries çalıştır — ilk tekrar açık olsa da yeni üretmeli
    const created = await generateOccurrencesForSeries(series.id);
    if (created) cleanupTaskIds.push(created);

    expect(created).not.toBeNull(); // yeni görev oluşturuldu

    // İki görev de var: biri TODO (eski), biri yeni
    const allTasks = await prisma.task.findMany({
      where: { recurringSeriesId: series.id },
    });
    expect(allTasks.length).toBeGreaterThanOrEqual(2);
  });
});

// ── TD2: Atanan pasifse tekrar oluşmaz, bildirim gider ───────────────────────

describe("TD2 — atanan pasifse tekrar oluşmaz", () => {
  it("pasif atanan için görev oluşturulmaz, seri sahibine bildirim gider", async () => {
    // Pasif kullanıcı oluştur (open task olmayan)
    const inactiveUser = await prisma.user.create({
      data: {
        name: `${PREFIX} inactive`, email: email("inactive"),
        password: await hash("test"), role: "EMPLOYEE",
        department: "BAGIMSIZ_DENETIM", seniorityLevel: 2,
        status: "INACTIVE", canBeAssignedTasks: false,
      },
    });
    cleanupUserIds.push(inactiveUser.id);

    const past = new Date(Date.now() - 86_400_000);
    const series = await prisma.recurringSeries.create({
      data: {
        title: `${PREFIX} TD2 recurring`,
        recurringType: "DAILY",
        startDate: past,
        nextOccurrenceAt: past,
        endType: "INDEFINITE",
        assignedToId: inactiveUser.id,
        ownerId: creator.id,
        priority: "MEDIUM",
        departmentId: "BAGIMSIZ_DENETIM",
      },
    });
    cleanupSeriesIds.push(series.id);

    const notifsBefore = await prisma.notification.count({ where: { userId: creator.id } });

    const created = await generateOccurrencesForSeries(series.id);
    expect(created).toBeNull(); // görev oluşturulmamalı

    const notifsAfter = await prisma.notification.count({ where: { userId: creator.id } });
    expect(notifsAfter).toBeGreaterThan(notifsBefore); // seri sahibine bildirim gitti
  });
});

// ── TD3: Seriyi durdurmak geçmiş görevleri silmez ────────────────────────────

describe("TD3 — seriyi durdurmak geçmiş görevleri silmez", () => {
  it("isStopped=true olan serinin mevcut görevleri korunur", async () => {
    const past = new Date(Date.now() - 86_400_000);
    const series = await prisma.recurringSeries.create({
      data: {
        title: `${PREFIX} TD3 recurring`,
        recurringType: "DAILY",
        startDate: past,
        nextOccurrenceAt: new Date(Date.now() + 86_400_000), // gelecekte
        endType: "INDEFINITE",
        assignedToId: assignee.id,
        ownerId: creator.id,
        priority: "MEDIUM",
        departmentId: "BAGIMSIZ_DENETIM",
      },
    });
    cleanupSeriesIds.push(series.id);

    // Mevcut görev oluştur
    const existingTask = await prisma.task.create({
      data: {
        title: series.title,
        status: "IN_PROGRESS",
        priority: "MEDIUM",
        createdById: creator.id,
        assignedToId: assignee.id,
        reviewOwnerId: creator.id,
        departmentId: "BAGIMSIZ_DENETIM",
        recurringSeriesId: series.id,
      },
    });
    cleanupTaskIds.push(existingTask.id);

    // Seriyi durdur
    await prisma.recurringSeries.update({
      where: { id: series.id },
      data: { isStopped: true },
    });

    // Eski görev hâlâ var olmalı
    const stillExists = await prisma.task.findUnique({
      where: { id: existingTask.id },
      select: { id: true, status: true, deletedAt: true },
    });
    expect(stillExists).not.toBeNull();
    expect(stillExists?.deletedAt).toBeNull();
    expect(stillExists?.status).toBe("IN_PROGRESS");

    // Yeni görev üretilmemeli
    const newCreated = await generateOccurrencesForSeries(series.id);
    expect(newCreated).toBeNull();
  });
});

// ── TD4: Alt görev tamamlanınca yalnızca parent atananına bildirim ─────────────

describe("TD4 — alt görev tamamlanınca bildirim yalnızca parent atananına", () => {
  it("approve sonrası yalnızca parent.assignedToId bildirim alır", async () => {
    const parentId = await mkTask({ status: "IN_PROGRESS", reviewOwnerId: creator.id });
    const childId = await mkTask({ status: "REVIEW", parentTaskId: parentId, reviewOwnerId: creator.id });

    // Mevcut bildirimleri temizle
    await prisma.notification.deleteMany({
      where: { relatedId: { in: [parentId, childId] } },
    });

    // creator (reviewOwner) çocuk görevi onaylıyor
    sessionOf(creator);
    const res = await taskPATCH(patchReq(childId, { action: "approve" }), { params: { id: childId } });
    expect(res.status).toBe(200);

    // parent atananı (assignee) bildirim almış olmalı
    const parentAssigneeNotifs = await countNotifs(assignee.id, parentId);
    expect(parentAssigneeNotifs).toBeGreaterThan(0);

    // seniorMgr (sadece görüntüleme yetkisi var) bildirim almamış olmalı
    const seniorNotifs = await countNotifs(seniorMgr.id, childId);
    expect(seniorNotifs).toBe(0);
    const seniorParentNotifs = await countNotifs(seniorMgr.id, parentId);
    expect(seniorParentNotifs).toBe(0);
  });
});

// ── TD5: Üst yönetici review bildirimi almaz ──────────────────────────────────

describe("TD5 — üst yöneticiye review bildirimi yağmaz", () => {
  it("submit_review sadece reviewOwner'a bildirim gönderir, seniorMgr almaz", async () => {
    // creator = reviewOwner, seniorMgr sadece görüntüleyebilir
    const taskId = await mkTask({ status: "IN_PROGRESS", reviewOwnerId: creator.id });

    // Bir tur oluştur (submit_review için gerekli değil ama test'i netleştirmek için)
    await prisma.notification.deleteMany({ where: { relatedId: taskId } });

    sessionOf(assignee);
    const res = await taskPATCH(
      patchReq(taskId, { action: "submit_review", submissionNote: "Hazır" }),
      { params: { id: taskId } }
    );
    expect(res.status).toBe(200);

    // creator (reviewOwner) bildirim almalı
    const creatorNotifs = await countNotifs(creator.id, taskId);
    expect(creatorNotifs).toBeGreaterThan(0);

    // seniorMgr bildirim almamalı
    const seniorNotifs = await countNotifs(seniorMgr.id, taskId);
    expect(seniorNotifs).toBe(0);
  });
});

// ── TD6: Açık görevi olan kullanıcı pasife alınamaz → 409 ────────────────────

describe("TD6 — açık görevi olan kullanıcı pasife alınamaz", () => {
  it("status=INACTIVE isteği → 409 when open tasks exist", async () => {
    // Assignee'nin üzerinde açık görev var (mkTask içinde oluşturuldu)
    const _taskId = await mkTask({ status: "IN_PROGRESS", assignedToId: assignee.id });

    sessionOf(adminUser);
    const res = await userPATCH(
      userPatchReq(assignee.id, { status: "INACTIVE" }),
      { params: { id: assignee.id } }
    );
    expect(res.status).toBe(409);
    const data = await json(res);
    expect(data.error).toMatch(/tamamlanmamış görev/i);
  });
});

// ── TD7: retentionUntil = completedAt + 1 yıl ────────────────────────────────

describe("TD7 — retentionUntil = completedAt + 1 yıl", () => {
  it("approve sonrası File.retentionUntil completedAt + 365 gün olur", async () => {
    const taskId = await mkTask({ status: "REVIEW" });

    // Dosya kaydı oluştur
    const file = await prisma.file.create({
      data: {
        taskId,
        uploadedById: assignee.id,
        filename: "test.pdf",
        path: "/tmp/test.pdf",
      },
    });
    cleanupFileIds.push(file.id);

    // Tur oluştur (approve gerektirir)
    const round = await prisma.taskReviewRound.create({
      data: { taskId, roundNumber: 1, submittedById: assignee.id, submissionNote: "Hazır" },
    });
    cleanupRoundIds.push(round.id);

    sessionOf(creator);
    const beforeApprove = Date.now();
    const res = await taskPATCH(patchReq(taskId, { action: "approve" }), { params: { id: taskId } });
    expect(res.status).toBe(200);

    const updatedFile = await prisma.file.findUnique({
      where: { id: file.id },
      select: { retentionUntil: true },
    });
    expect(updatedFile?.retentionUntil).not.toBeNull();

    // retentionUntil ≈ completedAt + 1 yıl (±5 dakika tolerans)
    const expectedMin = new Date(beforeApprove + 365 * 24 * 60 * 60 * 1000 - 5 * 60 * 1000);
    const expectedMax = new Date(beforeApprove + 365 * 24 * 60 * 60 * 1000 + 5 * 60 * 1000);
    expect(updatedFile!.retentionUntil!.getTime()).toBeGreaterThan(expectedMin.getTime());
    expect(updatedFile!.retentionUntil!.getTime()).toBeLessThan(expectedMax.getTime());
  });
});

// ── TD8: Yeniden açılan görevde retention sıfırlanır ─────────────────────────

describe("TD8 — reopen retention sıfırlar", () => {
  it("reopen sonrası File.retentionUntil null olur", async () => {
    const taskId = await mkTask({ status: "DONE" });

    // Dosya kaydı — zaten retentionUntil atanmış gibi simüle et
    const oneYearLater = new Date(Date.now() + 365 * 24 * 60 * 60 * 1000);
    const file = await prisma.file.create({
      data: {
        taskId,
        uploadedById: assignee.id,
        filename: "report.pdf",
        path: "/tmp/report.pdf",
        retentionUntil: oneYearLater,
      },
    });
    cleanupFileIds.push(file.id);

    sessionOf(creator);
    const res = await taskPATCH(
      patchReq(taskId, { action: "reopen", reopenReason: "Revizyon gerekli" }),
      { params: { id: taskId } }
    );
    expect(res.status).toBe(200);

    const updatedFile = await prisma.file.findUnique({
      where: { id: file.id },
      select: { retentionUntil: true },
    });
    expect(updatedFile?.retentionUntil).toBeNull();
  });
});

// ── TD9: OneDrive linki fiziksel storage'a kopyalanmaz ───────────────────────

describe("TD9 — OneDrive linki retention dışı", () => {
  it("TaskAttachment type=LINK için retentionUntil hiç atanmaz", async () => {
    const taskId = await mkTask({ status: "REVIEW" });

    // LINK türü ek (OneDrive/SharePoint linki)
    const att = await prisma.taskAttachment.create({
      data: {
        taskId,
        kind: "SUBMISSION",
        type: "LINK",
        name: "OneDrive Linki",
        url: "https://vezin.sharepoint.com/document123",
        uploadedById: assignee.id,
        // retentionUntil: null (atanmamış — linkler retention dışı)
      },
    });
    cleanupAttachmentIds.push(att.id);

    // Tur oluştur ve approve et
    const round = await prisma.taskReviewRound.create({
      data: { taskId, roundNumber: 1, submittedById: assignee.id, submissionNote: "Link eklendi" },
    });
    cleanupRoundIds.push(round.id);

    sessionOf(creator);
    const res = await taskPATCH(patchReq(taskId, { action: "approve" }), { params: { id: taskId } });
    expect(res.status).toBe(200);

    // LINK türü ek için retentionUntil ATANMAMALI
    const updatedAtt = await prisma.taskAttachment.findUnique({
      where: { id: att.id },
      select: { retentionUntil: true },
    });
    expect(updatedAtt?.retentionUntil).toBeNull();
  });
});

// ── TD10: Tekrarlayan görev oluşturunca RecurringSeries oluşur ──────────────

describe("TD10 — tekrarlayan görev oluşturunca RecurringSeries oluşur", () => {
  it("isRecurring=true ile POST /api/tasks → Task.recurringSeriesId dolu ve RecurringSeries kaydı doğru", async () => {
    sessionOf(creator);
    const res = await tasksPOST(postReq({
      title: `${PREFIX} TD10 recurring`,
      priority: "MEDIUM",
      assignedToId: assignee.id,
      isRecurring: true,
      recurringType: "WEEKLY",
      recurringDay: 2,
    }));
    expect(res.status).toBe(201);
    const created = await json(res);
    cleanupTaskIds.push(created.id);

    expect(created.recurringSeriesId).toBeTruthy();

    const series = await prisma.recurringSeries.findUnique({ where: { id: created.recurringSeriesId } });
    expect(series).not.toBeNull();
    cleanupSeriesIds.push(series!.id);
    expect(series?.assignedToId).toBe(assignee.id);
    expect(series?.ownerId).toBe(creator.id);
    expect(series?.recurringType).toBe("WEEKLY");
    expect(series?.recurringDay).toBe(2);
    expect(series?.isStopped).toBe(false);
    // nextOccurrenceAt gelecekte olmalı (ilk occurrence az önce elle oluşturuldu)
    expect(series!.nextOccurrenceAt.getTime()).toBeGreaterThan(Date.now());
  });

  it("isRecurring=false → RecurringSeries oluşturulmaz", async () => {
    sessionOf(creator);
    const res = await tasksPOST(postReq({
      title: `${PREFIX} TD10 non-recurring`,
      priority: "MEDIUM",
      assignedToId: assignee.id,
    }));
    expect(res.status).toBe(201);
    const created = await json(res);
    cleanupTaskIds.push(created.id);
    expect(created.recurringSeriesId ?? null).toBeNull();
  });
});

// ── TD11: Reopen sonrası tekrar tamamlanınca retention yeniden başlar ────────

describe("TD11 — reopen sonrası tekrar tamamlanınca retention yeniden başlar", () => {
  it("reopen retention'ı sıfırlar, tekrar approve retention'ı yeniden başlatır", async () => {
    const taskId = await mkTask({ status: "DONE" });
    const file = await prisma.file.create({
      data: {
        taskId,
        uploadedById: assignee.id,
        filename: "yeniden.pdf",
        path: "/tmp/yeniden.pdf",
        retentionUntil: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000),
      },
    });
    cleanupFileIds.push(file.id);

    sessionOf(creator);
    const reopenRes = await taskPATCH(
      patchReq(taskId, { action: "reopen", reopenReason: "Tekrar kontrol gerekli" }),
      { params: { id: taskId } }
    );
    expect(reopenRes.status).toBe(200);

    const afterReopen = await prisma.file.findUnique({ where: { id: file.id }, select: { retentionUntil: true } });
    expect(afterReopen?.retentionUntil).toBeNull();

    // Görevi tekrar incelemeye al (workflow geçişleri C/B bloklarında test edildi — burada doğrudan set)
    await prisma.task.update({ where: { id: taskId }, data: { status: "REVIEW" } });
    const round = await prisma.taskReviewRound.create({
      data: { taskId, roundNumber: 2, submittedById: assignee.id, submissionNote: "Tekrar hazır" },
    });
    cleanupRoundIds.push(round.id);

    const beforeApprove = Date.now();
    const approveRes = await taskPATCH(patchReq(taskId, { action: "approve" }), { params: { id: taskId } });
    expect(approveRes.status).toBe(200);

    const afterApprove = await prisma.file.findUnique({ where: { id: file.id }, select: { retentionUntil: true } });
    expect(afterApprove?.retentionUntil).not.toBeNull();
    const expectedMin = new Date(beforeApprove + 365 * 24 * 60 * 60 * 1000 - 5 * 60 * 1000);
    const expectedMax = new Date(beforeApprove + 365 * 24 * 60 * 60 * 1000 + 5 * 60 * 1000);
    expect(afterApprove!.retentionUntil!.getTime()).toBeGreaterThan(expectedMin.getTime());
    expect(afterApprove!.retentionUntil!.getTime()).toBeLessThan(expectedMax.getTime());
  });
});
