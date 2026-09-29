/**
 * Proje görev atama eşiği (MIN_PROJECT_ASSIGN_LEVEL = 3) + departman sorumlusu bildirimi — entegrasyon testleri
 *
 * Kıdem eşiği (lib/task-permissions.ts canAssignTaskInProject + lib/task-assignment.ts getEligibleAssignees),
 * "Deneme" projesi örneğiyle: Efecan Güvenir (3) → Janset Türkoğlu / Merve Uçan (2) atar,
 * Oğuz Çetin / Taha Bölek (5) atayamaz.
 *   PA1  Level 3 proje üyesi, level 2 üyeye atar → 201
 *   PA2  Level 3, kendinden kıdemli (level 5) üyeye atayamaz → 403
 *   PA2b Level 3, başka bir level 3'e atayamaz → 403
 *   PA3  Proje üyesi olmayan Senior 2 (6) → o projeye görev atayamaz → 404
 *   PA4  Assistant Manager (7) proje üyesiyse atayabilir → 201
 *   PA5  Level 2 proje üyesi hiç kimseye atayamaz (level 1'e bile) → 403
 *   PA5b Level 5 üye hâlâ atayabilir (level 3'e) → 201
 *   PA6  /api/users/assignable aynı kuralı uygular (tek kaynak)
 *   PS1  Alt görev: level 3 parent atananı için atanabilir liste boş DEĞİL, alt görev → 201
 *   PS2  Alt görev: level 2 parent atananı proje alt görevi açamaz → 403; projesizde kural değişmedi
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
import { MIN_PROJECT_ASSIGN_LEVEL, canCreateSubtask } from "../../lib/task-permissions";

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
// "Deneme" projesi örneği
let efecan: U, janset: U, merve: U, oguz: U, taha: U, stajyer: U;
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
  efecan = await mkUser("efecan", "Efecan Güvenir", 3, YMM_DEPT);
  janset = await mkUser("janset", "Janset Türkoğlu", 2, YMM_DEPT);
  merve = await mkUser("merve", "Merve Uçan", 2, YMM_DEPT);
  oguz = await mkUser("oguz", "Oğuz Çetin", 5, YMM_DEPT);
  taha = await mkUser("taha", "Taha Bölek", 5, YMM_DEPT);
  stajyer = await mkUser("stajyer", "Selin Er", 1, YMM_DEPT);
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
      ...[senior1, senior1b, assistant, assistant2, asstManager, expAssistant, ebubekir, efecan, janset, merve, oguz, taha, stajyer].map((u) => ({
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

async function assignableIds(u: U): Promise<string[]> {
  asUser(u);
  const res = await assignableGET(new Request(`http://localhost/api/users/assignable?projectId=${ymmProject.id}`) as any);
  expect(res.status).toBe(200);
  return ((await res.json()) as { id: string }[]).map((x) => x.id);
}

describe(`Proje görev atama eşiği — MIN_PROJECT_ASSIGN_LEVEL (${MIN_PROJECT_ASSIGN_LEVEL})`, () => {
  it("eşik tek sabitte: 3 (Experienced Assistant 1)", () => {
    expect(MIN_PROJECT_ASSIGN_LEVEL).toBe(3);
  });

  it("PA1: level 3 proje üyesi (Efecan) level 2 üyelere (Janset, Merve) atayabiliyor → 201", async () => {
    for (const target of [janset, merve]) {
      const r = await createTask(efecan, { title: `${PREFIX} PA1 ${target.name}`, projectId: ymmProject.id, assigneeIds: [target.id] });
      expect(r.status).toBe(201);
      expect(r.data.assignedToId).toBe(target.id);
    }
  });

  it("PA2: level 3, kendinden kıdemli level 5 üyelere (Oğuz, Taha) atayamıyor → 403", async () => {
    for (const target of [oguz, taha]) {
      const title = `${PREFIX} PA2 ${target.name}`;
      const r = await createTask(efecan, { title, projectId: ymmProject.id, assigneeIds: [target.id] });
      expect(r.status).toBe(403);
      expect(await prisma.task.count({ where: { title } })).toBe(0);
    }
  });

  it("PA2b: level 3, başka bir level 3'e atayamıyor → 403", async () => {
    const r = await createTask(efecan, { title: `${PREFIX} PA2b`, projectId: ymmProject.id, assigneeIds: [expAssistant.id] });
    expect(r.status).toBe(403);
    expect(await prisma.task.count({ where: { title: `${PREFIX} PA2b` } })).toBe(0);
  });

  it("PA3: proje üyesi olmayan Senior 2, o projeye görev atayamıyor → 404", async () => {
    const r = await createTask(senior2Outsider, { title: `${PREFIX} PA3`, projectId: ymmProject.id, assigneeIds: [assistant.id] });
    expect(r.status).toBe(404);
    expect(await prisma.task.count({ where: { title: `${PREFIX} PA3` } })).toBe(0);
  });

  it("PA4: Assistant Manager (7) proje üyesiyse atayabiliyor → 201", async () => {
    const a = await createTask(asstManager, { title: `${PREFIX} PA4a`, projectId: ymmProject.id, assigneeIds: [assistant.id] });
    expect(a.status).toBe(201);
    const b = await createTask(asstManager, { title: `${PREFIX} PA4b`, projectId: ymmProject.id, assigneeIds: [senior1.id] });
    expect(b.status).toBe(201);
  });

  it("PA5: level 2 proje üyesi hiç kimseye atayamıyor (level 1'e bile) → 403", async () => {
    const r = await createTask(janset, { title: `${PREFIX} PA5`, projectId: ymmProject.id, assigneeIds: [stajyer.id] });
    expect(r.status).toBe(403);
    expect(await prisma.task.count({ where: { title: `${PREFIX} PA5` } })).toBe(0);
  });

  it("PA5b: level 5 üye hâlâ atayabiliyor (level 3'e) → 201; eşit kıdeme (5) atayamıyor → 403", async () => {
    const ok = await createTask(senior1, { title: `${PREFIX} PA5b ok`, projectId: ymmProject.id, assigneeIds: [efecan.id] });
    expect(ok.status).toBe(201);
    const eq = await createTask(senior1, { title: `${PREFIX} PA5b eq`, projectId: ymmProject.id, assigneeIds: [senior1b.id] });
    expect(eq.status).toBe(403);
  });

  it("PA6: /api/users/assignable aynı kuralı uygular", async () => {
    const efecanList = await assignableIds(efecan);
    expect(efecanList).toEqual(expect.arrayContaining([janset.id, merve.id, stajyer.id, assistant.id]));
    for (const id of [oguz.id, taha.id, expAssistant.id, efecan.id, ebubekir.id]) {
      expect(efecanList).not.toContain(id); // yüksek / eşit kıdem, kendisi, canBeAssignedTasks=false
    }
    expect(await assignableIds(janset)).toEqual([]); // level 2 < eşik
    expect(await assignableIds(senior2Outsider)).toEqual([]); // üye değil
  });
});

describe("Proje alt görevi — aynı eşik", () => {
  it("PS1: level 3 parent atananı için atanabilir liste boş DEĞİL, alt görev oluşturuluyor → 201", async () => {
    const parent = await createTask(asstManager, { title: `${PREFIX} PS1 parent`, projectId: ymmProject.id, assigneeIds: [efecan.id] });
    expect(parent.status).toBe(201);

    // TaskDetail'deki "+ Alt Görev Ekle" butonu
    const efecanWf = { id: efecan.id, role: "EMPLOYEE", seniorityLevel: efecan.seniorityLevel };
    expect(canCreateSubtask(efecanWf, { assignedToId: efecan.id, reviewOwnerId: asstManager.id, projectId: ymmProject.id })).toBe(true);

    // SubtaskSection → TaskForm fixedProjectId → /api/users/assignable?projectId=…
    const list = await assignableIds(efecan);
    expect(list.length).toBeGreaterThan(0);
    expect(list).toEqual(expect.arrayContaining([janset.id, merve.id]));

    const child = await createTask(efecan, { title: `${PREFIX} PS1 child`, parentTaskId: parent.data.id, assigneeIds: [merve.id] });
    expect(child.status).toBe(201);
    expect(child.data.projectId).toBe(ymmProject.id);
    expect(child.data.parentTaskId).toBe(parent.data.id);
  });

  it("PS2: level 2 parent atananı proje alt görevi açamıyor → 403; projesiz görevde kural değişmedi", async () => {
    const parent = await createTask(efecan, { title: `${PREFIX} PS2 parent`, projectId: ymmProject.id, assigneeIds: [janset.id] });
    expect(parent.status).toBe(201);

    const jansetWf = { id: janset.id, role: "EMPLOYEE", seniorityLevel: janset.seniorityLevel };
    expect(canCreateSubtask(jansetWf, { assignedToId: janset.id, reviewOwnerId: efecan.id, projectId: ymmProject.id })).toBe(false);
    const child = await createTask(janset, { title: `${PREFIX} PS2 child`, parentTaskId: parent.data.id, assigneeIds: [stajyer.id] });
    expect(child.status).toBe(403);
    expect(await prisma.task.count({ where: { title: `${PREFIX} PS2 child` } })).toBe(0);

    // Projesiz üst görevin atananı: eskisi gibi alt görev açabilir
    expect(canCreateSubtask(jansetWf, { assignedToId: janset.id, reviewOwnerId: efecan.id, projectId: null })).toBe(true);
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
