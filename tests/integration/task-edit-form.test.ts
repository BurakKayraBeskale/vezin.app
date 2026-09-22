/**
 * TASK EDIT FORM DÜZENLEMESİ — entegrasyon testleri
 *
 * Ortak TaskForm (mode="create"|"edit") ve PATCH /api/tasks/[id]'in yeni
 * tekil-atanan / departman-immutable / proje taşıma davranışını test eder.
 *
 * Senaryolar (görev metnindeki 14 madde + proje taşıma/denetim kaydı ekleri):
 *   E1  Tek atanan — assignedToId zorunlu, boş bırakılamaz
 *   E2  Atanmamış kaydedilemiyor (assignedToId: "" → 400)
 *   E3  Aynı seviyedeki kullanıcı seçilemiyor → 403
 *   E4  Üst seviyedeki kullanıcı seçilemiyor → 403
 *   E5  Projeli task'ta proje üyesi olmayan kullanıcı seçilemiyor → 403
 *   E6  Department değiştirilemiyor (body'de gönderilse de yok sayılır)
 *   E7  Project: Projesiz → Proje
 *   E8  Project: Proje → Projesiz (departman korunur)
 *   E9  Reassignment: status → Yapılacak (TODO)
 *   E10 Reassignment: reviewOwnerId → işlemi yapan kullanıcı
 *   E11 created_by değişmiyor
 *   E12 Tamamlanmış (DONE) görev düzenlenemiyor
 *   E13 Atanan kişi kendi görevinin ana bilgilerini düzenleyemiyor
 *   E14 TaskForm tek ortak bileşen — eski NewTaskModal/TaskFormModal kaldırıldı
 *   E15 Proje, görevin departmanıyla eşleşmeli — farklı departman → 400
 *   E16 Alt görevin projesi tek başına değiştirilemez → 400
 *   E17 canMoveTaskToProject canManageTask'tan dar — salt reviewOwner proje taşıyamaz
 *   E18 assignmentLevelSnapshot yeniden atamada güncellenir
 *   E19 Denetim kaydı: REASSIGNED / PROJECT_CHANGED TaskLog satırı oluşur
 *   E20 Proje taşınınca alt görev ağacı cascade edilir; uygun olmayan torun taşımayı engeller
 */

import { describe, it, expect, beforeAll, afterAll, vi } from "vitest";
import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";
import fs from "fs";
import path from "path";

vi.mock("next-auth", () => ({ getServerSession: vi.fn() }));
vi.mock("next-auth/jwt", () => ({ getToken: vi.fn() }));

import { PATCH as taskPATCH } from "../../app/api/tasks/[id]/route";
import { getToken } from "next-auth/jwt";

const prisma = new PrismaClient();
const hash = (pw: string) => bcrypt.hash(pw, 10);
const PREFIX = `test-edit-${Date.now()}`;
const email = (slug: string) => `${PREFIX}-${slug}@edit.test`;

type TUser = {
  id: string; email: string; name: string; role: string; department: string;
  seniorityLevel: number; canViewAllProjects: boolean; overseesDepartment: string | null;
};

function asUser(u: TUser) {
  const token = {
    id: u.id, name: u.name, email: u.email, role: u.role,
    department: u.department, seniorityLevel: u.seniorityLevel,
    canViewAllProjects: u.canViewAllProjects, overseesDepartment: u.overseesDepartment,
  };
  vi.mocked(getToken).mockResolvedValue(token as any);
}

function patchReq(id: string, body: object) {
  return new Request(`http://localhost/api/tasks/${id}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  }) as any;
}

async function json(res: Response) { return res.json(); }

const cleanupUserIds: string[] = [];
const cleanupProjectIds: string[] = [];
const cleanupTaskIds: string[] = [];

let admin: TUser;        // ADMIN — sınırsız
let seniorMgr: TUser;    // BAGIMSIZ_DENETIM, level=11 — canManageTask + canMoveTaskToProject
let lowReviewOwner: TUser; // BAGIMSIZ_DENETIM, level=3 — yalnızca reviewOwner olduğu görevi yönetebilir, proje taşıyamaz
let assistant: TUser;    // BAGIMSIZ_DENETIM, level=2 — atanan
let sameLevelPeer: TUser;// BAGIMSIZ_DENETIM, level=11 — seniorMgr ile aynı seviye
let higherLevel: TUser;  // BAGIMSIZ_DENETIM, level=12 — seniorMgr'dan üst
let nonMember: TUser;    // BAGIMSIZ_DENETIM, level=1 — projeye üye değil

let projA: string; // BAGIMSIZ_DENETIM projesi — assistant üye
let projB: string; // BAGIMSIZ_DENETIM projesi — assistant ÜYE DEĞİL
let projC: string; // BAGIMSIZ_DENETIM projesi — assistant üye, nonMember ÜYE DEĞİL
let projMuhasebe: string; // MUHASEBE projesi (farklı departman)

async function mkUser(slug: string, role: string, dept: string, level: number, cvap = false): Promise<TUser> {
  const u = await prisma.user.create({
    data: {
      name: `${PREFIX} ${slug}`, email: email(slug), password: await hash("test"),
      role, department: dept, seniorityLevel: level, canViewAllProjects: cvap,
    },
  });
  cleanupUserIds.push(u.id);
  return { id: u.id, email: u.email, name: u.name, role: u.role, department: dept, seniorityLevel: level, canViewAllProjects: cvap, overseesDepartment: null };
}

async function createTask(opts: {
  status?: string;
  projectId?: string | null;
  departmentId?: string | null;
  assignedToId?: string | null;
  reviewOwnerId?: string;
  parentTaskId?: string | null;
  createdById?: string;
}): Promise<string> {
  const projectId = opts.projectId ?? null;
  // departmentId açıkça verilmişse (null dahil) onu kullan; yoksa projeye göre türet.
  const departmentId = "departmentId" in opts ? opts.departmentId! : (projectId ? null : "BAGIMSIZ_DENETIM");
  const task = await prisma.task.create({
    data: {
      title: `${PREFIX} task`,
      status: opts.status ?? "TODO",
      priority: "MEDIUM",
      createdById: opts.createdById ?? seniorMgr.id,
      assignedToId: opts.assignedToId ?? assistant.id,
      reviewOwnerId: opts.reviewOwnerId ?? seniorMgr.id,
      projectId,
      departmentId,
      parentTaskId: opts.parentTaskId ?? null,
    },
  });
  cleanupTaskIds.push(task.id);
  return task.id;
}

beforeAll(async () => {
  [admin, seniorMgr, lowReviewOwner, assistant, sameLevelPeer, higherLevel, nonMember] = await Promise.all([
    mkUser("admin", "ADMIN", "ADMIN", 15, true),
    mkUser("senior-mgr", "EMPLOYEE", "BAGIMSIZ_DENETIM", 11),
    mkUser("low-review-owner", "EMPLOYEE", "BAGIMSIZ_DENETIM", 3),
    mkUser("assistant", "EMPLOYEE", "BAGIMSIZ_DENETIM", 2),
    mkUser("same-level-peer", "EMPLOYEE", "BAGIMSIZ_DENETIM", 11),
    mkUser("higher-level", "EMPLOYEE", "BAGIMSIZ_DENETIM", 12),
    mkUser("non-member", "EMPLOYEE", "BAGIMSIZ_DENETIM", 1),
  ]);

  const [pa, pb, pc, pm] = await Promise.all([
    prisma.project.create({ data: { name: `${PREFIX} Proje A`, department: "BAGIMSIZ_DENETIM", createdById: seniorMgr.id } }),
    prisma.project.create({ data: { name: `${PREFIX} Proje B`, department: "BAGIMSIZ_DENETIM", createdById: seniorMgr.id } }),
    prisma.project.create({ data: { name: `${PREFIX} Proje C`, department: "BAGIMSIZ_DENETIM", createdById: seniorMgr.id } }),
    prisma.project.create({ data: { name: `${PREFIX} Proje Muhasebe`, department: "MUHASEBE", createdById: seniorMgr.id } }),
  ]);
  projA = pa.id; projB = pb.id; projC = pc.id; projMuhasebe = pm.id;
  cleanupProjectIds.push(projA, projB, projC, projMuhasebe);

  await prisma.projectMember.createMany({
    data: [
      { projectId: projA, userId: assistant.id, assignedBy: seniorMgr.id },
      { projectId: projA, userId: seniorMgr.id, assignedBy: seniorMgr.id },
      // projB: assistant ÜYE DEĞİL — E5/E7 senaryoları için kasıtlı
      { projectId: projB, userId: seniorMgr.id, assignedBy: seniorMgr.id },
      // projC: assistant üye, nonMember DEĞİL — E20'de yalnızca torunun uygunsuzluğunu izole eder
      { projectId: projC, userId: assistant.id, assignedBy: seniorMgr.id },
      { projectId: projC, userId: seniorMgr.id, assignedBy: seniorMgr.id },
    ],
  });
});

afterAll(async () => {
  await prisma.taskLog.deleteMany({ where: { taskId: { in: cleanupTaskIds } } });
  await prisma.task.deleteMany({ where: { id: { in: cleanupTaskIds } } });
  await prisma.projectMember.deleteMany({ where: { projectId: { in: cleanupProjectIds } } });
  await prisma.project.deleteMany({ where: { id: { in: cleanupProjectIds } } });
  await prisma.user.deleteMany({ where: { id: { in: cleanupUserIds } } });
  await prisma.$disconnect();
});

// ── E1/E2: Tek atanan zorunlu ────────────────────────────────────────────────

describe("E1/E2 — atanan kişi zorunlu, tekil", () => {
  it("assignedToId boş string → 400, atama değişmez", async () => {
    const id = await createTask({});
    asUser(seniorMgr);
    const res = await taskPATCH(patchReq(id, { assignedToId: "" }), { params: { id } });
    expect(res.status).toBe(400);
    const data = await json(res);
    expect(data.error).toMatch(/zorunlu/i);
    const t = await prisma.task.findUnique({ where: { id } });
    expect(t?.assignedToId).toBe(assistant.id);
  });

  it("assignedToId null → 400", async () => {
    const id = await createTask({});
    asUser(seniorMgr);
    const res = await taskPATCH(patchReq(id, { assignedToId: null }), { params: { id } });
    expect(res.status).toBe(400);
  });

  it("geçerli tek assignedToId → 200, tek kişiye atanır", async () => {
    const id = await createTask({});
    asUser(seniorMgr);
    // nonMember departmanı uygun (BAGIMSIZ_DENETIM), projesiz görev → departman kapsamı yeterli
    const res = await taskPATCH(patchReq(id, { assignedToId: nonMember.id }), { params: { id } });
    expect(res.status).toBe(200);
    const data = await json(res);
    expect(data.assignedToId).toBe(nonMember.id);
  });
});

// ── E3/E4: Kıdem kuralı ──────────────────────────────────────────────────────

describe("E3/E4 — kıdem kuralı (yalnızca kesin düşük kıdemli seçilebilir)", () => {
  it("aynı seviyedeki kullanıcı seçilemiyor → 403", async () => {
    const id = await createTask({});
    asUser(seniorMgr); // level 11
    const res = await taskPATCH(patchReq(id, { assignedToId: sameLevelPeer.id }), { params: { id } }); // level 11
    expect(res.status).toBe(403);
    const t = await prisma.task.findUnique({ where: { id } });
    expect(t?.assignedToId).toBe(assistant.id); // değişmedi
  });

  it("üst seviyedeki kullanıcı seçilemiyor → 403", async () => {
    const id = await createTask({});
    asUser(seniorMgr); // level 11
    const res = await taskPATCH(patchReq(id, { assignedToId: higherLevel.id }), { params: { id } }); // level 12
    expect(res.status).toBe(403);
  });

  it("kesin düşük kıdemli kullanıcı seçilebiliyor → 200", async () => {
    // Başlangıçtaki atanan seniorMgr (aktör) DEĞİL — atanan kendi görevini
    // yönetemez kuralı burada devreye girmesin diye.
    const id = await createTask({ assignedToId: higherLevel.id });
    asUser(seniorMgr);
    const res = await taskPATCH(patchReq(id, { assignedToId: assistant.id }), { params: { id } }); // level 2 < 11
    expect(res.status).toBe(200);
    const data = await json(res);
    expect(data.assignedToId).toBe(assistant.id);
  });
});

// ── E5: Proje üyeliği ────────────────────────────────────────────────────────

describe("E5 — projeli task'ta proje üyesi olmayan kullanıcı seçilemiyor", () => {
  it("projB üyesi olmayan assistant, projB'deki bir göreve atanamaz → 403", async () => {
    // Başlangıçtaki atanan seniorMgr (aktör) DEĞİL — atanan kendi görevini
    // yönetemez kuralı burada devreye girmesin diye.
    const id = await createTask({ projectId: projB, assignedToId: higherLevel.id, departmentId: null });
    asUser(seniorMgr);
    const res = await taskPATCH(patchReq(id, { assignedToId: assistant.id }), { params: { id } });
    expect(res.status).toBe(403);
  });
});

// ── E6: Departman değiştirilemez ─────────────────────────────────────────────

describe("E6 — department değiştirilemiyor", () => {
  it("body'de departmentId gönderilse de görmezden gelinir", async () => {
    const id = await createTask({});
    asUser(seniorMgr);
    const res = await taskPATCH(
      patchReq(id, { title: `${PREFIX} yeni başlık`, departmentId: "MUHASEBE" }),
      { params: { id } }
    );
    expect(res.status).toBe(200);
    const t = await prisma.task.findUnique({ where: { id } });
    expect(t?.departmentId).toBe("BAGIMSIZ_DENETIM"); // değişmedi
    expect(t?.title).toBe(`${PREFIX} yeni başlık`); // diğer alan işlendi
  });
});

// ── E7/E8: Proje bağlama / çözme ─────────────────────────────────────────────

describe("E7 — Projesiz → Proje", () => {
  it("departman uyumlu projeye taşınabilir, projesiz→proje", async () => {
    const id = await createTask({ assignedToId: assistant.id }); // BAGIMSIZ_DENETIM, projesiz
    asUser(seniorMgr);
    const res = await taskPATCH(patchReq(id, { projectId: projA }), { params: { id } });
    expect(res.status).toBe(200);
    const data = await json(res);
    expect(data.projectId).toBe(projA);
    expect(data.departmentId).toBeNull();
  });

  it("farklı departmandaki projeye taşınamaz (proje, görevin departmanıyla eşleşmeli) → 400", async () => {
    const id = await createTask({ assignedToId: assistant.id }); // BAGIMSIZ_DENETIM
    asUser(seniorMgr);
    const res = await taskPATCH(patchReq(id, { projectId: projMuhasebe }), { params: { id } });
    expect(res.status).toBe(400);
    const t = await prisma.task.findUnique({ where: { id } });
    expect(t?.projectId).toBeNull();
  });
});

describe("E8 — Proje → Projesiz", () => {
  it("projesiz yapılınca departman korunur (proje'nin departmanına göre türetilir)", async () => {
    const id = await createTask({ projectId: projA, assignedToId: assistant.id, departmentId: null });
    asUser(seniorMgr);
    const res = await taskPATCH(patchReq(id, { projectId: "" }), { params: { id } });
    expect(res.status).toBe(200);
    const data = await json(res);
    expect(data.projectId).toBeNull();
    expect(data.departmentId).toBe("BAGIMSIZ_DENETIM");
  });
});

// ── E9/E10/E11: Reassignment yan etkileri ────────────────────────────────────

describe("E9/E10/E11 — reassignment yan etkileri", () => {
  it("atama değişince status→TODO, reviewOwnerId→işlemi yapan, createdById değişmez", async () => {
    const id = await createTask({ status: "IN_PROGRESS", createdById: lowReviewOwner.id, reviewOwnerId: lowReviewOwner.id });
    asUser(admin);
    const res = await taskPATCH(patchReq(id, { assignedToId: nonMember.id }), { params: { id } });
    expect(res.status).toBe(200);
    const data = await json(res);
    expect(data.status).toBe("TODO");
    expect(data.reviewOwnerId).toBe(admin.id);
    expect(data.createdBy.id).toBe(lowReviewOwner.id);
  });
});

// ── E12: DONE görev düzenlenemez ─────────────────────────────────────────────

describe("E12 — tamamlanmış görev düzenlenemiyor", () => {
  it("DONE görevde title değişikliği → 403", async () => {
    const id = await createTask({ status: "DONE" });
    asUser(seniorMgr);
    const res = await taskPATCH(patchReq(id, { title: "değişecek mi" }), { params: { id } });
    expect(res.status).toBe(403);
  });

  it("DONE görevde projectId değişikliği de reddedilir", async () => {
    const id = await createTask({ status: "DONE" });
    asUser(seniorMgr);
    const res = await taskPATCH(patchReq(id, { projectId: projA }), { params: { id } });
    expect(res.status).toBe(403);
  });
});

// ── E13: Atanan kişi kendi görevini düzenleyemez ─────────────────────────────

describe("E13 — atanan kişi ana bilgileri düzenleyemiyor", () => {
  it("kendi görevine title güncellemesi → 400 (Güncellenecek alan yok)", async () => {
    const id = await createTask({ assignedToId: assistant.id, reviewOwnerId: seniorMgr.id });
    asUser(assistant);
    const res = await taskPATCH(patchReq(id, { title: "kendim değiştiriyorum" }), { params: { id } });
    expect(res.status).toBe(400);
    const t = await prisma.task.findUnique({ where: { id } });
    expect(t?.title).toBe(`${PREFIX} task`);
  });
});

// ── E14: Tek ortak form bileşeni ─────────────────────────────────────────────

describe("E14 — TaskForm tek ortak bileşen", () => {
  const componentsDir = path.resolve(__dirname, "../../components");

  it("components/TaskForm.tsx mevcut ve mode=create|edit destekliyor", () => {
    const src = fs.readFileSync(path.join(componentsDir, "TaskForm.tsx"), "utf8");
    expect(src).toMatch(/mode:\s*"create"\s*\|\s*"edit"/);
    expect(src).toMatch(/PRIORITY_OPTIONS/);
  });

  it("eski NewTaskModal.tsx ve TaskFormModal.tsx kaldırıldı", () => {
    expect(fs.existsSync(path.join(componentsDir, "NewTaskModal.tsx"))).toBe(false);
    expect(fs.existsSync(path.join(componentsDir, "TaskFormModal.tsx"))).toBe(false);
  });

  it("hiçbir bileşen artık NewTaskModal/TaskFormModal import etmiyor", () => {
    const files = fs.readdirSync(componentsDir).filter((f) => f.endsWith(".tsx"));
    for (const f of files) {
      const src = fs.readFileSync(path.join(componentsDir, f), "utf8");
      expect(src).not.toMatch(/from ["']\.\/NewTaskModal["']/);
      expect(src).not.toMatch(/from ["']\.\/TaskFormModal["']/);
    }
  });
});

// ── E15/E16/E17: Proje taşıma kuralları ──────────────────────────────────────

describe("E16 — alt görevin projesi tek başına değiştirilemez", () => {
  it("parentTaskId'si olan görevde projectId değişikliği → 400", async () => {
    const parentId = await createTask({ projectId: projA, assignedToId: assistant.id, departmentId: null });
    const childId = await createTask({ projectId: projA, assignedToId: assistant.id, departmentId: null, parentTaskId: parentId });
    asUser(seniorMgr);
    const res = await taskPATCH(patchReq(childId, { projectId: projB }), { params: { id: childId } });
    expect(res.status).toBe(400);
  });
});

describe("E17 — canMoveTaskToProject canManageTask'tan dar", () => {
  it("salt reviewOwner (yönetici/Senior Manager değil) başlığı düzenleyebilir ama projeyi taşıyamaz", async () => {
    const id = await createTask({ reviewOwnerId: lowReviewOwner.id, assignedToId: assistant.id });
    asUser(lowReviewOwner);

    const titleRes = await taskPATCH(patchReq(id, { title: "reviewOwner düzenledi" }), { params: { id } });
    expect(titleRes.status).toBe(200);

    const moveRes = await taskPATCH(patchReq(id, { projectId: projA }), { params: { id } });
    expect(moveRes.status).toBe(403);
  });
});

// ── E18: assignmentLevelSnapshot ─────────────────────────────────────────────

describe("E18 — assignmentLevelSnapshot yeniden atamada güncellenir", () => {
  it("atayanın kıdem seviyesi snapshot olarak yazılır", async () => {
    const id = await createTask({});
    asUser(seniorMgr); // level 11
    const res = await taskPATCH(patchReq(id, { assignedToId: nonMember.id }), { params: { id } });
    expect(res.status).toBe(200);
    const t = await prisma.task.findUnique({ where: { id } });
    expect(t?.assignmentLevelSnapshot).toBe(11);
  });
});

// ── E19: Denetim kaydı ────────────────────────────────────────────────────────

describe("E19 — REASSIGNED / PROJECT_CHANGED denetim kaydı", () => {
  it("yeniden atamada fromValue/toValue ile TaskLog satırı oluşur", async () => {
    const id = await createTask({});
    asUser(seniorMgr);
    await taskPATCH(patchReq(id, { assignedToId: nonMember.id }), { params: { id } });
    const log = await prisma.taskLog.findFirst({ where: { taskId: id, action: "REASSIGNED" } });
    expect(log).not.toBeNull();
    expect(log?.fromValue).toBe(assistant.name);
    expect(log?.toValue).toBe(nonMember.name);
  });

  it("proje taşımada fromValue/toValue ile TaskLog satırı oluşur", async () => {
    const id = await createTask({ assignedToId: assistant.id });
    asUser(seniorMgr);
    await taskPATCH(patchReq(id, { projectId: projA }), { params: { id } });
    const log = await prisma.taskLog.findFirst({ where: { taskId: id, action: "PROJECT_CHANGED" } });
    expect(log).not.toBeNull();
    expect(log?.fromValue).toBe("Projesiz");
    expect(log?.toValue).toContain("Proje A");
  });
});

// ── E20: Alt görev ağacı cascade ──────────────────────────────────────────────

describe("E20 — proje taşınınca alt görev ağacı cascade edilir", () => {
  it("uygun torunlarla birlikte taşınır", async () => {
    const parentId = await createTask({ assignedToId: assistant.id }); // BAGIMSIZ_DENETIM, projesiz
    const childId = await createTask({ assignedToId: assistant.id, parentTaskId: parentId, departmentId: "BAGIMSIZ_DENETIM" });

    asUser(seniorMgr);
    const res = await taskPATCH(patchReq(parentId, { projectId: projA }), { params: { id: parentId } });
    expect(res.status).toBe(200);

    const child = await prisma.task.findUnique({ where: { id: childId } });
    expect(child?.projectId).toBe(projA);
    expect(child?.departmentId).toBeNull();
  });

  it("uygun olmayan torun varsa TÜM taşıma reddedilir (kısmi cascade olmaz)", async () => {
    // parent'ın atananı (assistant) hedef projede (projC) üye — yalnızca torunun
    // uygunsuzluğu izole edilsin diye
    const parentId = await createTask({ assignedToId: assistant.id });
    // Torun, hedef projede (projC) üye olmayan nonMember'a atanmış
    const childId = await createTask({ assignedToId: nonMember.id, parentTaskId: parentId, departmentId: "BAGIMSIZ_DENETIM" });

    asUser(seniorMgr);
    const res = await taskPATCH(patchReq(parentId, { projectId: projC }), { params: { id: parentId } });
    expect(res.status).toBe(400);

    // Ne parent ne de child taşınmış olmalı
    const parent = await prisma.task.findUnique({ where: { id: parentId } });
    const child = await prisma.task.findUnique({ where: { id: childId } });
    expect(parent?.projectId).toBeNull();
    expect(child?.projectId).toBeNull();
  });
});
