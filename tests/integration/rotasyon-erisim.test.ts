/**
 * Rotasyon erişim kuralı (lib/access.ts → canAccessRotasyon)
 *
 * Kural (status === "ACTIVE" şart):
 *   role === "ADMIN"
 *   | department === "BAGIMSIZ_DENETIM" && title === "Partner"
 *   | canAccessRotasyon === true (elle istisna)
 * Yetkisiz → 404 (403 değil).
 *
 *   RE1  BD Partner (Ahmet Oruç), bayraksız → GET /api/rotasyon/isletmeler 200
 *   RE2  BD Senior 1 → 404
 *   RE3  YMM Partner (Murat Özgür) → 404
 *   RE4  ADMIN, bayraksız → 200
 *   RE5  canAccessRotasyon=true olan non-admin (başka departman) → 200
 *   RE6  Pasif BD Partner / pasif ADMIN → 404
 *   RE7  Saf fonksiyon: aynı kural Sidebar'ın kullandığı imzayla
 */

import { describe, it, expect, afterAll, vi } from "vitest";
import { PrismaClient } from "@prisma/client";

vi.mock("next-auth", () => ({ getServerSession: vi.fn() }));
vi.mock("next-auth/jwt", () => ({ getToken: vi.fn() }));

import { GET as isletmelerGET } from "../../app/api/rotasyon/isletmeler/route";
import { getToken } from "next-auth/jwt";
import { canAccessRotasyon } from "../../lib/access";

const prisma = new PrismaClient();

afterAll(async () => {
  await prisma.$disconnect();
});

type Tok = {
  id: string;
  email: string;
  name: string;
  role: string;
  department: string;
  title: string;
  seniorityLevel: number;
  status: string;
  canAccessRotasyon: boolean;
};

// Token'lar gerçek kullanıcıların erişim alanlarını taşır; DB'ye yazılmaz.
const ahmetOruc: Tok = {
  id: "tok-ahmetoruc", email: "ahmetoruc@vezin.com.tr", name: "Ahmet Oruç",
  role: "EMPLOYEE", department: "BAGIMSIZ_DENETIM", title: "Partner", seniorityLevel: 14,
  status: "ACTIVE", canAccessRotasyon: false,
};
const bdSenior1: Tok = {
  id: "tok-bd-senior1", email: "bd-senior1@rot.test", name: "BD Senior 1",
  role: "EMPLOYEE", department: "BAGIMSIZ_DENETIM", title: "Senior 1", seniorityLevel: 5,
  status: "ACTIVE", canAccessRotasyon: false,
};
const muratOzgur: Tok = {
  id: "tok-muratozgur", email: "muratozgur@vezin.com.tr", name: "Murat Özgür",
  role: "EMPLOYEE", department: "YEMINLI_MALI_MUSAVIR", title: "Partner", seniorityLevel: 14,
  status: "ACTIVE", canAccessRotasyon: false,
};
const admin: Tok = {
  id: "tok-admin", email: "admin@rot.test", name: "Admin",
  role: "ADMIN", department: "ADMIN", title: "", seniorityLevel: 0,
  status: "ACTIVE", canAccessRotasyon: false,
};
const flagUser: Tok = {
  id: "tok-flag", email: "flag@rot.test", name: "Bayraklı Kullanıcı",
  role: "EMPLOYEE", department: "MUHASEBE", title: "Senior 1", seniorityLevel: 5,
  status: "ACTIVE", canAccessRotasyon: true,
};

function asToken(t: Tok) {
  vi.mocked(getToken).mockResolvedValue(t as any);
}

const req = () => new Request("http://localhost/api/rotasyon/isletmeler") as any;

describe("GET /api/rotasyon/isletmeler — erişim", () => {
  it("RE1: BD Partner (Ahmet Oruç), bayrak olmadan → 200", async () => {
    asToken(ahmetOruc);
    const res = await isletmelerGET(req());
    expect(res.status).toBe(200);
    expect(Array.isArray(await res.json())).toBe(true);
  });

  it("RE2: BD Senior 1 → 404", async () => {
    asToken(bdSenior1);
    expect((await isletmelerGET(req())).status).toBe(404);
  });

  it("RE3: YMM Partner (Murat Özgür) → 404", async () => {
    asToken(muratOzgur);
    expect((await isletmelerGET(req())).status).toBe(404);
  });

  it("RE4: ADMIN, bayrak olmadan → 200", async () => {
    asToken(admin);
    expect((await isletmelerGET(req())).status).toBe(200);
  });

  it("RE5: canAccessRotasyon=true olan non-admin → 200", async () => {
    asToken(flagUser);
    expect((await isletmelerGET(req())).status).toBe(200);
  });

  it("RE6: pasif BD Partner ve pasif ADMIN → 404", async () => {
    asToken({ ...ahmetOruc, status: "INACTIVE" });
    expect((await isletmelerGET(req())).status).toBe(404);
    asToken({ ...admin, status: "INACTIVE" });
    expect((await isletmelerGET(req())).status).toBe(404);
    asToken({ ...flagUser, status: "DELETED" });
    expect((await isletmelerGET(req())).status).toBe(404);
  });

  it("oturumsuz istek → 401", async () => {
    vi.mocked(getToken).mockResolvedValue(null);
    expect((await isletmelerGET(req())).status).toBe(401);
  });
});

describe("RE7 — canAccessRotasyon saf fonksiyon", () => {
  it("kural tablosu", () => {
    expect(canAccessRotasyon(ahmetOruc)).toBe(true);
    expect(canAccessRotasyon(admin)).toBe(true);
    expect(canAccessRotasyon(flagUser)).toBe(true);
    expect(canAccessRotasyon(bdSenior1)).toBe(false);
    expect(canAccessRotasyon(muratOzgur)).toBe(false);
    // BD'de olmayan Partner unvanı veya Partner olmayan BD yöneticisi yetmez
    const bdSeniorManager3: Tok = { ...bdSenior1, title: "Senior Manager 3", seniorityLevel: 13 };
    expect(canAccessRotasyon(bdSeniorManager3)).toBe(false);
    expect(canAccessRotasyon({ ...ahmetOruc, department: "OUTSOURCE" })).toBe(false);
    // status yoksa erişim yok
    expect(canAccessRotasyon({ role: "ADMIN" })).toBe(false);
  });
});
