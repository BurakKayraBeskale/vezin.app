/**
 * Feedback modülü (URL /petition, tablo Petition)
 *
 *   F1  Boş / yalnızca boşluk / eksik metin → 400
 *   F2  Geçerli gönderim → 201, kayıtta gönderen adı döner, anonim değil
 *   F3  Eski istemci isAnonymous=true gönderse bile gönderen kaydedilir
 *   F4  GET listesinde gönderen adı döner
 */

import { describe, it, expect, beforeAll, afterAll, vi } from "vitest";
import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";

vi.mock("next-auth", () => ({ getServerSession: vi.fn() }));

import { GET as petitionsGET, POST as petitionsPOST } from "../../app/api/petitions/route";
import { getServerSession } from "next-auth";

const prisma = new PrismaClient();
const PREFIX = `test-fb-${Date.now()}`;

let user: { id: string; name: string; email: string };

function asUser(u: { id: string; name: string; email: string }, role = "EMPLOYEE") {
  vi.mocked(getServerSession).mockResolvedValue({
    user: { id: u.id, name: u.name, email: u.email, role },
  } as any);
}

function post(body: unknown) {
  return new Request("http://localhost/api/petitions", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  }) as any;
}

beforeAll(async () => {
  const u = await prisma.user.create({
    data: {
      name: `${PREFIX} Feedback Kullanıcı`,
      email: `${PREFIX}@fb.test`,
      password: await bcrypt.hash("test", 4),
      role: "EMPLOYEE",
      department: "MUHASEBE",
    },
  });
  user = { id: u.id, name: u.name, email: u.email };
});

afterAll(async () => {
  await prisma.petition.deleteMany({ where: { userId: user.id } });
  await prisma.user.deleteMany({ where: { id: user.id } });
  await prisma.$disconnect();
});

describe("POST /api/petitions", () => {
  it("F1: boş metinle gönderilemiyor → 400", async () => {
    asUser(user);
    expect((await petitionsPOST(post({ message: "" }))).status).toBe(400);
    expect((await petitionsPOST(post({ message: "   \n  " }))).status).toBe(400);
    expect((await petitionsPOST(post({}))).status).toBe(400);
    expect(await prisma.petition.count({ where: { userId: user.id } })).toBe(0);
  });

  it("F2: geçerli gönderimde kayıt gönderen adıyla döner", async () => {
    asUser(user);
    const res = await petitionsPOST(post({ message: "  Toplantı odası rezervasyonu eklensin.  " }));
    expect(res.status).toBe(201);
    const body = await res.json();
    expect(body.message).toBe("Toplantı odası rezervasyonu eklensin.");
    expect(body.isAnonymous).toBe(false);
    expect(body.userId).toBe(user.id);
    expect(body.user?.name).toBe(user.name);
  });

  it("F3: isAnonymous=true gönderilse bile gönderen kaydedilir", async () => {
    asUser(user);
    const res = await petitionsPOST(post({ message: "Anonim denemesi", isAnonymous: true, category: "COMPLAINT" }));
    expect(res.status).toBe(201);
    const body = await res.json();
    expect(body.isAnonymous).toBe(false);
    expect(body.user?.name).toBe(user.name);
  });

  it("oturumsuz → 401", async () => {
    vi.mocked(getServerSession).mockResolvedValue(null);
    expect((await petitionsPOST(post({ message: "x" }))).status).toBe(401);
  });
});

describe("GET /api/petitions", () => {
  it("F4: listede gönderen adı döner (kullanıcı ve admin görünümü)", async () => {
    asUser(user);
    const own = await (await petitionsGET()).json();
    expect(own.length).toBeGreaterThanOrEqual(2);
    for (const p of own) expect(p.user?.name).toBe(user.name);

    asUser({ id: "admin-x", name: "Admin", email: "admin@fb.test" }, "ADMIN");
    const all = await (await petitionsGET()).json();
    const mine = all.filter((p: any) => p.userId === user.id);
    expect(mine.length).toBeGreaterThanOrEqual(2);
    for (const p of mine) expect(p.user?.name).toBe(user.name);
  });
});
