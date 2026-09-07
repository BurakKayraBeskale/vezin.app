/**
 * Performans API entegrasyon testleri
 *
 * Kapsanan senaryolar:
 *   P1  Ahmet Oruç → yalnızca BAGIMSIZ_DENETIM personeli döner
 *   P2  Murat Özgür → yalnızca YEMINLI_MALI_MUSAVIR (canViewAllProjects'e rağmen)
 *   P3  Sıradan kullanıcı → 404
 *   P4  ADMIN → her iki birimi görür
 *   P5  Zamanında tamamlanan (completedAt <= dueDate sınır durumu dahil)
 *   P6  Geciken: DONE + completedAt > dueDate
 *   P7  Geciken: DONE değil + dueDate geçmiş
 *   P8  Henüz açık (dueDate gelecekte) → hesaba katılmaz
 *   P9  dueDate'i olmayan görev → hesaba katılmaz
 */

import { describe, it, expect, beforeAll, afterAll, vi } from "vitest";
import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";

vi.mock("next-auth", () => ({ getServerSession: vi.fn() }));
vi.mock("next-auth/jwt", () => ({ getToken: vi.fn() }));

import { GET as perfGET } from "../../app/api/performance/route";
import { getToken } from "next-auth/jwt";

const prisma = new PrismaClient();
const hash = (pw: string) => bcrypt.hash(pw, 10);
const PREFIX = `test-perf-${Date.now()}`;
const email = (slug: string) => `${PREFIX}-${slug}@perf.test`;

type TokenUser = {
  id: string;
  email: string;
  role: string;
  department: string;
  canViewAllProjects: boolean;
  overseesDepartment: string | null;
};

function asToken(u: TokenUser) {
  vi.mocked(getToken).mockResolvedValue({
    id: u.id,
    email: u.email,
    role: u.role,
    department: u.department,
    canViewAllProjects: u.canViewAllProjects,
    overseesDepartment: u.overseesDepartment,
  } as any);
}

function fakeReq(): any {
  return new Request("http://localhost/api/performance");
}

async function json(res: Response) {
  return res.json();
}

// ── Test verisi ─────────────────────────────────────────────────────────────

// Personel (canBeAssignedTasks=true)
let bdPersonel1: string; // BAGIMSIZ_DENETIM
let bdPersonel2: string; // BAGIMSIZ_DENETIM
let ymmPersonel1: string; // YEMINLI_MALI_MUSAVIR

// Görev ID'leri (hesap testi için)
let gorevZamaninda: string;  // DONE + completedAt <= dueDate
let gorevGecikti: string;    // DONE + completedAt > dueDate
let gorevAcikGecmis: string; // TODO + dueDate geçmiş
let gorevAcikGelecek: string;// TODO + dueDate gelecekte
let gorevDueDateYok: string; // DONE + dueDate yok

// Sahte çağrı yapacak kullanıcılar (sadece token için, gerçek DB kaydı)
let adminUser: TokenUser;
let normalUser: TokenUser;
let ahmetOrucUser: TokenUser;   // email: ahmetoruc@vezin.com.tr
let muratOzgurUser: TokenUser;  // email: muratozgur@vezin.com.tr

const createdUserIds: string[] = [];
const createdTaskIds: string[] = [];

const PAST   = new Date("2026-01-01T00:00:00Z");
const BEFORE = new Date("2025-12-31T23:59:00Z"); // dueDate'den önce
const AFTER  = new Date("2026-01-02T00:00:00Z"); // dueDate'den sonra
const FUTURE = new Date("2099-01-01T00:00:00Z");

beforeAll(async () => {
  async function mkUser(
    slug: string,
    dept: string,
    canBeAssigned = true,
    overrideEmail?: string,
  ) {
    const e = overrideEmail ?? email(slug);
    // Gerçek kullanıcı (ahmetoruc / muratozgur) zaten DB'de varsa upsert
    const u = await prisma.user.upsert({
      where: { email: e },
      update: {},
      create: {
        name: `${PREFIX} ${slug}`,
        email: e,
        password: await hash("test123"),
        role: "EMPLOYEE",
        department: dept,
        canBeAssignedTasks: canBeAssigned,
        seniorityLevel: 2,
      },
    });
    // Sadece bizim oluşturduklarımızı silelim — fakat upsert yaratmışsa da sileceğiz
    createdUserIds.push(u.id);
    return u;
  }

  // Admin
  const adminRaw = await mkUser("admin", "ADMIN", true, email("admin"));
  adminUser = {
    id: adminRaw.id, email: adminRaw.email,
    role: "ADMIN", department: "ADMIN",
    canViewAllProjects: true, overseesDepartment: null,
  };

  // Sıradan kullanıcı
  const normalRaw = await mkUser("normal", "OUTSOURCE");
  normalUser = {
    id: normalRaw.id, email: normalRaw.email,
    role: "EMPLOYEE", department: "OUTSOURCE",
    canViewAllProjects: false, overseesDepartment: null,
  };

  // Bağımsız Denetim personeli
  const bd1 = await mkUser("bd1", "BAGIMSIZ_DENETIM");
  bdPersonel1 = bd1.id;
  const bd2 = await mkUser("bd2", "BAGIMSIZ_DENETIM");
  bdPersonel2 = bd2.id;

  // YMM personeli
  const ymm1 = await mkUser("ymm1", "YEMINLI_MALI_MUSAVIR");
  ymmPersonel1 = ymm1.id;

  // Ahmet Oruç — gerçek e-posta (PERFORMANCE_ACCESS içinde)
  // Test ortamında DB'de zaten olabilir; upsert ile güvenle oluştur
  const ahmetRaw = await prisma.user.upsert({
    where: { email: "ahmetoruc@vezin.com.tr" },
    update: {},
    create: {
      name: "Ahmet Oruç",
      email: "ahmetoruc@vezin.com.tr",
      password: await hash("test123"),
      role: "EMPLOYEE",
      department: "BAGIMSIZ_DENETIM",
      canBeAssignedTasks: false,
      seniorityLevel: 14,
      overseesDepartment: "BAGIMSIZ_DENETIM",
    },
  });
  ahmetOrucUser = {
    id: ahmetRaw.id, email: "ahmetoruc@vezin.com.tr",
    role: "EMPLOYEE", department: "BAGIMSIZ_DENETIM",
    canViewAllProjects: false, overseesDepartment: "BAGIMSIZ_DENETIM",
  };

  // Murat Özgür — canViewAllProjects=true AMA scope=YEMINLI_MALI_MUSAVIR
  const muratRaw = await prisma.user.upsert({
    where: { email: "muratozgur@vezin.com.tr" },
    update: {},
    create: {
      name: "Murat Özgür",
      email: "muratozgur@vezin.com.tr",
      password: await hash("test123"),
      role: "EMPLOYEE",
      department: "YEMINLI_MALI_MUSAVIR",
      canBeAssignedTasks: false,
      seniorityLevel: 100,
      canViewAllProjects: true,
    },
  });
  muratOzgurUser = {
    id: muratRaw.id, email: "muratozgur@vezin.com.tr",
    role: "EMPLOYEE", department: "YEMINLI_MALI_MUSAVIR",
    canViewAllProjects: true, overseesDepartment: null,
  };

  // ── Görevler (bd1'e atanmış, hesap kontrolü için) ─────────────────────
  const admin = adminRaw;

  // P5: Zamanında — DONE, completedAt <= dueDate
  const g1 = await prisma.task.create({
    data: {
      title: `${PREFIX} zamaninda`,
      status: "DONE",
      priority: "MEDIUM",
      dueDate: PAST,
      completedAt: BEFORE, // dueDate'den önce → zamanında
      assignedToId: bdPersonel1,
      createdById: admin.id,
    },
  });
  gorevZamaninda = g1.id;
  createdTaskIds.push(g1.id);

  // P5 sınır: completedAt == dueDate → yine zamanında
  const g1b = await prisma.task.create({
    data: {
      title: `${PREFIX} zamaninda-sinir`,
      status: "DONE",
      priority: "MEDIUM",
      dueDate: PAST,
      completedAt: PAST, // tam dueDate'de → zamanında
      assignedToId: bdPersonel1,
      createdById: admin.id,
    },
  });
  createdTaskIds.push(g1b.id);

  // P6: Geciken (DONE + completedAt > dueDate)
  const g2 = await prisma.task.create({
    data: {
      title: `${PREFIX} gecikti-done`,
      status: "DONE",
      priority: "MEDIUM",
      dueDate: PAST,
      completedAt: AFTER, // dueDate'den sonra → geç
      assignedToId: bdPersonel1,
      createdById: admin.id,
    },
  });
  gorevGecikti = g2.id;
  createdTaskIds.push(g2.id);

  // P7: Geciken (TODO + dueDate geçmiş)
  const g3 = await prisma.task.create({
    data: {
      title: `${PREFIX} acik-gecmis`,
      status: "TODO",
      priority: "LOW",
      dueDate: PAST,
      assignedToId: bdPersonel1,
      createdById: admin.id,
    },
  });
  gorevAcikGecmis = g3.id;
  createdTaskIds.push(g3.id);

  // P8: Açık + gelecekte → hesaba katılmaz
  const g4 = await prisma.task.create({
    data: {
      title: `${PREFIX} acik-gelecek`,
      status: "TODO",
      priority: "LOW",
      dueDate: FUTURE,
      assignedToId: bdPersonel1,
      createdById: admin.id,
    },
  });
  gorevAcikGelecek = g4.id;
  createdTaskIds.push(g4.id);

  // P9: dueDate yok → hesaba katılmaz
  const g5 = await prisma.task.create({
    data: {
      title: `${PREFIX} duedate-yok`,
      status: "DONE",
      priority: "LOW",
      completedAt: BEFORE,
      assignedToId: bdPersonel1,
      createdById: admin.id,
    },
  });
  gorevDueDateYok = g5.id;
  createdTaskIds.push(g5.id);
});

afterAll(async () => {
  await prisma.task.deleteMany({ where: { id: { in: createdTaskIds } } });
  // Gerçek kullanıcıları (ahmet/murat) silmiyoruz — upsert yaptık, var olabilirler
  const testOnlyIds = createdUserIds.filter(
    (id) => id !== ahmetOrucUser.id && id !== muratOzgurUser.id
  );
  await prisma.user.deleteMany({ where: { id: { in: testOnlyIds } } });
  await prisma.$disconnect();
});

// ── Testler ─────────────────────────────────────────────────────────────────

describe("GET /api/performance — erişim kontrolü", () => {
  it("P1: Ahmet Oruç → yalnızca BAGIMSIZ_DENETIM personeli döner", async () => {
    asToken(ahmetOrucUser);
    const res = await perfGET(fakeReq());
    expect(res.status).toBe(200);
    const data = await json(res);
    const depts: string[] = data.map((p: any) => p.department);
    // Tüm kayıtlar BAGIMSIZ_DENETIM olmalı
    expect(depts.every((d: string) => d === "BAGIMSIZ_DENETIM")).toBe(true);
    // YMM personeli görünmemeli
    const ids: string[] = data.map((p: any) => p.id);
    expect(ids).not.toContain(ymmPersonel1);
  });

  it("P2: Murat Özgür → yalnızca YEMINLI_MALI_MUSAVIR (canViewAllProjects=true olmasına rağmen)", async () => {
    asToken(muratOzgurUser);
    const res = await perfGET(fakeReq());
    expect(res.status).toBe(200);
    const data = await json(res);
    const depts: string[] = data.map((p: any) => p.department);
    expect(depts.every((d: string) => d === "YEMINLI_MALI_MUSAVIR")).toBe(true);
    // BAGIMSIZ_DENETIM personeli görünmemeli
    const ids: string[] = data.map((p: any) => p.id);
    expect(ids).not.toContain(bdPersonel1);
    expect(ids).not.toContain(bdPersonel2);
  });

  it("P3: Sıradan kullanıcı → 404", async () => {
    asToken(normalUser);
    const res = await perfGET(fakeReq());
    expect(res.status).toBe(404);
  });

  it("P4: ADMIN → her iki birimi görür", async () => {
    asToken(adminUser);
    const res = await perfGET(fakeReq());
    expect(res.status).toBe(200);
    const data = await json(res);
    const ids: string[] = data.map((p: any) => p.id);
    // Hem BD hem YMM personeli içermeli
    expect(ids).toContain(bdPersonel1);
    expect(ids).toContain(bdPersonel2);
    expect(ids).toContain(ymmPersonel1);
  });
});

describe("GET /api/performance — hesap doğruluğu (bd1 kullanıcısı)", () => {
  it("P5: Zamanında tamamlanan sayılır (completedAt <= dueDate sınır dahil)", async () => {
    asToken(ahmetOrucUser);
    const res = await perfGET(fakeReq());
    const data = await json(res);
    const person = data.find((p: any) => p.id === bdPersonel1);
    expect(person).toBeDefined();
    // g1 (completedAt=BEFORE<PAST) + g1b (completedAt=PAST==PAST) = 2 onTime
    expect(person.onTime).toBeGreaterThanOrEqual(2);
  });

  it("P6: DONE + completedAt > dueDate → gecikmiş sayılır", async () => {
    asToken(ahmetOrucUser);
    const res = await perfGET(fakeReq());
    const data = await json(res);
    const person = data.find((p: any) => p.id === bdPersonel1);
    expect(person).toBeDefined();
    // g2 gecikmeli
    expect(person.late).toBeGreaterThanOrEqual(1);
  });

  it("P7: DONE değil + dueDate geçmiş → gecikmiş sayılır", async () => {
    asToken(ahmetOrucUser);
    const res = await perfGET(fakeReq());
    const data = await json(res);
    const person = data.find((p: any) => p.id === bdPersonel1);
    // g3 (TODO + past) de gecikmeli
    expect(person.late).toBeGreaterThanOrEqual(2);
  });

  it("P8: Açık görev + dueDate gelecekte → hesaba katılmaz", async () => {
    asToken(ahmetOrucUser);
    const res = await perfGET(fakeReq());
    const data = await json(res);
    const person = data.find((p: any) => p.id === bdPersonel1);
    // g4 (TODO + FUTURE) total'a dahil edilmemeli
    // onTime(2) + late(>=2) = total; g4 eklenirse total 1 daha fazla olurdu
    // Dolaylı kontrol: total = onTime + late
    expect(person.total).toBe(person.onTime + person.late);
    // g4 FUTURE yüzünden total artmamış olmalı (2+2=4 değil 2+2+1=5 OLMAZ)
    const expectedTotal = person.onTime + person.late;
    expect(expectedTotal).toBeLessThanOrEqual(4); // 2 onTime + 2 late
  });

  it("P9: dueDate'i olmayan görev hesaba katılmaz", async () => {
    asToken(ahmetOrucUser);
    const res = await perfGET(fakeReq());
    const data = await json(res);
    const person = data.find((p: any) => p.id === bdPersonel1);
    // g5 (DONE + no dueDate) total'a eklenmemiş olmalı
    // total = onTime + late doğrulaması zaten P8'de yapıldı
    expect(person.total).toBe(person.onTime + person.late);
  });

  it("P10: Payda 0 olan kullanıcı için pct=null (veri yok)", async () => {
    asToken(ahmetOrucUser);
    const res = await perfGET(fakeReq());
    const data = await json(res);
    // bd2'ye hiç görev atanmadı
    const person = data.find((p: any) => p.id === bdPersonel2);
    expect(person).toBeDefined();
    expect(person.total).toBe(0);
    expect(person.pct).toBeNull();
  });
});
