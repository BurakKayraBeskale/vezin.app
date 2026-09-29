/**
 * Proje görev atama eşiği (Senior 1) + departman sorumlusu bildirimi — entegrasyon testleri
 *
 * Kıdem eşiği (lib/task-permissions.ts canAssignTaskInProject + lib/task-assignment.ts getEligibleAssignees):
 *   PA1  Proje üyesi Senior 1 (5) → aynı projedeki Assistant'a atar → 201
 *   PA2  Senior 1 → başka bir Senior 1'e atayamaz → 403
 *   PA3  Proje üyesi olmayan Senior 2 (6) → o projeye görev atayamaz → 404
 *   PA4  Assistant Manager (7) proje üyesiyse atayabilir → 201
 *   PA5  Experienced Assistant (3) proje üyesi olsa da atayamaz → 403
 *   PA6  /api/users/assignable aynı kuralı uygular (tek kaynak)
 *
 * Departman sorumlusu bildirimi (lib/notifications.ts notifyProjectSupervisorOfAssignment):
 *   PN1  YMM projesinde görev atanınca Ebubekir'e bildirim gider, Murat'a gitmez (metin birebir)
 *   PN2  BD projesinde Ahmet Oruç'a bildirim gider
 *   PN3  Ebubekir kendi atadığında kendine bildirim gitmez
 *   PN4  Projesiz görevde bu bildirim üretilmez
 *   PN5  Atanan değişince "atananını X'den Y'ye değiştirdi" metni
 *   PN6  Sorumlu zaten atanansa tek bildirim (yalnız "görev size atandı")
 *   PN7  Pasif sorumluya bildirim gitmez
 *
 * Gerçek sorumlu hesapları (ebubekirozturk@, ahmetoruc@, muratozgur@) project-visibility
 * testlerindeki gibi upsert ile garantilenir; test sonunda silinmez.
 */

import { describe, it, expect, beforeAll, afterAll, vi } from "vitest";
import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";

vi.mock("next-auth", () => ({ getServerSession: vi.fn() }));
vi.mock("next-auth/jwt", () => ({ getToken: vi.fn() }));

import { POST as tasksPOST } from "../../app/api/tasks/route";
import { PATCH as taskPATCH } from "../../app/api/tasks/[id]/route";
import { GET as assignableGET } from "../../app/api/users/assignable/route";
import { getServerSession } from "next-auth";
import { getToken } from "next-auth/jwt";
import { PROJECT_TASK_ASSIGNED, trNameSuffix } from "../../lib/notifications";

const prisma = new PrismaClient();
const STAMP = Date.now();
const PREFIX = `test-pta-${STAMP}`;

type U = {
  id: string;
  name: string;
  email: string;
  role: string;
  department: string;
  seniorityLevel: number;
  canViewAllProjects: boolean;
  overseesDepartment: string | null;
};

const createdUserIds: string[] = [];
const createdProjectIds: string[] = [];

async function mkUser(slug: string, name: string, level: number, department: string): Promise<U> {
  const u = await prisma.user.create({
    data: {
      name: `${PREFIX} ${name}`,
      email: `${PREFIX}-${slug}@pta.test`,
      password: await bcrypt.hash("x", 4),
      role: "EMPLOYEE",
      department,
      seniorityLevel: level,
      canViewAllProjects: false,
      overseesDepartment: null,
      canBeAssignedTasks: true,
      status: "ACTIVE",
    },
  });
  createdUserIds.push(u.id);
  return { ...u, overseesDepartment: null };
}

/** Gerçek sorumlu hesabı — yoksa oluşturulur; bu test için yalnız AKTİF olması garanti edilir. */
async function realUser(email: string, name: string, overseesDepartment: string, level: number): Promise<U> {
  const u = await prisma.user.upsert({
    where: { email },
    update: { status: "ACTIVE" },
    create: {
      name,
      email,
      password: await bcrypt.hash("test", 4),
      role: "EMPLOYEE",
      department: "OUTSOURCE",
      seniorityLevel: level,
      canViewAllProjects: false,
      overseesDepartment,
      canBeAssignedTasks: false,
      status: "ACTIVE",
    },
  });
  return { ...u };
}

function asUser(u: U) {
  const user = {
    id: u.id,
    name: u.name,
    email: u.email,
    role: u.role,
    department: u.department,
    seniorityLevel: u.seniorityLevel,
    canViewAllProjects: u.canViewAllProjects,
    overseesDepartment: u.overseesDepartment,
    canViewAllTasks: false,
  };
  vi.mocked(getServerSession).mockResolvedValue({ user, expires: "2099-01-01" } as any);
  vi.mocked(getToken).mockResolvedValue(user as any);
}

async function createTask(actor: U, body: Record<string, unknown>) {
  asUser(actor);
  const res = await tasksPOST(
    new Request("http://localhost/api/tasks", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ dueDate: new Date(Date.now() + 7 * 86_400_000).toISOString(), ...body }),
    }) as any
  );
  const data = await res.json();
  return { status: res.status, data };
}

async function supervisorNotifs(taskId: string) {
  return prisma.notification.findMany({ where: { relatedId: taskId, type: PROJECT_TASK_ASSIGNED } });
}

let creator: U, senior1: U, senior1b: U, assistant: U, assistant2: U, asstManager: U, expAssistant: U, senior2Outsider: U;
let bdSenior1: U, bdAssistant: U;
let ebubekir: U, murat: U, ahmetOruc: U;
let ymmProject: { id: string; name: string };
let bdProject: { id: string; name: string };

beforeAll(async () => {
  const YMM_DEPT = "YEMINLI_MALI_MUSAVIR";
  creator = await mkUser("creator", "Kurucu Yönetici", 8, YMM_DEPT);
  senior1 = await mkUser("senior1", "Ahmet Yılmaz", 5, YMM_DEPT);
  senior1b = await mkUser("senior1b", "Can Aydın", 5, YMM_DEPT);
  assistant = await mkUser("assistant", "Mehmet Demir", 2, YMM_DEPT);
  assistant2 = await mkUser("assistant2", "Ayşe Kaya", 2, YMM_DEPT);
  asstManager = await mkUser("am", "Zeynep Arslan", 7, YMM_DEPT);
  expAssistant = await mkUser("exp", "Burak Şahin", 3, YMM_DEPT);
  senior2Outsider = await mkUser("senior2", "Elif Koç", 6, YMM_DEPT);
  bdSenior1 = await mkUser("bd-senior1", "Deniz Yıldız", 5, "BAGIMSIZ_DENETIM");
  bdAssistant = await mkUser("bd-assistant", "Ece Tekin", 2, "BAGIMSIZ_DENETIM");

  ebubekir = await realUser("ebubekirozturk@vezin.com.tr", "Ebubekir Öztürk", "YMM", 12);
  murat = await realUser("muratozgur@vezin.com.tr", "Murat Özgür", "YMM", 14);
  ahmetOruc = await realUser("ahmetoruc@vezin.com.tr", "Ahmet Oruç", "BAGIMSIZ_DENETIM", 14);

  const ymm = await prisma.project.create({
    data: { name: `${PREFIX} YMM Denetimi`, department: "YMM", createdById: creator.id },
  });
  const bd = await prisma.project.create({
    data: { name: `${PREFIX} BD Denetimi`, department: "BAGIMSIZ_DENETIM", createdById: creator.id },
  });
  ymmProject = { id: ymm.id, name: ymm.name };
  bdProject = { id: bd.id, name: bd.name };
  createdProjectIds.push(ymm.id, bd.id);

  await prisma.projectMember.createMany({
    data: [
      ...[senior1, senior1b, assistant, assistant2, asstManager, expAssistant, ebubekir].map((u) => ({
        projectId: ymm.id,
        userId: u.id,
        assignedBy: creator.id,
      })),
      ...[bdSenior1, bdAssistant].map((u) => ({ projectId: bd.id, userId: u.id, assignedBy: creator.id })),
    ],
  });
});

afterAll(async () => {
  const tasks = await prisma.task.findMany({
    where: {
      OR: [
        { projectId: { in: createdProjectIds } },
        { createdById: { in: createdUserIds } },
        { title: { startsWith: PREFIX } },
      ],
    },
    select: { id: true },
  });
  const taskIds = tasks.map((t) => t.id);
  await prisma.notification.deleteMany({ where: { relatedId: { in: taskIds } } });
  await prisma.taskLog.deleteMany({ where: { taskId: { in: taskIds } } });
  await prisma.task.deleteMany({ where: { id: { in: taskIds } } });
  await prisma.projectMember.deleteMany({ where: { projectId: { in: createdProjectIds } } });
  await prisma.project.deleteMany({ where: { id: { in: createdProjectIds } } });
  await prisma.user.deleteMany({ where: { id: { in: createdUserIds } } });
  await prisma.$disconnect();
});

// ── Kıdem eşiği ──────────────────────────────────────────────────────────────

describe("Proje görev atama eşiği — Senior 1", () => {
  it("PA1: proje üyesi Senior 1, aynı projedeki Assistant'a atayabiliyor → 201", async () => {
    const r = await createTask(senior1, { title: `${PREFIX} PA1`, projectId: ymmProject.id, assigneeIds: [assistant.id] });
    expect(r.status).toBe(201);
    expect(r.data.assignedToId).toBe(assistant.id);
  });

  it("PA2: Senior 1, başka bir Senior 1'e atayamıyor → 403", async () => {
    const r = await createTask(senior1, { title: `${PREFIX} PA2`, projectId: ymmProject.id, assigneeIds: [senior1b.id] });
    expect(r.status).toBe(403);
    expect(await prisma.task.count({ where: { title: `${PREFIX} PA2` } })).toBe(0);
  });

  it("PA2b: Senior 1, kendinden kıdemli üyeye (Assistant Manager) atayamıyor → 403", async () => {
    const r = await createTask(senior1, { title: `${PREFIX} PA2b`, projectId: ymmProject.id, assigneeIds: [asstManager.id] });
    expect(r.status).toBe(403);
  });

  it("PA3: proje üyesi olmayan Senior 2, o projeye görev atayamıyor → 404", async () => {
    const r = await createTask(senior2Outsider, { title: `${PREFIX} PA3`, projectId: ymmProject.id, assigneeIds: [assistant.id] });
    expect([403, 404]).toContain(r.status);
    expect(r.status).toBe(404);
    expect(await prisma.task.count({ where: { title: `${PREFIX} PA3` } })).toBe(0);
  });

  it("PA4: Assistant Manager (7) proje üyesiyse atayabiliyor → 201 (Senior 1'e de)", async () => {
    const a = await createTask(asstManager, { title: `${PREFIX} PA4a`, projectId: ymmProject.id, assigneeIds: [assistant.id] });
    expect(a.status).toBe(201);
    const b = await createTask(asstManager, { title: `${PREFIX} PA4b`, projectId: ymmProject.id, assigneeIds: [senior1.id] });
    expect(b.status).toBe(201);
  });

  it("PA5: Experienced Assistant (3) proje üyesi olsa da atayamıyor → 403", async () => {
    const r = await createTask(expAssistant, { title: `${PREFIX} PA5`, projectId: ymmProject.id, assigneeIds: [assistant.id] });
    expect(r.status).toBe(403);
    expect(await prisma.task.count({ where: { title: `${PREFIX} PA5` } })).toBe(0);
  });

  it("PA6: /api/users/assignable aynı kuralı uygular", async () => {
    const list = async (u: U) => {
      asUser(u);
      const res = await assignableGET(new Request(`http://localhost/api/users/assignable?projectId=${ymmProject.id}`) as any);
      expect(res.status).toBe(200);
      return ((await res.json()) as { id: string }[]).map((x) => x.id);
    };
    const senior1List = await list(senior1);
    expect(senior1List).toEqual(expect.arrayContaining([assistant.id, assistant2.id, expAssistant.id]));
    expect(senior1List).not.toContain(senior1b.id); // eşit kıdem
    expect(senior1List).not.toContain(asstManager.id); // yüksek kıdem
    expect(senior1List).not.toContain(senior1.id); // kendine atama
    expect(senior1List).not.toContain(ebubekir.id); // canBeAssignedTasks=false
    expect(await list(expAssistant)).toEqual([]); // kıdem < 5
    expect(await list(senior2Outsider)).toEqual([]); // üye değil
  });
});

// ── Departman sorumlusu bildirimi ────────────────────────────────────────────

describe("Proje görev ataması → departman sorumlusu bildirimi", () => {
  it("Türkçe ek: Demir'e / Kaya'ya / Oruç'a · Demir'den / Kaya'dan / Oruç'tan / Öztürk'ten", () => {
    expect(trNameSuffix("Mehmet Demir", "dative")).toBe("'e");
    expect(trNameSuffix("Ayşe Kaya", "dative")).toBe("'ya");
    expect(trNameSuffix("Ahmet Oruç", "dative")).toBe("'a");
    expect(trNameSuffix("Mehmet Demir", "ablative")).toBe("'den");
    expect(trNameSuffix("Ayşe Kaya", "ablative")).toBe("'dan");
    expect(trNameSuffix("Ahmet Oruç", "ablative")).toBe("'tan");
    expect(trNameSuffix("Ebubekir Öztürk", "ablative")).toBe("'ten");
  });

  it("PN1: YMM projesinde görev atanınca Ebubekir'e bildirim gidiyor, Murat'a gitmiyor", async () => {
    const title = `${PREFIX} PN1 beyanname kontrolü`;
    const r = await createTask(senior1, { title, projectId: ymmProject.id, assigneeIds: [assistant.id] });
    expect(r.status).toBe(201);

    const notifs = await supervisorNotifs(r.data.id);
    expect(notifs.map((n) => n.userId)).toEqual([ebubekir.id]);
    expect(notifs[0].message).toBe(
      `${senior1.name}, ${assistant.name}'e '${ymmProject.name}' projesinde '${title}' görevini atadı.`
    );
    expect(notifs[0].relatedId).toBe(r.data.id); // tıklayınca görev açılır
    expect(await prisma.notification.count({ where: { relatedId: r.data.id, userId: murat.id } })).toBe(0);

    // Mevcut bildirim aynen: atanana "görev size atandı"
    const assigneeNotif = await prisma.notification.findFirst({ where: { relatedId: r.data.id, userId: assistant.id } });
    expect(assigneeNotif?.type).toBe("TASK_ASSIGNED");
  });

  it("PN2: BD projesinde görev atanınca Ahmet Oruç'a bildirim gidiyor", async () => {
    const title = `${PREFIX} PN2 bağımsız denetim`;
    const r = await createTask(bdSenior1, { title, projectId: bdProject.id, assigneeIds: [bdAssistant.id] });
    expect(r.status).toBe(201);
    const notifs = await supervisorNotifs(r.data.id);
    expect(notifs.map((n) => n.userId)).toEqual([ahmetOruc.id]);
    expect(notifs[0].message).toBe(
      `${bdSenior1.name}, ${bdAssistant.name}'e '${bdProject.name}' projesinde '${title}' görevini atadı.`
    );
    expect(await prisma.notification.count({ where: { relatedId: r.data.id, userId: ebubekir.id } })).toBe(0);
  });

  it("PN3: Ebubekir kendi atadığında kendine bildirim gitmiyor", async () => {
    const r = await createTask(ebubekir, { title: `${PREFIX} PN3`, projectId: ymmProject.id, assigneeIds: [assistant.id] });
    expect(r.status).toBe(201);
    expect(await supervisorNotifs(r.data.id)).toHaveLength(0);
    expect(await prisma.notification.count({ where: { relatedId: r.data.id, userId: ebubekir.id } })).toBe(0);
  });

  it("PN4: projesiz görevde bu bildirim üretilmiyor", async () => {
    const r = await createTask(senior1, { title: `${PREFIX} PN4`, assigneeIds: [assistant.id] });
    expect(r.status).toBe(201);
    expect(r.data.projectId).toBeNull();
    expect(await supervisorNotifs(r.data.id)).toHaveLength(0);
    expect(await prisma.notification.count({ where: { relatedId: r.data.id, userId: ebubekir.id } })).toBe(0);
  });

  it("PN5: atanan değişince 'atananını X'den Y'ye değiştirdi' bildirimi", async () => {
    const title = `${PREFIX} PN5 mutabakat`;
    const r = await createTask(senior1, { title, projectId: ymmProject.id, assigneeIds: [assistant.id] });
    expect(r.status).toBe(201);

    asUser(senior1); // reviewOwner → canManageTask
    const res = await taskPATCH(
      new Request(`http://localhost/api/tasks/${r.data.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ assignedToId: assistant2.id }),
      }) as any,
      { params: { id: r.data.id } }
    );
    expect(res.status).toBe(200);

    const notifs = await supervisorNotifs(r.data.id);
    expect(notifs).toHaveLength(2); // oluşturma + atanan değişikliği
    const change = notifs.find((n) => n.message.includes("değiştirdi"))!;
    expect(change.userId).toBe(ebubekir.id);
    expect(change.message).toBe(
      `${senior1.name}, '${ymmProject.name}' projesindeki '${title}' görevinin atananını ${assistant.name}'den ${assistant2.name}'ya değiştirdi.`
    );
  });

  it("PN6: sorumlu zaten görevin atananıysa tek bildirim", async () => {
    // Murat → Ebubekir: ASSIGN_EXCEPTIONS (canBeAssignedTasks=false istisnası) korunuyor
    const r = await createTask(murat, { title: `${PREFIX} PN6`, projectId: ymmProject.id, assigneeIds: [ebubekir.id] });
    expect(r.status).toBe(201);
    const toEbubekir = await prisma.notification.findMany({ where: { relatedId: r.data.id, userId: ebubekir.id } });
    expect(toEbubekir).toHaveLength(1);
    expect(toEbubekir[0].type).toBe("TASK_ASSIGNED");
  });

  it("PN7: pasif sorumluya bildirim gönderilmiyor", async () => {
    await prisma.user.update({ where: { id: ahmetOruc.id }, data: { status: "INACTIVE" } });
    try {
      const r = await createTask(bdSenior1, { title: `${PREFIX} PN7`, projectId: bdProject.id, assigneeIds: [bdAssistant.id] });
      expect(r.status).toBe(201);
      expect(await supervisorNotifs(r.data.id)).toHaveLength(0);
    } finally {
      await prisma.user.update({ where: { id: ahmetOruc.id }, data: { status: "ACTIVE" } });
    }
  });
});
