/**
 * Personel Performansı — ayrı sayfaya taşıma testleri
 *
 * P1/P2/P3/P4 (Ahmet Oruç, Murat Özgür, sıradan kullanıcı, Admin) zaten
 * tests/integration/performance.test.ts içinde kapsanıyor. Bu dosya oradaki
 * boşlukları ve bu turun yeni gereksinimlerini kapsar:
 *
 *   PP1  Ebubekir Öztürk → yalnızca YEMINLI_MALI_MUSAVIR (canViewAllProjects
 *        FALSE olsa da — erişim canViewAllProjects'ten türetilmiyor,
 *        e-posta bazlı eşlemeden geliyor)
 *   PP2  app/(app)/performans/page.tsx mevcut getPerformanceScope'u
 *        kullanıyor ve yetkisizde notFound() çağırıyor (yapısal kontrol —
 *        Next.js Server Component'leri bu test altyapısında render edilemiyor)
 *   PP3  app/(app)/board/page.tsx artık PerformancePanel/getPerformanceScope
 *        içermiyor — panel oradan kaldırıldı
 *   PP4  components/PerformancePanel.tsx SİLİNMEDİ, yalnızca taşındı
 *   PP5  Sidebar "Personel Performansı" öğesi canViewPerformance ile gated
 */

import { describe, it, expect, beforeAll, afterAll, vi } from "vitest";
import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";
import fs from "fs";
import path from "path";

vi.mock("next-auth", () => ({ getServerSession: vi.fn() }));
vi.mock("next-auth/jwt", () => ({ getToken: vi.fn() }));

import { GET as perfGET } from "../../app/api/performance/route";
import { getToken } from "next-auth/jwt";

const prisma = new PrismaClient();
const hash = (pw: string) => bcrypt.hash(pw, 10);
const PREFIX = `test-perfpage-${Date.now()}`;

type TokenUser = {
  id: string; email: string; role: string; department: string;
  canViewAllProjects: boolean; overseesDepartment: string | null;
};

function asToken(u: TokenUser) {
  vi.mocked(getToken).mockResolvedValue({
    id: u.id, email: u.email, role: u.role, department: u.department,
    canViewAllProjects: u.canViewAllProjects, overseesDepartment: u.overseesDepartment,
  } as any);
}

function fakeReq(): any {
  return new Request("http://localhost/api/performance");
}
async function json(res: Response) { return res.json(); }

const createdUserIds: string[] = [];
let ebubekirUser: TokenUser;
let ebubekirDbId: string;

beforeAll(async () => {
  // BD ve YMM personeli — Ebubekir'in scope'unun gerçekten YMM ile sınırlı
  // olduğunu (BD'yi DIŞLADIĞINI) kanıtlamak için ikisi de gerekli.
  const bd = await prisma.user.create({
    data: {
      name: `${PREFIX} bd`, email: `${PREFIX}-bd@test.local`, password: await hash("test"),
      role: "EMPLOYEE", department: "BAGIMSIZ_DENETIM", canBeAssignedTasks: true, seniorityLevel: 2,
    },
  });
  createdUserIds.push(bd.id);
  const ymm = await prisma.user.create({
    data: {
      name: `${PREFIX} ymm`, email: `${PREFIX}-ymm@test.local`, password: await hash("test"),
      role: "EMPLOYEE", department: "YEMINLI_MALI_MUSAVIR", canBeAssignedTasks: true, seniorityLevel: 2,
    },
  });
  createdUserIds.push(ymm.id);

  // Ebubekir Öztürk — gerçek e-posta zaten DB'de olabilir; upsert (update:{}) ile
  // dokunmadan güvenle referans alınır.
  const ebubekirRaw = await prisma.user.upsert({
    where: { email: "ebubekirozturk@vezin.com.tr" },
    update: {},
    create: {
      name: "Ebubekir Öztürk", email: "ebubekirozturk@vezin.com.tr", password: await hash("test123"),
      role: "EMPLOYEE", department: "YEMINLI_MALI_MUSAVIR", canBeAssignedTasks: false, seniorityLevel: 12,
      overseesDepartment: "YMM",
    },
  });
  createdUserIds.push(ebubekirRaw.id);
  ebubekirDbId = ebubekirRaw.id;
  // Token'da BİLEREK canViewAllProjects=false, overseesDepartment=null —
  // erişimin bu bayraklardan değil e-posta eşlemesinden geldiğini kanıtlar.
  ebubekirUser = {
    id: ebubekirRaw.id, email: "ebubekirozturk@vezin.com.tr",
    role: "EMPLOYEE", department: "YEMINLI_MALI_MUSAVIR",
    canViewAllProjects: false, overseesDepartment: null,
  };
});

afterAll(async () => {
  await prisma.user.deleteMany({ where: { id: { in: createdUserIds } } });
  await prisma.$disconnect();
});

describe("PP1 — Ebubekir Öztürk: yalnızca YEMINLI_MALI_MUSAVIR", () => {
  it("canViewAllProjects=false olsa da YMM kadrosu döner, BAGIMSIZ_DENETIM dışlanır", async () => {
    asToken(ebubekirUser);
    const res = await perfGET(fakeReq());
    expect(res.status).toBe(200);
    const data = await json(res);
    expect(Array.isArray(data)).toBe(true);
    expect(data.every((p: any) => p.department === "YEMINLI_MALI_MUSAVIR")).toBe(true);
    expect(data.some((p: any) => p.department === "BAGIMSIZ_DENETIM")).toBe(false);
  });
});

describe("PP2 — /performans sayfası mevcut getPerformanceScope'u kullanıyor", () => {
  const pagePath = path.resolve(__dirname, "../../app/(app)/performans/page.tsx");

  it("sayfa dosyası mevcut", () => {
    expect(fs.existsSync(pagePath)).toBe(true);
  });

  it("getPerformanceScope ile notFound() çağırıyor, yeni bir kural yazmıyor", () => {
    const src = fs.readFileSync(pagePath, "utf8");
    expect(src).toMatch(/getPerformanceScope/);
    expect(src).toMatch(/notFound\(\)/);
    // Erişim canViewAllProjects gibi bir bayraktan TÜRETİLMEMELİ — yalnızca
    // gerçek kod satırlarında (yorumlar hariç) böyle bir kontrol olmamalı.
    const codeOnly = src.replace(/\/\/.*$/gm, "");
    expect(codeOnly).not.toMatch(/canViewAllProjects/);
  });

  it("PerformancePanel bileşenini kullanıyor (yeniden yazılmadı)", () => {
    const src = fs.readFileSync(pagePath, "utf8");
    expect(src).toMatch(/PerformancePanel/);
  });
});

describe("PP3 — /board artık PerformancePanel içermiyor", () => {
  const boardPagePath = path.resolve(__dirname, "../../app/(app)/board/page.tsx");

  it("board/page.tsx PerformancePanel veya getPerformanceScope import etmiyor", () => {
    const src = fs.readFileSync(boardPagePath, "utf8");
    expect(src).not.toMatch(/PerformancePanel/);
    expect(src).not.toMatch(/getPerformanceScope/);
  });
});

describe("PP4 — PerformancePanel bileşeni silinmedi, taşındı", () => {
  it("components/PerformancePanel.tsx hâlâ mevcut", () => {
    const compPath = path.resolve(__dirname, "../../components/PerformancePanel.tsx");
    expect(fs.existsSync(compPath)).toBe(true);
  });
});

describe("PP5 — Sidebar menü öğesi canViewPerformance ile gated", () => {
  it("Sidebar.tsx canViewPerformance prop'unu ve /performans linkini içeriyor", () => {
    const src = fs.readFileSync(path.resolve(__dirname, "../../components/Sidebar.tsx"), "utf8");
    expect(src).toMatch(/canViewPerformance/);
    expect(src).toMatch(/href="\/performans"/);
  });
});
