/**
 * Rotasyon modülü — aynı yıl için ikinci (farklı türde) sözleşme testleri
 *
 * Kök sebep: RotasyonSozlesme.@@unique([isletmeId, donem]) yalnızca işletme+yıl
 * bazında benzersizlik kısıtlıyordu — aynı yılda farklı türde ikinci sözleşme de
 * engelleniyordu. Kısıt artık [isletmeId, donem, tur].
 *
 *   R1  Aynı işletme + aynı yıl + FARKLI tür → 201 (izin verilir)
 *   R2  Aynı işletme + aynı yıl + AYNI tür → 409, anlaşılır mesaj
 *   R3  PATCH (düzenleme) tarafında da aynı kural geçerli → 409
 *   R4  GET listede aynı yıldaki iki sözleşme ayrı satır olarak, türleriyle döner
 *   R5  hesaplaRotasyon: aynı yıla ikinci (farklı türde) sözleşme eklenince
 *       denetlenenSure/aktifSeri artmıyor — dönem bazında tekilleştiriliyor
 */

import { describe, it, expect, beforeAll, afterAll, vi } from "vitest";
import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";

vi.mock("next-auth", () => ({ getServerSession: vi.fn() }));
vi.mock("next-auth/jwt", () => ({ getToken: vi.fn() }));

import { GET as sozlesmelerGET, POST as sozlesmelerPOST } from "../../app/api/rotasyon/sozlesmeler/route";
import { PATCH as sozlesmePATCH } from "../../app/api/rotasyon/sozlesmeler/[id]/route";
import { getToken } from "next-auth/jwt";
import { hesaplaRotasyon, VARSAYILAN_ROTASYON_AYARLARI } from "../../lib/rotasyon";

const prisma = new PrismaClient();
const hash = (pw: string) => bcrypt.hash(pw, 10);
const PREFIX = `test-rot-${Date.now()}`;
const email = (slug: string) => `${PREFIX}-${slug}@rot.test`;

type TUser = { id: string; email: string; name: string; role: string };

function asUser(u: TUser) {
  vi.mocked(getToken).mockResolvedValue({
    id: u.id, name: u.name, email: u.email, role: u.role, canAccessRotasyon: true,
  } as any);
}

function jsonReq(url: string, method: string, body?: object) {
  return new Request(url, {
    method,
    headers: { "Content-Type": "application/json" },
    ...(body ? { body: JSON.stringify(body) } : {}),
  }) as any;
}

async function json(res: Response) { return res.json(); }

const cleanupUserIds: string[] = [];
const cleanupIsletmeIds: string[] = [];

let user: TUser;
let isletmeId: string;

beforeAll(async () => {
  const u = await prisma.user.create({
    data: {
      name: `${PREFIX} rot-user`, email: email("user"), password: await hash("test"),
      role: "EMPLOYEE", department: "BAGIMSIZ_DENETIM", canAccessRotasyon: true,
    },
  });
  cleanupUserIds.push(u.id);
  user = { id: u.id, email: u.email, name: u.name, role: u.role };

  const isl = await prisma.rotasyonIsletme.create({
    data: { unvan: `${PREFIX} İşletme`, vkn: "1234567890" },
  });
  cleanupIsletmeIds.push(isl.id);
  isletmeId = isl.id;
});

afterAll(async () => {
  await prisma.rotasyonSozlesme.deleteMany({ where: { isletmeId: { in: cleanupIsletmeIds } } });
  await prisma.rotasyonIsletme.deleteMany({ where: { id: { in: cleanupIsletmeIds } } });
  await prisma.user.deleteMany({ where: { id: { in: cleanupUserIds } } });
  await prisma.$disconnect();
});

const createdSozlesmeIds: string[] = [];

describe("R1/R2 — POST /api/rotasyon/sozlesmeler benzersizlik", () => {
  it("R1: aynı işletme + aynı yıl + FARKLI tür → 201", async () => {
    asUser(user);
    const res1 = await sozlesmelerPOST(jsonReq(
      "http://localhost/api/rotasyon/sozlesmeler", "POST",
      { isletmeId, sozlesmeNo: `${PREFIX}-1`, donem: 2025, tur: "TTK_ZORUNLU", kadrolar: [] }
    ));
    expect(res1.status).toBe(201);
    const data1 = await json(res1);
    createdSozlesmeIds.push(data1.id);

    const res2 = await sozlesmelerPOST(jsonReq(
      "http://localhost/api/rotasyon/sozlesmeler", "POST",
      { isletmeId, sozlesmeNo: `${PREFIX}-2`, donem: 2025, tur: "SPK_ZORUNLU", kadrolar: [] }
    ));
    expect(res2.status).toBe(201);
    const data2 = await json(res2);
    createdSozlesmeIds.push(data2.id);
    expect(data2.donem).toBe(2025);
    expect(data2.tur).toBe("SPK_ZORUNLU");
  });

  it("R2: aynı işletme + aynı yıl + AYNI tür → 409, anlaşılır mesaj", async () => {
    asUser(user);
    const res = await sozlesmelerPOST(jsonReq(
      "http://localhost/api/rotasyon/sozlesmeler", "POST",
      { isletmeId, sozlesmeNo: `${PREFIX}-3`, donem: 2025, tur: "TTK_ZORUNLU", kadrolar: [] }
    ));
    expect(res.status).toBe(409);
    const data = await json(res);
    expect(data.error).toMatch(/2025/);
    expect(data.error).toMatch(/türde/i);
  });

  it("R4: GET listede iki sözleşme ayrı kayıt, türleriyle döner", async () => {
    asUser(user);
    const res = await sozlesmelerGET(jsonReq("http://localhost/api/rotasyon/sozlesmeler", "GET"));
    expect(res.status).toBe(200);
    const all = await json(res);
    const bizim = all.filter((s: any) => s.isletmeId === isletmeId && s.donem === 2025);
    expect(bizim.length).toBe(2);
    const turler = bizim.map((s: any) => s.tur).sort();
    expect(turler).toEqual(["SPK_ZORUNLU", "TTK_ZORUNLU"]);
  });
});

describe("R3 — PATCH (düzenleme) tarafında da aynı kural", () => {
  it("başka bir sözleşmeyi mevcut (işletme+yıl+tür) ile çakışacak şekilde düzenlemek → 409", async () => {
    // Üçüncü, farklı yıl/türde bir sözleşme oluştur, sonra onu 2025/TTK_ZORUNLU'ya çekmeyi dene
    asUser(user);
    const createRes = await sozlesmelerPOST(jsonReq(
      "http://localhost/api/rotasyon/sozlesmeler", "POST",
      { isletmeId, sozlesmeNo: `${PREFIX}-4`, donem: 2026, tur: "GUVENCE", kadrolar: [] }
    ));
    expect(createRes.status).toBe(201);
    const created = await json(createRes);
    createdSozlesmeIds.push(created.id);

    const patchRes = await sozlesmePATCH(
      jsonReq(`http://localhost/api/rotasyon/sozlesmeler/${created.id}`, "PATCH", { donem: 2025, tur: "TTK_ZORUNLU" }),
      { params: { id: created.id } }
    );
    expect(patchRes.status).toBe(409);
    const data = await json(patchRes);
    expect(data.error).toMatch(/2025/);
    expect(data.error).toMatch(/türde/i);
  });
});

describe("R5 — rotasyon hesabı: aynı yıla ikinci sözleşme eklenince yıl sayısı artmıyor", () => {
  it("iki farklı türde ama aynı yıla ait sözleşme, tek yıl olarak sayılır", () => {
    const ayar = { ...VARSAYILAN_ROTASYON_AYARLARI, cariDonem: 2026 };
    const tekYil = hesaplaRotasyon([2023, 2024, 2025], ayar, 2026);
    // 2025 yılına aynı yıl içinde ikinci (farklı türde) bir sözleşme eklenince
    // donem listesi [2023,2024,2025,2025] olur — distinct'e göre hesap DEĞİŞMEMELİ.
    const ikiSozlesmeAyniYil = hesaplaRotasyon([2023, 2024, 2025, 2025], ayar, 2026);

    expect(ikiSozlesmeAyniYil).not.toBeNull();
    expect(ikiSozlesmeAyniYil!.denetlenenSure).toBe(tekYil!.denetlenenSure);
    expect(ikiSozlesmeAyniYil!.aktifSeri).toEqual(tekYil!.aktifSeri);
    expect(ikiSozlesmeAyniYil!.donemler).toEqual([2023, 2024, 2025]);
    expect(ikiSozlesmeAyniYil!.kalanSure).toBe(tekYil!.kalanSure);
    expect(ikiSozlesmeAyniYil!.durum).toBe(tekYil!.durum);
  });
});
