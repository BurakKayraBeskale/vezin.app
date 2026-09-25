/**
 * Performans API entegrasyon testleri
 *
 * Kapsanan senaryolar:
 *   P1   Ahmet Oruç → yalnızca BAGIMSIZ_DENETIM personeli döner
 *   P2   Murat Özgür → yalnızca YEMINLI_MALI_MUSAVIR (canViewAllProjects'e rağmen)
 *   P3   Sıradan kullanıcı → 404
 *   P4   ADMIN → her iki birimi görür
 *   P5   Zamanında tamamlanan (completedAt <= dueDate sınır durumu dahil)
 *   P6   Geciken: DONE + completedAt > dueDate
 *   P7   Geciken: DONE değil + dueDate geçmiş
 *   P8   Henüz açık (dueDate gelecekte) → hesaba katılmaz
 *   P9   dueDate'i olmayan görev → hesaba katılmaz
 *   T-SIP       showInPerformance=false kullanıcı listede görünmez
 *   T-SCOPE     Ahmet Oruç, YMM kadrosundaki birinin dökümünü isteyince 404
 *   T-DATERANGE Tarih aralığı dışındaki görevler yüzdeye ve listeye girmiyor
 *   T-UPCOMING  "Süresi dolmak üzere" grubu yalnızca 7 gün içindeki açık görevleri içeriyor
 *   T-CUTOFF    PERFORMANS_BASLANGIC öncesindeki görev yüzdeye/dökümüne girmiyor
 *   T-ZERO      Payda 0 → pct=0 (null DEĞİL), "%0 — 0/0" (basariOrani — lib/performance.ts)
 *   T-5050      1 zamanında + 1 geciken → %50 — 1/2 (basariOrani tek kaynaktan doğru hesaplıyor)
 */

import { describe, it, expect, beforeAll, afterAll, vi } from "vitest";
import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";

vi.mock("next-auth", () => ({ getServerSession: vi.fn() }));
vi.mock("next-auth/jwt", () => ({ getToken: vi.fn() }));

import { GET as perfGET } from "../../app/api/performance/route";
import { GET as breakdownGET } from "../../app/api/performance/[userId]/route";
import { getToken } from "next-auth/jwt";
import { PERFORMANS_BASLANGIC, basariOrani } from "../../lib/performance";

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

function fakeBreakdownReq(userId: string, params?: { from?: string; to?: string }): any {
  const url = new URL(`http://localhost/api/performance/${userId}`);
  if (params?.from) url.searchParams.set("from", params.from);
  if (params?.to)   url.searchParams.set("to",   params.to);
  return new Request(url.toString());
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

// T-SIP: showInPerformance=false kullanıcı
let hiddenBdUser: string;

// T-DATERANGE: tarih aralığı içindeki görev (bd1'e)
let gorevInRange: string;   // DONE, dueDate = 2026-07-01 (FROM_RANGE > PAST)
// T-UPCOMING: yaklaşan görevler
let gorevYaklasan3: string; // TODO + dueDate = now+3 gün → upcoming'e girmeli
let gorevYaklasan10: string;// TODO + dueDate = now+10 gün → upcoming'e girmemeli

// T-CUTOFF: PERFORMANS_BASLANGIC öncesi görev
let cutoffUserId: string;
let gorevCutoffOncesi: string; // DONE + dueDate PERFORMANS_BASLANGIC'tan ÖNCE → hesaba katılmamalı

// T-5050: tam olarak 1 zamanında + 1 geciken görevi olan kullanıcı
let pct50UserId: string;

// Sahte çağrı yapacak kullanıcılar (sadece token için, gerçek DB kaydı)
let adminUser: TokenUser;
let normalUser: TokenUser;
let ahmetOrucUser: TokenUser;   // email: ahmetoruc@vezin.com.tr
let muratOzgurUser: TokenUser;  // email: muratozgur@vezin.com.tr

const createdUserIds: string[] = [];
const createdTaskIds: string[] = [];

// NOT: PERFORMANS_BASLANGIC (2026-09-24) öncesi görevler artık hesaba katılmıyor —
// bu yüzden P5-P9/T-DATERANGE için kullanılan "geçmiş" tarihler cutoff'tan SONRA
// (ama gerçek "şimdi"den önce) seçildi. Cutoff'un kendisi ayrı olarak T-CUTOFF'ta test edilir.
const PAST   = new Date("2026-09-24T12:00:00Z");
const BEFORE = new Date("2026-09-24T06:00:00Z"); // dueDate'den önce
const AFTER  = new Date("2026-09-24T18:00:00Z"); // dueDate'den sonra
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

  // T-SIP: showInPerformance=false → listede görünmemeli
  const hiddenRaw = await prisma.user.create({
    data: {
      name: `${PREFIX} hidden`,
      email: email("hidden"),
      password: await hash("test123"),
      role: "EMPLOYEE",
      department: "BAGIMSIZ_DENETIM",
      canBeAssignedTasks: true,
      showInPerformance: false,
    },
  });
  hiddenBdUser = hiddenRaw.id;
  createdUserIds.push(hiddenRaw.id);

  // T-DATERANGE: PAST'tan sonraki bir tarihte zamanında görev (PAST=2026-09-24 dışında kalacak aralıkla test edilir)
  const IN_RANGE_DATE = new Date("2026-10-01T00:00:00Z");
  const g6 = await prisma.task.create({
    data: {
      title: `${PREFIX} in-range`,
      status: "DONE",
      priority: "MEDIUM",
      dueDate: IN_RANGE_DATE,
      completedAt: new Date("2026-09-30T12:00:00Z"), // dueDate'den önce → zamanında
      assignedToId: bdPersonel1,
      createdById: admin.id,
    },
  });
  gorevInRange = g6.id;
  createdTaskIds.push(g6.id);

  // T-UPCOMING: önümüzdeki 3 gün → upcoming olmalı
  const nowForUpcoming = new Date();
  const g7 = await prisma.task.create({
    data: {
      title: `${PREFIX} yaklasan-3gun`,
      status: "TODO",
      priority: "LOW",
      dueDate: new Date(nowForUpcoming.getTime() + 3 * 24 * 60 * 60 * 1000),
      assignedToId: bdPersonel1,
      createdById: admin.id,
    },
  });
  gorevYaklasan3 = g7.id;
  createdTaskIds.push(g7.id);

  // T-UPCOMING: önümüzdeki 10 gün → upcoming'e GİRMEMELİ
  const g8 = await prisma.task.create({
    data: {
      title: `${PREFIX} yaklasan-10gun`,
      status: "TODO",
      priority: "LOW",
      dueDate: new Date(nowForUpcoming.getTime() + 10 * 24 * 60 * 60 * 1000),
      assignedToId: bdPersonel1,
      createdById: admin.id,
    },
  });
  gorevYaklasan10 = g8.id;
  createdTaskIds.push(g8.id);

  // T-CUTOFF: PERFORMANS_BASLANGIC'tan ÖNCE dueDate'i olan, tamamlanmış (zamanında
  // sayılacak) bir görev — cutoff olmasaydı onTime'a girerdi, olduğu için hiç girmemeli.
  const cutoffUser = await mkUser("cutoff-user", "BAGIMSIZ_DENETIM");
  cutoffUserId = cutoffUser.id;
  const beforeCutoffDue = new Date(PERFORMANS_BASLANGIC.getTime() - 24 * 60 * 60 * 1000);
  const g9 = await prisma.task.create({
    data: {
      title: `${PREFIX} cutoff-oncesi`,
      status: "DONE",
      priority: "MEDIUM",
      dueDate: beforeCutoffDue,
      completedAt: new Date(beforeCutoffDue.getTime() - 60 * 60 * 1000), // dueDate'den önce → zamanında OLURDU
      assignedToId: cutoffUserId,
      createdById: admin.id,
    },
  });
  gorevCutoffOncesi = g9.id;
  createdTaskIds.push(g9.id);

  // T-5050: izole kullanıcı — tam olarak 1 zamanında + 1 geciken (cutoff sonrası)
  const pct50User = await mkUser("pct50-user", "BAGIMSIZ_DENETIM");
  pct50UserId = pct50User.id;
  const g10 = await prisma.task.create({
    data: {
      title: `${PREFIX} pct50-ontime`,
      status: "DONE",
      priority: "MEDIUM",
      dueDate: PAST,
      completedAt: BEFORE, // dueDate'den önce → zamanında
      assignedToId: pct50UserId,
      createdById: admin.id,
    },
  });
  createdTaskIds.push(g10.id);
  const g11 = await prisma.task.create({
    data: {
      title: `${PREFIX} pct50-late`,
      status: "DONE",
      priority: "MEDIUM",
      dueDate: PAST,
      completedAt: AFTER, // dueDate'den sonra → geç
      assignedToId: pct50UserId,
      createdById: admin.id,
    },
  });
  createdTaskIds.push(g11.id);
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
    // g4 (TODO + FUTURE) total'a dahil edilmemeli.
    // Doğrulama: total == onTime + late (açık gelecek görev eklenmeyince bu eşitlik bozulmaz)
    expect(person.total).toBe(person.onTime + person.late);
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

  it("P10: Payda 0 olan kullanıcı için pct=0 (null DEĞİL), '%0 — 0/0' gösterimi", async () => {
    asToken(ahmetOrucUser);
    const res = await perfGET(fakeReq());
    const data = await json(res);
    // bd2'ye hiç görev atanmadı
    const person = data.find((p: any) => p.id === bdPersonel2);
    expect(person).toBeDefined();
    expect(person.total).toBe(0);
    expect(person.onTime).toBe(0);
    expect(person.pct).toBe(0);
  });
});

// ── T-SIP: showInPerformance filtresi ────────────────────────────────────────

describe("GET /api/performance — showInPerformance filtresi", () => {
  it("T-SIP: showInPerformance=false kullanıcı listede görünmez", async () => {
    asToken(ahmetOrucUser);
    const res = await perfGET(fakeReq());
    expect(res.status).toBe(200);
    const data = await json(res);
    const ids: string[] = data.map((p: any) => p.id);
    // hiddenBdUser BAGIMSIZ_DENETIM'de ve canBeAssignedTasks=true,
    // ama showInPerformance=false olduğu için listede OLMAMALI
    expect(ids).not.toContain(hiddenBdUser);
  });
});

// ── T-SCOPE: döküm kapsam kontrolü ───────────────────────────────────────────

describe("GET /api/performance/[userId] — kapsam kontrolü", () => {
  it("T-SCOPE: Ahmet Oruç, YMM kadrosundaki birinin dökümünü isteyince 404 alır", async () => {
    asToken(ahmetOrucUser);
    const res = await breakdownGET(
      fakeBreakdownReq(ymmPersonel1),
      { params: { userId: ymmPersonel1 } }
    );
    expect(res.status).toBe(404);
  });

  it("T-SCOPE: Ahmet Oruç, BD kadrosundaki birinin dökümüne erişebilir", async () => {
    asToken(ahmetOrucUser);
    const res = await breakdownGET(
      fakeBreakdownReq(bdPersonel1),
      { params: { userId: bdPersonel1 } }
    );
    expect(res.status).toBe(200);
  });
});

// ── T-DATERANGE: tarih aralığı filtresi ──────────────────────────────────────

describe("GET /api/performance/[userId] — tarih aralığı filtresi", () => {
  // bdPersonel1'in görevleri:
  //   PAST = 2026-09-24 → g1, g1b (zamanında), g2 (gecikmeli), g3 (acik-gecmis gecikmeli)
  //   IN_RANGE_DATE = 2026-10-01 → g6 (zamanında)
  // FROM_RANGE = 2026-09-26 olunca PAST görevleri dışarıda kalır, g6 içeride

  const FROM_RANGE = "2026-09-26";
  const TO_RANGE   = "2026-12-31";

  it("T-DATERANGE: aralık dışındaki görevler onTime/late listesine girmiyor", async () => {
    asToken(ahmetOrucUser);
    const res = await breakdownGET(
      fakeBreakdownReq(bdPersonel1, { from: FROM_RANGE, to: TO_RANGE }),
      { params: { userId: bdPersonel1 } }
    );
    expect(res.status).toBe(200);
    const bd = await json(res);

    // PAST (2026-01-01) görevleri aralık dışında → onTime/late'de id'leri olmamalı
    const allIds = [
      ...bd.onTime.map((t: any) => t.id),
      ...bd.late.map((t: any) => t.id),
    ];
    // g1 ve g2 aralık dışı olduğu için listede olmamalı
    const pastTaskIds = [gorevZamaninda, gorevGecikti, gorevAcikGecmis];
    for (const tid of pastTaskIds) {
      expect(allIds).not.toContain(tid);
    }
  });

  it("T-DATERANGE: aralık içindeki görev onTime listesinde görünür", async () => {
    asToken(ahmetOrucUser);
    const res = await breakdownGET(
      fakeBreakdownReq(bdPersonel1, { from: FROM_RANGE, to: TO_RANGE }),
      { params: { userId: bdPersonel1 } }
    );
    const bd = await json(res);
    // gorevInRange dueDate=2026-07-01, FROM_RANGE=2026-06-01 → aralık içinde
    const onTimeIds: string[] = bd.onTime.map((t: any) => t.id);
    expect(onTimeIds).toContain(gorevInRange);
  });

  it("T-DATERANGE: yüzde yalnızca aralık içindeki görevlerden hesaplanır", async () => {
    asToken(ahmetOrucUser);
    // Dar aralık: sadece gorevInRange (zamanında) → pct=100
    const res = await breakdownGET(
      fakeBreakdownReq(bdPersonel1, { from: FROM_RANGE, to: TO_RANGE }),
      { params: { userId: bdPersonel1 } }
    );
    const bd = await json(res);
    // sadece g6 zamanında, başka görev yok aralıkta → pct=100
    expect(bd.onTimeCount).toBe(1);
    expect(bd.lateCount).toBe(0);
    expect(bd.pct).toBe(100);
  });
});

// ── T-UPCOMING: süresi dolmak üzere grubu ────────────────────────────────────

describe("GET /api/performance/[userId] — süresi dolmak üzere", () => {
  it("T-UPCOMING: 7 gün içindeki açık görev upcoming grubuna girer", async () => {
    asToken(ahmetOrucUser);
    const res = await breakdownGET(
      fakeBreakdownReq(bdPersonel1),
      { params: { userId: bdPersonel1 } }
    );
    expect(res.status).toBe(200);
    const bd = await json(res);
    const upcomingIds: string[] = bd.upcoming.map((t: any) => t.id);
    // gorevYaklasan3 (now+3 gün) upcoming'de olmalı
    expect(upcomingIds).toContain(gorevYaklasan3);
  });

  it("T-UPCOMING: 7 günden uzak açık görev upcoming grubuna girmez", async () => {
    asToken(ahmetOrucUser);
    const res = await breakdownGET(
      fakeBreakdownReq(bdPersonel1),
      { params: { userId: bdPersonel1 } }
    );
    const bd = await json(res);
    const upcomingIds: string[] = bd.upcoming.map((t: any) => t.id);
    // gorevYaklasan10 (now+10 gün) upcoming'de OLMAMALI
    expect(upcomingIds).not.toContain(gorevYaklasan10);
  });
});

// ── T-CUTOFF: PERFORMANS_BASLANGIC öncesi görev hesaba katılmıyor ───────────

describe("PERFORMANS_BASLANGIC — cutoff öncesi görevler hesaba katılmıyor", () => {
  it("T-CUTOFF: liste ekranında total=0, pct=null (cutoff öncesindeki tek görev sayılmıyor)", async () => {
    asToken(ahmetOrucUser);
    const res = await perfGET(fakeReq());
    expect(res.status).toBe(200);
    const data = await json(res);
    const person = data.find((p: any) => p.id === cutoffUserId);
    expect(person).toBeDefined();
    expect(person.total).toBe(0);
    expect(person.onTime).toBe(0);
    expect(person.late).toBe(0);
    expect(person.pct).toBe(0);
  });

  it("T-CUTOFF: döküm ekranında cutoff öncesi görev onTime/late listesinde görünmüyor", async () => {
    asToken(ahmetOrucUser);
    // Geniş bir aralık verilse dahi (cutoff öncesini de kapsayan) görev dönmemeli —
    // hesaplama penceresi PERFORMANS_BASLANGIC ile sunucu tarafında zaten daraltılıyor.
    const res = await breakdownGET(
      fakeBreakdownReq(cutoffUserId, { from: "2020-01-01", to: "2030-01-01" }),
      { params: { userId: cutoffUserId } }
    );
    expect(res.status).toBe(200);
    const bd = await json(res);
    const allIds = [...bd.onTime.map((t: any) => t.id), ...bd.late.map((t: any) => t.id)];
    expect(allIds).not.toContain(gorevCutoffOncesi);
    expect(bd.onTimeCount).toBe(0);
    expect(bd.lateCount).toBe(0);
    expect(bd.pct).toBe(0);
  });
});

// ── T-ZERO / T-5050: basariOrani (lib/performance.ts) — tek kaynak ──────────

describe("basariOrani — payda 0 ve normal oran (lib/performance.ts)", () => {
  it("T-ZERO (birim): payda 0 → pct=0, null DEĞİL", () => {
    expect(basariOrani(0, 0)).toEqual({ total: 0, pct: 0 });
  });

  it("T-5050 (birim): 1 zamanında + 1 geciken → %50", () => {
    expect(basariOrani(1, 1)).toEqual({ total: 2, pct: 50 });
  });

  it("T-5050 (uçtan uca): liste ekranında 1 onTime + 1 late olan kullanıcı %50 — 1/2 döner", async () => {
    asToken(ahmetOrucUser);
    const res = await perfGET(fakeReq());
    expect(res.status).toBe(200);
    const data = await json(res);
    const person = data.find((p: any) => p.id === pct50UserId);
    expect(person).toBeDefined();
    expect(person.onTime).toBe(1);
    expect(person.late).toBe(1);
    expect(person.total).toBe(2);
    expect(person.pct).toBe(50);
  });

  it("T-5050 (döküm): GET /api/performance/[userId] de aynı sonucu (aynı fonksiyondan) döner", async () => {
    asToken(ahmetOrucUser);
    const res = await breakdownGET(
      fakeBreakdownReq(pct50UserId),
      { params: { userId: pct50UserId } }
    );
    expect(res.status).toBe(200);
    const bd = await json(res);
    expect(bd.onTimeCount).toBe(1);
    expect(bd.lateCount).toBe(1);
    expect(bd.pct).toBe(50);
  });
});
