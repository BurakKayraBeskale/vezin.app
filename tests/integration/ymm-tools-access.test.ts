/**
 * YMM araçları (KDV İade XML liste modülü) erişim testleri
 *
 * Kural (lib/access.ts → canUseYmmTools):
 *   department === YEMINLI_MALI_MUSAVIR (kıdem sınırı yok) | ADMIN | canViewAllProjects
 *   Diğer departmanlar (Bağımsız Denetim, Muhasebe, İdari İşler, Outsource) → 404 (403 değil)
 *
 * Kapsanan senaryolar:
 *   Y1  YMM kadrosu, seniorityLevel=2 (Assistant) → Liste Oluştur 200
 *   Y2  Bağımsız Denetim → 404
 *   Y3  ADMIN → 200
 *   Y4  Muhasebe → 404
 *   Y5  İdari İşler / Outsource → 404
 *   Y6  Diğer departman + canViewAllProjects=true → 200
 *   Y7  Pasif YMM kullanıcısı → 404
 *   Y8  Aynı kural tüm XML liste uçlarında (excel dışa aktarımları dahil) geçerli
 *   Y9  canUseYmmTools rol string'ine (MANAGER vb.) bakmaz
 */

import { describe, it, expect, beforeAll, afterAll, vi } from "vitest";
import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";

vi.mock("next-auth", () => ({ getServerSession: vi.fn() }));
vi.mock("next-auth/jwt", () => ({ getToken: vi.fn() }));

import { POST as indirilecekPOST } from "../../app/api/kdv-iade/indirilecek-liste/route";
import { POST as indirilecekExcelPOST } from "../../app/api/kdv-iade/indirilecek-liste/excel/route";
import { POST as yuklenilenPOST } from "../../app/api/kdv-iade/yuklenilen-liste/route";
import { POST as satisPOST } from "../../app/api/kdv-iade/satis-listesi/route";
import { POST as satisExcelPOST } from "../../app/api/kdv-iade/satis-listesi/excel/route";
import { getToken } from "next-auth/jwt";
import { canUseYmmTools, isYmmToolPath } from "../../lib/access";

const prisma = new PrismaClient();
const PREFIX = `test-ymm-${Date.now()}`;
const email = (slug: string) => `${PREFIX}-${slug}@ymm.test`;

type U = {
  id: string;
  role: string;
  department: string;
  canViewAllProjects: boolean;
  status: string;
};

const users: Record<string, U> = {};
const createdUserIds: string[] = [];

async function mkUser(
  slug: string,
  opts: {
    department: string;
    role?: string;
    seniorityLevel?: number;
    canViewAllProjects?: boolean;
    status?: string;
  },
) {
  const u = await prisma.user.create({
    data: {
      name: `${PREFIX} ${slug}`,
      email: email(slug),
      password: await bcrypt.hash("test123", 10),
      role: opts.role ?? "EMPLOYEE",
      department: opts.department,
      seniorityLevel: opts.seniorityLevel ?? 2,
      canViewAllProjects: opts.canViewAllProjects ?? false,
      status: opts.status ?? "ACTIVE",
    },
  });
  createdUserIds.push(u.id);
  users[slug] = {
    id: u.id,
    role: u.role,
    department: u.department,
    canViewAllProjects: u.canViewAllProjects,
    status: u.status,
  };
}

function asUser(slug: string) {
  const u = users[slug];
  vi.mocked(getToken).mockResolvedValue({
    id: u.id,
    email: email(slug),
    role: u.role,
    department: u.department,
    canViewAllProjects: u.canViewAllProjects,
    status: u.status,
  } as any);
}

/** Geçerli bir (minimal) XML yüklemesi — 200 yolunu sınar */
function xmlUpload(url: string): any {
  const fd = new FormData();
  fd.append("files[]", new File(["<Invoice></Invoice>"], "fatura.xml", { type: "text/xml" }));
  return new Request(url, { method: "POST", body: fd });
}

function jsonPost(url: string, body: unknown): any {
  return new Request(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}

const LISTE_URL = "http://localhost/api/kdv-iade/indirilecek-liste";

beforeAll(async () => {
  await mkUser("ymm-asistan", { department: "YEMINLI_MALI_MUSAVIR", seniorityLevel: 2 });
  await mkUser("ymm-stajyer", { department: "YEMINLI_MALI_MUSAVIR", seniorityLevel: 1 });
  await mkUser("bd", { department: "BAGIMSIZ_DENETIM", seniorityLevel: 8 });
  await mkUser("muhasebe", { department: "MUHASEBE" });
  await mkUser("idari", { department: "IDARI_ISLER" });
  await mkUser("outsource", { department: "OUTSOURCE" });
  await mkUser("admin", { department: "BAGIMSIZ_DENETIM", role: "ADMIN" });
  await mkUser("viewall", { department: "OUTSOURCE", canViewAllProjects: true });
  await mkUser("ymm-pasif", { department: "YEMINLI_MALI_MUSAVIR", status: "INACTIVE" });
});

afterAll(async () => {
  // Yalnızca bu testin oluşturduğu kullanıcılar silinir; mevcut kullanıcılara dokunulmaz
  await prisma.user.deleteMany({ where: { id: { in: createdUserIds } } });
  await prisma.$disconnect();
});

describe("POST /api/kdv-iade/indirilecek-liste — Liste Oluştur", () => {
  it("Y1: YMM kadrosundan seniorityLevel=2 (Assistant) kullanıcı liste oluşturabiliyor → 200", async () => {
    asUser("ymm-asistan");
    const res = await indirilecekPOST(xmlUpload(LISTE_URL));
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.stats).toBeDefined();
  });

  it("Y1b: YMM stajyer (seniorityLevel=1) de kullanabiliyor — kıdem sınırı yok → 200", async () => {
    asUser("ymm-stajyer");
    const res = await indirilecekPOST(xmlUpload(LISTE_URL));
    expect(res.status).toBe(200);
  });

  it("Y2: Bağımsız Denetim kullanıcısı → 404", async () => {
    asUser("bd");
    const res = await indirilecekPOST(xmlUpload(LISTE_URL));
    expect(res.status).toBe(404);
  });

  it("Y3: ADMIN → 200", async () => {
    asUser("admin");
    const res = await indirilecekPOST(xmlUpload(LISTE_URL));
    expect(res.status).toBe(200);
  });

  it("Y4: Muhasebe → 404", async () => {
    asUser("muhasebe");
    const res = await indirilecekPOST(xmlUpload(LISTE_URL));
    expect(res.status).toBe(404);
  });

  it("Y5: İdari İşler ve Outsource → 404", async () => {
    asUser("idari");
    expect((await indirilecekPOST(xmlUpload(LISTE_URL))).status).toBe(404);
    asUser("outsource");
    expect((await indirilecekPOST(xmlUpload(LISTE_URL))).status).toBe(404);
  });

  it("Y6: Başka departmandan canViewAllProjects=true → 200", async () => {
    asUser("viewall");
    const res = await indirilecekPOST(xmlUpload(LISTE_URL));
    expect(res.status).toBe(200);
  });

  it("Y7: Pasif YMM kullanıcısı → 404", async () => {
    asUser("ymm-pasif");
    const res = await indirilecekPOST(xmlUpload(LISTE_URL));
    expect(res.status).toBe(404);
  });

  it("oturumsuz istek → 401", async () => {
    vi.mocked(getToken).mockResolvedValue(null);
    const res = await indirilecekPOST(xmlUpload(LISTE_URL));
    expect(res.status).toBe(401);
  });
});

describe("Diğer XML liste uçları aynı kuralı uygular (Y8)", () => {
  const endpoints: Array<[string, (req: any) => Promise<Response>, () => any]> = [
    ["indirilecek-liste/excel", indirilecekExcelPOST, () => jsonPost("http://localhost/api/kdv-iade/indirilecek-liste/excel", {})],
    ["yuklenilen-liste", yuklenilenPOST, () => jsonPost("http://localhost/api/kdv-iade/yuklenilen-liste", {})],
    ["satis-listesi", satisPOST, () => xmlUpload("http://localhost/api/kdv-iade/satis-listesi")],
    ["satis-listesi/excel", satisExcelPOST, () => jsonPost("http://localhost/api/kdv-iade/satis-listesi/excel", {})],
  ];

  for (const [name, handler, mkReq] of endpoints) {
    it(`${name}: Bağımsız Denetim → 404, YMM asistan → 404 değil`, async () => {
      asUser("bd");
      expect((await handler(mkReq())).status).toBe(404);
      asUser("ymm-asistan");
      expect((await handler(mkReq())).status).not.toBe(404);
      expect((await handler(mkReq())).status).not.toBe(403);
    });
  }
});

describe("canUseYmmTools (Y9)", () => {
  it("rol string'ine değil departmana bağlı", () => {
    expect(canUseYmmTools({ role: "MANAGER", department: "BAGIMSIZ_DENETIM" })).toBe(false);
    expect(canUseYmmTools({ role: "MANAGER", department: "YEMINLI_MALI_MUSAVIR" })).toBe(true);
    expect(canUseYmmTools({ role: "EMPLOYEE", department: "YEMINLI_MALI_MUSAVIR" })).toBe(true);
  });

  it("ADMIN ve canViewAllProjects her departmanda geçer", () => {
    expect(canUseYmmTools({ role: "ADMIN", department: "MUHASEBE" })).toBe(true);
    expect(canUseYmmTools({ role: "EMPLOYEE", department: "MUHASEBE", canViewAllProjects: true })).toBe(true);
  });

  it("Muhasebe / İdari İşler / Outsource / Bağımsız Denetim geçmez", () => {
    for (const department of ["MUHASEBE", "IDARI_ISLER", "OUTSOURCE", "BAGIMSIZ_DENETIM", "", undefined]) {
      expect(canUseYmmTools({ role: "EMPLOYEE", department, canViewAllProjects: false })).toBe(false);
    }
  });

  it("pasif / silinmiş hesap geçmez (ADMIN dahil)", () => {
    expect(canUseYmmTools({ role: "ADMIN", department: "YEMINLI_MALI_MUSAVIR", status: "INACTIVE" })).toBe(false);
    expect(canUseYmmTools({ department: "YEMINLI_MALI_MUSAVIR", status: "DELETED" })).toBe(false);
  });

  it("isYmmToolPath yalnızca sayfa ve XML liste uçlarını kapsar", () => {
    expect(isYmmToolPath("/beyanname")).toBe(true);
    expect(isYmmToolPath("/api/kdv-iade/indirilecek-liste/excel")).toBe(true);
    expect(isYmmToolPath("/api/kdv-iade/satis-listesi")).toBe(true);
    expect(isYmmToolPath("/api/kdv-iade/pdf-import")).toBe(false);
    expect(isYmmToolPath("/beyannameler")).toBe(false);
  });
});
