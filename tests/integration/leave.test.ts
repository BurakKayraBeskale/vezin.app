/**
 * İzin Yönetimi modülü — entegrasyon testleri
 *
 *   L1  YMM talebini Murat Özgür VE Ebubekir Öztürk onaylayabiliyor
 *   L2  Ahmet Oruç YMM talebini onaylayamıyor → 403
 *   L3  BAGIMSIZ_DENETIM talebini Ahmet Oruç onaylayabiliyor
 *   L4  MUHASEBE talebini İsmail Koş onaylayabiliyor
 *   L5  Kimse kendi talebini onaylayamıyor → 403 (ADMIN dahil)
 *   L6  Murat Özgür'ün talebini İsmail Koş onaylayabiliyor
 *   L7  Reddetme gerekçesiz → 400
 *   L8  hesaplaIzinHakki: 2017 girişli 20 gün, 2024 girişli 14 gün, 2026 girişli 0 gün
 *   L9  hireDate NULL olanda hesaplama yapılmıyor, hata da vermiyor
 *   L10 Başkasının talebini göremeyen kullanıcı → 404
 *   L11 isGunuSayisi: hafta sonu gün sayısına dahil değil
 *   L12 Ekler: POST/create — bitiş < başlangıç → 400; iş günü olmayan aralık → 400
 *   L13 Talep sahibi PENDING talebini iptal edebilir (CANCELLED); APPROVED/REJECTED işlem göremez
 *   L14 GET /api/leave/team — onaylayıcı olmayan → 404, onaylayıcı → yalnızca kapsamındaki personel
 *   L15 Ek dosya indirme: yetkisiz kullanıcı → 404
 *
 * === /izin-durumu — "Personel İzin Durumu" ayrı sayfa (getLeaveOverviewScope) ===
 *   L16 Sıradan kullanıcı GET /api/leave/team/[kendi id'si] ile kendi özetini görebiliyor
 *   L17 Sıradan kullanıcı GET /api/leave/team'e erişemiyor → 404
 *   L18 Murat Özgür ve Ebubekir Öztürk yalnızca YEMINLI_MALI_MUSAVIR kadrosunu görüyor
 *   L19 İsmail Koş ve ADMIN tüm personeli görüyor
 *   L20 Ahmet Oruç bir YMM personelinin detayını isteyince → 404
 *   L21 GET /api/leave yanıtında personel listesi verisi (users alanı) dönmüyor
 *
 * === showInLeaveOverview — İsmail Koş /izin-durumu listesinden gizli ===
 *   L22 GET /api/leave/team yanıtında İsmail Koş dönmüyor
 *   L23 İsmail Koş kendi özetini hâlâ görüyor (GET /api/leave/team/[kendi id'si])
 *   L24 İsmail Koş diğer personeli görmeye devam ediyor
 *
 * === Hizmet süresi metni (yıl/ay/gün) — bkz. lib/leave.ts hizmetSuresiMetni ===
 *   L25 6 ay 1 günlük hizmet süresi doğru metinle dönüyor, izin hakkı yine 0 gün
 *   L26 2 yıl 3 aylık kullanıcıda hak 14 gün (gösterim değişse de hesap aynı)
 *
 * === İzin bildirimleri (lib/notifications.ts) ===
 *   L27 Yeni talepte onaylayıcılara bildirim gidiyor, başkasına gitmiyor
 *   L28 Onay bildirimi talep sahibine gidiyor
 *   L29 Ret bildirimi talep sahibine gidiyor, gerekçe mesajda görünüyor
 *   L30 Talep sahibi iptal edince onaylayıcılara bildirim gidiyor
 *
 * === İptal edilen talep — soft delete (deletedAt) ===
 *   L31 İptal edilen talep GET /api/leave yanıtında dönmüyor
 *   L32 İptal edilen talep GET /api/leave/team/[userId] "requests" listesinde dönmüyor
 *   L33 İptal edilen talep kullanılan gün toplamına eklenmiyor
 *
 * === Birikmiş hak + devir bakiyesi (carryUsedDays) ===
 *   L34 toplamHakEdilenIzin: 2017-01-02 → 150, 2013-09-24 → 230, 2022-03-28 → 56, 2026-06-03 → 0
 *   L35 carryUsedDays 143, uygulama içi izin yok → kullanılan 143
 *   L36 Onaylanmış 3 günlük izin eklenince kullanılan 146
 *   L37 İptal edilen izin kullanılana eklenmiyor
 *   L38 Kalan eksi çıkabiliyor, işlem engellenmiyor
 *   L39 Yarım gün (44.5) kayıpsız saklanıyor
 */

import { describe, it, expect, beforeAll, afterAll, vi } from "vitest";
import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";

vi.mock("next-auth", () => ({ getServerSession: vi.fn() }));
vi.mock("next-auth/jwt", () => ({ getToken: vi.fn() }));

import { GET as leaveGET, POST as leavePOST } from "../../app/api/leave/route";
import { GET as leaveByIdGET, PATCH as leavePATCH } from "../../app/api/leave/[id]/route";
import { GET as leaveTeamGET } from "../../app/api/leave/team/route";
import { GET as leaveTeamByIdGET } from "../../app/api/leave/team/[userId]/route";
import { POST as leaveAttachmentsPOST } from "../../app/api/leave/[id]/attachments/route";
import { GET as leaveAttachmentDownloadGET } from "../../app/api/leave/[id]/attachments/[attachmentId]/download/route";
import { getServerSession } from "next-auth";
import { getToken } from "next-auth/jwt";
import { gunMetni, hesaplaIzinHakki, hizmetSuresiMetni, isGunuSayisi, izinBakiyesi, toplamHakEdilenIzin } from "../../lib/leave";

const prisma = new PrismaClient();
const hash = (pw: string) => bcrypt.hash(pw, 10);
const PREFIX = `test-leave-${Date.now()}`;
const email = (slug: string) => `${PREFIX}-${slug}@leave.test`;

type TUser = { id: string; email: string; name: string; role: string; department: string };

function asUser(u: TUser) {
  const token = { id: u.id, name: u.name, email: u.email, role: u.role, department: u.department };
  const session = { user: token, expires: new Date(Date.now() + 86_400_000).toISOString() };
  vi.mocked(getServerSession).mockResolvedValue(session as any);
  vi.mocked(getToken).mockResolvedValue(token as any);
}

function jsonReq(url: string, method: string, body?: object): any {
  return new Request(url, {
    method,
    ...(body ? { headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) } : {}),
  });
}
async function json(res: Response) { return res.json(); }

const createdUserIds: string[] = [];
const createdLeaveIds: string[] = [];

/** Gerçek e-postalı kullanıcı — varsa DOKUNMADAN referans alır, yoksa oluşturup cleanup'a ekler. */
async function realUser(emailAddr: string, fallback: { name: string; department: string }): Promise<TUser> {
  const existing = await prisma.user.findUnique({ where: { email: emailAddr } });
  if (existing) {
    return { id: existing.id, email: existing.email, name: existing.name, role: existing.role, department: existing.department };
  }
  const created = await prisma.user.create({
    data: {
      name: fallback.name, email: emailAddr, password: await hash("test123"),
      role: "EMPLOYEE", department: fallback.department,
    },
  });
  createdUserIds.push(created.id);
  return { id: created.id, email: created.email, name: created.name, role: created.role, department: created.department };
}

async function mkUser(slug: string, department: string, hireDate?: string | null, carryUsedDays?: number): Promise<TUser> {
  const u = await prisma.user.create({
    data: {
      name: `${PREFIX} ${slug}`, email: email(slug), password: await hash("test"),
      role: "EMPLOYEE", department,
      hireDate: hireDate === undefined ? undefined : hireDate === null ? null : new Date(hireDate),
      carryUsedDays,
    },
  });
  createdUserIds.push(u.id);
  return { id: u.id, email: u.email, name: u.name, role: u.role, department: u.department };
}

async function mkLeave(userId: string, opts: { status?: string; type?: string; startDate?: Date; endDate?: Date }) {
  const start = opts.startDate ?? new Date("2026-03-02T00:00:00.000Z"); // Pazartesi
  const end = opts.endDate ?? new Date("2026-03-04T00:00:00.000Z"); // Çarşamba
  const l = await prisma.leaveRequest.create({
    data: {
      userId, startDate: start, endDate: end,
      days: isGunuSayisi(start, end),
      type: opts.type ?? "ANNUAL",
      status: opts.status ?? "PENDING",
    },
  });
  createdLeaveIds.push(l.id);
  return l.id;
}

let adminUser: TUser;
let muratOzgur: TUser;
let ebubekirOzturk: TUser;
let ahmetOruc: TUser;
let ismailKos: TUser;
let ymmEmployee: TUser;
let bdEmployee: TUser;
let muhasebeEmployee: TUser;
let outsourceEmployee: TUser;

beforeAll(async () => {
  const adminRow = await prisma.user.create({
    data: { name: `${PREFIX} admin`, email: email("admin"), password: await hash("test"), role: "ADMIN", department: "ADMIN" },
  });
  createdUserIds.push(adminRow.id);
  adminUser = { id: adminRow.id, email: adminRow.email, name: adminRow.name, role: adminRow.role, department: adminRow.department };

  [muratOzgur, ebubekirOzturk, ahmetOruc, ismailKos] = await Promise.all([
    realUser("muratozgur@vezin.com.tr", { name: "Murat Özgür", department: "OUTSOURCE" }),
    realUser("ebubekirozturk@vezin.com.tr", { name: "Ebubekir Öztürk", department: "OUTSOURCE" }),
    realUser("ahmetoruc@vezin.com.tr", { name: "Ahmet Oruç", department: "OUTSOURCE" }),
    realUser("ismailkos@vezin.com.tr", { name: "İsmail Koş", department: "OUTSOURCE" }),
  ]);

  [ymmEmployee, bdEmployee, muhasebeEmployee, outsourceEmployee] = await Promise.all([
    mkUser("ymm-emp", "YEMINLI_MALI_MUSAVIR"),
    mkUser("bd-emp", "BAGIMSIZ_DENETIM"),
    mkUser("muhasebe-emp", "MUHASEBE"),
    mkUser("outsource-emp", "OUTSOURCE"),
  ]);
});

afterAll(async () => {
  await prisma.notification.deleteMany({ where: { relatedId: { in: createdLeaveIds } } });
  await prisma.leaveRequest.deleteMany({ where: { id: { in: createdLeaveIds } } });
  await prisma.user.deleteMany({ where: { id: { in: createdUserIds } } });
  await prisma.$disconnect();
});

describe("L1 — YMM talebini Murat Özgür ve Ebubekir Öztürk onaylayabiliyor", () => {
  it("Murat Özgür onaylayabiliyor", async () => {
    const id = await mkLeave(ymmEmployee.id, {});
    asUser(muratOzgur);
    const res = await leavePATCH(jsonReq(`http://localhost/api/leave/${id}`, "PATCH", { action: "approve" }), { params: { id } });
    expect(res.status).toBe(200);
    const data = await json(res);
    expect(data.status).toBe("APPROVED");
  });

  it("Ebubekir Öztürk onaylayabiliyor", async () => {
    const id = await mkLeave(ymmEmployee.id, {});
    asUser(ebubekirOzturk);
    const res = await leavePATCH(jsonReq(`http://localhost/api/leave/${id}`, "PATCH", { action: "approve" }), { params: { id } });
    expect(res.status).toBe(200);
  });
});

describe("L2 — Ahmet Oruç YMM talebini onaylayamıyor", () => {
  it("403 döner", async () => {
    const id = await mkLeave(ymmEmployee.id, {});
    asUser(ahmetOruc);
    const res = await leavePATCH(jsonReq(`http://localhost/api/leave/${id}`, "PATCH", { action: "approve" }), { params: { id } });
    expect(res.status).toBe(403);
  });
});

describe("L3 — BAGIMSIZ_DENETIM talebini Ahmet Oruç onaylayabiliyor", () => {
  it("200 döner", async () => {
    const id = await mkLeave(bdEmployee.id, {});
    asUser(ahmetOruc);
    const res = await leavePATCH(jsonReq(`http://localhost/api/leave/${id}`, "PATCH", { action: "approve" }), { params: { id } });
    expect(res.status).toBe(200);
  });
});

describe("L4 — MUHASEBE talebini İsmail Koş onaylayabiliyor", () => {
  it("200 döner", async () => {
    const id = await mkLeave(muhasebeEmployee.id, {});
    asUser(ismailKos);
    const res = await leavePATCH(jsonReq(`http://localhost/api/leave/${id}`, "PATCH", { action: "approve" }), { params: { id } });
    expect(res.status).toBe(200);
  });

  it("OUTSOURCE talebini de İsmail Koş onaylayabiliyor", async () => {
    const id = await mkLeave(outsourceEmployee.id, {});
    asUser(ismailKos);
    const res = await leavePATCH(jsonReq(`http://localhost/api/leave/${id}`, "PATCH", { action: "approve" }), { params: { id } });
    expect(res.status).toBe(200);
  });
});

describe("L5 — Kimse kendi talebini onaylayamıyor", () => {
  it("YMM onaylayıcısı kendi talebini onaylayamaz → 403", async () => {
    const id = await mkLeave(muratOzgur.id, {});
    asUser(muratOzgur);
    const res = await leavePATCH(jsonReq(`http://localhost/api/leave/${id}`, "PATCH", { action: "approve" }), { params: { id } });
    expect(res.status).toBe(403);
  });

  it("ADMIN de kendi talebini onaylayamaz → 403", async () => {
    const id = await mkLeave(adminUser.id, {});
    asUser(adminUser);
    const res = await leavePATCH(jsonReq(`http://localhost/api/leave/${id}`, "PATCH", { action: "approve" }), { params: { id } });
    expect(res.status).toBe(403);
  });
});

describe("L6 — Murat Özgür'ün talebini İsmail Koş onaylayabiliyor", () => {
  it("200 döner (Murat'ın gerçek departmanı OUTSOURCE olduğundan İsmail'in kapsamına düşer)", async () => {
    const id = await mkLeave(muratOzgur.id, {});
    asUser(ismailKos);
    const res = await leavePATCH(jsonReq(`http://localhost/api/leave/${id}`, "PATCH", { action: "approve" }), { params: { id } });
    expect(res.status).toBe(200);
  });
});

describe("L7 — Reddetme gerekçesiz → 400", () => {
  it("reviewNote olmadan reject → 400, talep hâlâ PENDING", async () => {
    const id = await mkLeave(ymmEmployee.id, {});
    asUser(muratOzgur);
    const res = await leavePATCH(jsonReq(`http://localhost/api/leave/${id}`, "PATCH", { action: "reject" }), { params: { id } });
    expect(res.status).toBe(400);
    const check = await prisma.leaveRequest.findUnique({ where: { id } });
    expect(check?.status).toBe("PENDING");
  });

  it("reviewNote ile reject → 200, REJECTED + reviewNote kaydedilir", async () => {
    const id = await mkLeave(ymmEmployee.id, {});
    asUser(ebubekirOzturk);
    const res = await leavePATCH(
      jsonReq(`http://localhost/api/leave/${id}`, "PATCH", { action: "reject", reviewNote: "Yoğun dönem" }),
      { params: { id } }
    );
    expect(res.status).toBe(200);
    const data = await json(res);
    expect(data.status).toBe("REJECTED");
    expect(data.reviewNote).toBe("Yoğun dönem");
    expect(data.reviewedBy).toBe(ebubekirOzturk.name);
  });
});

describe("L8 — hesaplaIzinHakki (İş Kanunu md.53)", () => {
  it("2017 girişli → 20 gün", () => {
    const sonuc = hesaplaIzinHakki(new Date("2017-01-02"), new Date("2026-09-24"));
    expect(sonuc.hizmetYili).toBe(9);
    expect(sonuc.hakEdilenGun).toBe(20);
  });

  it("2024 girişli → 14 gün", () => {
    const sonuc = hesaplaIzinHakki(new Date("2024-04-03"), new Date("2026-09-24"));
    expect(sonuc.hizmetYili).toBe(2);
    expect(sonuc.hakEdilenGun).toBe(14);
  });

  it("2026 girişli (henüz 1 yıl dolmamış) → 0 gün", () => {
    const sonuc = hesaplaIzinHakki(new Date("2026-06-03"), new Date("2026-09-24"));
    expect(sonuc.hizmetYili).toBe(0);
    expect(sonuc.hakEdilenGun).toBe(0);
  });

  it("tam 5 yıl → 14 gün (5 dahil), tam 15 yıl → 26 gün (15 dahil)", () => {
    expect(hesaplaIzinHakki(new Date("2021-06-01"), new Date("2026-06-01")).hakEdilenGun).toBe(14);
    expect(hesaplaIzinHakki(new Date("2011-06-01"), new Date("2026-06-01")).hakEdilenGun).toBe(26);
  });
});

describe("L9 — hireDate NULL olanda hesaplama yapılmıyor, hata vermiyor", () => {
  it("hizmetYili/hakEdilenGun null, açıklayıcı mesaj döner", () => {
    const sonuc = hesaplaIzinHakki(null);
    expect(sonuc.hizmetYili).toBeNull();
    expect(sonuc.hakEdilenGun).toBeNull();
    // NOT: JS regex /i bayrağı Türkçe "İ"→"i" dönüşümünü doğru yapmaz — tam metin eşleşmesi kullanılır.
    expect(sonuc.mesaj).toBe("İşe giriş tarihi girilmemiş");
  });
});

describe("L10 — Başkasının talebini göremeyen kullanıcı → 404", () => {
  it("ilgisiz departmandan sıradan kullanıcı GET ile 404 alır", async () => {
    const id = await mkLeave(ymmEmployee.id, {});
    asUser(outsourceEmployee); // OUTSOURCE, onaylayıcı değil, talep sahibi değil
    const res = await leaveByIdGET(jsonReq(`http://localhost/api/leave/${id}`, "GET"), { params: { id } });
    expect(res.status).toBe(404);
  });

  it("aynı departmandan ama onaylayıcı olmayan biri de 404 alır", async () => {
    const otherYmm = await mkUser("ymm-other", "YEMINLI_MALI_MUSAVIR");
    const id = await mkLeave(ymmEmployee.id, {});
    asUser(otherYmm);
    const res = await leaveByIdGET(jsonReq(`http://localhost/api/leave/${id}`, "GET"), { params: { id } });
    expect(res.status).toBe(404);
  });

  it("talep sahibi kendi talebini görebilir", async () => {
    const id = await mkLeave(ymmEmployee.id, {});
    asUser(ymmEmployee);
    const res = await leaveByIdGET(jsonReq(`http://localhost/api/leave/${id}`, "GET"), { params: { id } });
    expect(res.status).toBe(200);
  });

  it("onaylayıcı kapsamındaki talebi görebilir", async () => {
    const id = await mkLeave(bdEmployee.id, {});
    asUser(ahmetOruc);
    const res = await leaveByIdGET(jsonReq(`http://localhost/api/leave/${id}`, "GET"), { params: { id } });
    expect(res.status).toBe(200);
  });
});

describe("L11 — isGunuSayisi: hafta sonu hariç", () => {
  it("Pazartesi-Cuma → 5 iş günü", () => {
    expect(isGunuSayisi(new Date("2026-03-02"), new Date("2026-03-06"))).toBe(5);
  });

  it("Cumartesi-Pazar → 0 iş günü", () => {
    expect(isGunuSayisi(new Date("2026-03-07"), new Date("2026-03-08"))).toBe(0);
  });

  it("Pazartesi-Pazartesi (bir sonraki hafta, hafta sonu dahil) → 6 iş günü", () => {
    // 2026-03-02 (Pzt) .. 2026-03-09 (Pzt): 8 gün, aradaki 1 Cmt+1 Paz hariç = 6
    expect(isGunuSayisi(new Date("2026-03-02"), new Date("2026-03-09"))).toBe(6);
  });
});

describe("L12 — POST /api/leave doğrulama", () => {
  it("bitiş < başlangıç → 400", async () => {
    asUser(ymmEmployee);
    const res = await leavePOST(jsonReq("http://localhost/api/leave", "POST", {
      startDate: "2026-06-10", endDate: "2026-06-05", type: "ANNUAL",
    }));
    expect(res.status).toBe(400);
  });

  it("yalnızca hafta sonu içeren aralık (iş günü yok) → 400", async () => {
    asUser(ymmEmployee);
    const res = await leavePOST(jsonReq("http://localhost/api/leave", "POST", {
      startDate: "2026-03-07", endDate: "2026-03-08", type: "ANNUAL",
    }));
    expect(res.status).toBe(400);
  });

  it("geçerli istek → 201, status PENDING, days doğru hesaplanır", async () => {
    asUser(ymmEmployee);
    const res = await leavePOST(jsonReq("http://localhost/api/leave", "POST", {
      startDate: "2026-05-04", endDate: "2026-05-06", type: "SICK",
    }));
    expect(res.status).toBe(201);
    const data = await json(res);
    createdLeaveIds.push(data.id);
    expect(data.status).toBe("PENDING");
    expect(data.days).toBe(3);
    expect(data.type).toBe("SICK");
  });
});

describe("L13 — İptal ve tekrar işlem yasağı", () => {
  it("talep sahibi PENDING talebini iptal edebilir", async () => {
    const id = await mkLeave(ymmEmployee.id, {});
    asUser(ymmEmployee);
    const res = await leavePATCH(jsonReq(`http://localhost/api/leave/${id}`, "PATCH", { action: "cancel" }), { params: { id } });
    expect(res.status).toBe(200);
    const data = await json(res);
    expect(data.status).toBe("CANCELLED");
  });

  it("talep sahibi olmayan biri iptal edemez → 403", async () => {
    const id = await mkLeave(ymmEmployee.id, {});
    asUser(muratOzgur); // onaylayıcı ama sahibi değil
    const res = await leavePATCH(jsonReq(`http://localhost/api/leave/${id}`, "PATCH", { action: "cancel" }), { params: { id } });
    expect(res.status).toBe(403);
  });

  it("APPROVED talep bir daha onaylanamaz/reddedilemez → 400", async () => {
    const id = await mkLeave(ymmEmployee.id, { status: "APPROVED" });
    asUser(muratOzgur);
    const res = await leavePATCH(jsonReq(`http://localhost/api/leave/${id}`, "PATCH", { action: "reject", reviewNote: "x" }), { params: { id } });
    expect(res.status).toBe(400);
  });
});

describe("L14 — GET /api/leave/team", () => {
  it("onaylayıcı olmayan sıradan kullanıcı → 404", async () => {
    asUser(ymmEmployee);
    const res = await leaveTeamGET(jsonReq("http://localhost/api/leave/team", "GET"));
    expect(res.status).toBe(404);
  });

  it("Ahmet Oruç yalnızca BAGIMSIZ_DENETIM kapsamını görür", async () => {
    asUser(ahmetOruc);
    const res = await leaveTeamGET(jsonReq("http://localhost/api/leave/team", "GET"));
    expect(res.status).toBe(200);
    const data = await json(res);
    const ids = data.users.map((u: any) => u.id);
    expect(ids).toContain(bdEmployee.id);
    expect(ids).not.toContain(ymmEmployee.id);
    expect(ids).not.toContain(muhasebeEmployee.id);
  });

  it("İsmail Koş tüm kapsamı görür (YMM dahil, yalnızca kendi onayladığı 4 departman değil)", async () => {
    asUser(ismailKos);
    const res = await leaveTeamGET(jsonReq("http://localhost/api/leave/team", "GET"));
    expect(res.status).toBe(200);
    const data = await json(res);
    const ids = data.users.map((u: any) => u.id);
    expect(ids).toContain(ymmEmployee.id);
    expect(ids).toContain(bdEmployee.id);
    expect(ids).toContain(muhasebeEmployee.id);
  });
});

describe("L15 — Ek dosya indirme yetkisi", () => {
  it("talep sahibi ekleyebilir; yetkisiz kullanıcı indiremez → 404, sahibi indirebilir", async () => {
    const id = await mkLeave(ymmEmployee.id, {});

    asUser(ymmEmployee);
    const fd = new FormData();
    fd.append("file", new File(["içerik"], "belge.txt", { type: "text/plain" }));
    const uploadRes = await leaveAttachmentsPOST(
      new Request(`http://localhost/api/leave/${id}/attachments`, { method: "POST", body: fd }) as any,
      { params: { id } }
    );
    expect(uploadRes.status).toBe(201);
    const attachment = await uploadRes.json();

    // İlgisiz kullanıcı indiremez
    asUser(outsourceEmployee);
    const forbiddenRes = await leaveAttachmentDownloadGET(
      new Request(`http://localhost/api/leave/${id}/attachments/${attachment.id}/download`) as any,
      { params: { id, attachmentId: attachment.id } }
    );
    expect(forbiddenRes.status).toBe(404);

    // Talep sahibi indirebilir
    asUser(ymmEmployee);
    const okRes = await leaveAttachmentDownloadGET(
      new Request(`http://localhost/api/leave/${id}/attachments/${attachment.id}/download`) as any,
      { params: { id, attachmentId: attachment.id } }
    );
    expect(okRes.status).toBe(200);

    // Onaylayıcı da indirebilir
    asUser(muratOzgur);
    const approverRes = await leaveAttachmentDownloadGET(
      new Request(`http://localhost/api/leave/${id}/attachments/${attachment.id}/download`) as any,
      { params: { id, attachmentId: attachment.id } }
    );
    expect(approverRes.status).toBe(200);
  });
});

describe("L16 — /izin-durumu: sıradan kullanıcı kendi özetini görebiliyor", () => {
  it("GET /api/leave/team/[kendi id'si] → 200, isOwner bypass ile kapsam dışı olsa da kendi özeti döner", async () => {
    asUser(outsourceEmployee); // getLeaveOverviewScope kapsamında DEĞİL
    const res = await leaveTeamByIdGET(
      jsonReq(`http://localhost/api/leave/team/${outsourceEmployee.id}`, "GET"),
      { params: { userId: outsourceEmployee.id } }
    );
    expect(res.status).toBe(200);
    const data = await json(res);
    expect(data.user.id).toBe(outsourceEmployee.id);
  });
});

describe("L17 — /izin-durumu: sıradan kullanıcı personel listesi API'sine erişemiyor", () => {
  it("GET /api/leave/team → 404", async () => {
    asUser(outsourceEmployee);
    const res = await leaveTeamGET(jsonReq("http://localhost/api/leave/team", "GET"));
    expect(res.status).toBe(404);
  });
});

describe("L18 — Murat Özgür ve Ebubekir Öztürk yalnızca YEMINLI_MALI_MUSAVIR kadrosunu görüyor", () => {
  it("Murat Özgür", async () => {
    asUser(muratOzgur);
    const res = await leaveTeamGET(jsonReq("http://localhost/api/leave/team", "GET"));
    expect(res.status).toBe(200);
    const data = await json(res);
    const ids = data.users.map((u: any) => u.id);
    expect(ids).toContain(ymmEmployee.id);
    expect(ids).not.toContain(bdEmployee.id);
    expect(ids).not.toContain(muhasebeEmployee.id);
    expect(ids).not.toContain(outsourceEmployee.id);
  });

  it("Ebubekir Öztürk", async () => {
    asUser(ebubekirOzturk);
    const res = await leaveTeamGET(jsonReq("http://localhost/api/leave/team", "GET"));
    expect(res.status).toBe(200);
    const data = await json(res);
    const ids = data.users.map((u: any) => u.id);
    expect(ids).toContain(ymmEmployee.id);
    expect(ids).not.toContain(bdEmployee.id);
  });
});

describe("L19 — İsmail Koş ve ADMIN tüm personeli görüyor", () => {
  it("İsmail Koş", async () => {
    asUser(ismailKos);
    const res = await leaveTeamGET(jsonReq("http://localhost/api/leave/team", "GET"));
    expect(res.status).toBe(200);
    const data = await json(res);
    const ids = data.users.map((u: any) => u.id);
    expect(ids).toContain(ymmEmployee.id);
    expect(ids).toContain(bdEmployee.id);
    expect(ids).toContain(muhasebeEmployee.id);
    expect(ids).toContain(outsourceEmployee.id);
  });

  it("ADMIN", async () => {
    asUser(adminUser);
    const res = await leaveTeamGET(jsonReq("http://localhost/api/leave/team", "GET"));
    expect(res.status).toBe(200);
    const data = await json(res);
    const ids = data.users.map((u: any) => u.id);
    expect(ids).toContain(ymmEmployee.id);
    expect(ids).toContain(bdEmployee.id);
  });
});

describe("L20 — Ahmet Oruç bir YMM personelinin detayını isteyince → 404", () => {
  it("GET /api/leave/team/[ymmEmployee.id] → 404", async () => {
    asUser(ahmetOruc);
    const res = await leaveTeamByIdGET(
      jsonReq(`http://localhost/api/leave/team/${ymmEmployee.id}`, "GET"),
      { params: { userId: ymmEmployee.id } }
    );
    expect(res.status).toBe(404);
  });
});

describe("L21 — GET /api/leave yanıtında personel listesi verisi dönmüyor", () => {
  it("yanıt bir dizi (Taleplerim), users alanı içermiyor", async () => {
    asUser(ismailKos); // kapsamı ALL olsa dahi /api/leave yalnızca kendi taleplerini döner
    const res = await leaveGET();
    expect(res.status).toBe(200);
    const data = await json(res);
    expect(Array.isArray(data)).toBe(true);
    expect(data).not.toHaveProperty("users");
  });
});

describe("L22 — GET /api/leave/team yanıtında İsmail Koş dönmüyor", () => {
  it("İsmail Koş kendi sorguladığı listede kendisini görmüyor", async () => {
    asUser(ismailKos);
    const res = await leaveTeamGET(jsonReq("http://localhost/api/leave/team", "GET"));
    expect(res.status).toBe(200);
    const data = await json(res);
    const ids = data.users.map((u: any) => u.id);
    expect(ids).not.toContain(ismailKos.id);
  });

  it("ADMIN'in sorguladığı listede de İsmail Koş görünmüyor", async () => {
    asUser(adminUser);
    const res = await leaveTeamGET(jsonReq("http://localhost/api/leave/team", "GET"));
    expect(res.status).toBe(200);
    const data = await json(res);
    const ids = data.users.map((u: any) => u.id);
    expect(ids).not.toContain(ismailKos.id);
  });
});

describe("L23 — İsmail Koş kendi özetini hâlâ görüyor", () => {
  it("GET /api/leave/team/[kendi id'si] → 200, listede olmasa da kendi özeti dönüyor", async () => {
    asUser(ismailKos);
    const res = await leaveTeamByIdGET(
      jsonReq(`http://localhost/api/leave/team/${ismailKos.id}`, "GET"),
      { params: { userId: ismailKos.id } }
    );
    expect(res.status).toBe(200);
    const data = await json(res);
    expect(data.user.id).toBe(ismailKos.id);
  });
});

describe("L24 — İsmail Koş diğer personeli görmeye devam ediyor", () => {
  it("getLeaveOverviewScope=ALL aynen kalıyor: tüm departmanlardan (kendisi hariç) personel listede", async () => {
    asUser(ismailKos);
    const res = await leaveTeamGET(jsonReq("http://localhost/api/leave/team", "GET"));
    expect(res.status).toBe(200);
    const data = await json(res);
    const ids = data.users.map((u: any) => u.id);
    expect(ids).toContain(ymmEmployee.id);
    expect(ids).toContain(bdEmployee.id);
    expect(ids).toContain(muhasebeEmployee.id);
    expect(ids).toContain(outsourceEmployee.id);
  });

  it("bir personelin izin geçmişini onaylayıcı olarak görüntüleyebiliyor", async () => {
    asUser(ismailKos);
    const res = await leaveTeamByIdGET(
      jsonReq(`http://localhost/api/leave/team/${outsourceEmployee.id}`, "GET"),
      { params: { userId: outsourceEmployee.id } }
    );
    expect(res.status).toBe(200);
  });
});

describe("L25 — hizmetSuresiMetni: 6 ay 1 gün", () => {
  it("doğru metin döner, izin hakkı yine 0 gün (1 yıl dolmadığı için)", () => {
    const hireDate = new Date("2026-03-23");
    const simdi = new Date("2026-09-24");
    expect(hizmetSuresiMetni(hireDate, simdi)).toBe("6 ay 1 gün");
    const hak = hesaplaIzinHakki(hireDate, simdi);
    expect(hak.hakEdilenGun).toBe(0);
  });
});

describe("L26 — hizmetSuresiMetni: 2 yıl 3 ay", () => {
  it("gösterim '2 yıl 3 ay' olsa da hak hesabı tam yıl üzerinden 14 gün", () => {
    const hireDate = new Date("2024-06-24");
    const simdi = new Date("2026-09-24");
    expect(hizmetSuresiMetni(hireDate, simdi)).toBe("2 yıl 3 ay");
    const hak = hesaplaIzinHakki(hireDate, simdi);
    expect(hak.hizmetYili).toBe(2);
    expect(hak.hakEdilenGun).toBe(14);
  });

  it("hireDate NULL ise 'İşe giriş tarihi girilmemiş' döner (hesaplaIzinHakki mesajıyla aynı)", () => {
    expect(hizmetSuresiMetni(null)).toBe("İşe giriş tarihi girilmemiş");
  });

  it("1 günden az (bugün başladı) → 'Bugün başladı'", () => {
    const simdi = new Date("2026-09-24T15:00:00Z");
    expect(hizmetSuresiMetni(simdi, simdi)).toBe("Bugün başladı");
  });
});

describe("L27 — Yeni talepte onaylayıcılara bildirim gidiyor, başkasına gitmiyor", () => {
  it("YMM talebi → Murat Özgür + Ebubekir Öztürk'e gider, Ahmet Oruç/İsmail Koş'a gitmez", async () => {
    asUser(ymmEmployee);
    const res = await leavePOST(jsonReq("http://localhost/api/leave", "POST", {
      startDate: "2026-08-03", endDate: "2026-08-04", type: "ANNUAL",
    }));
    expect(res.status).toBe(201);
    const data = await json(res);
    createdLeaveIds.push(data.id);

    const notifs = await prisma.notification.findMany({ where: { relatedId: data.id } });
    const recipientIds = notifs.map((n) => n.userId);
    expect(recipientIds).toContain(muratOzgur.id);
    expect(recipientIds).toContain(ebubekirOzturk.id);
    expect(recipientIds).not.toContain(ahmetOruc.id);
    expect(recipientIds).not.toContain(ismailKos.id);
    expect(recipientIds).not.toContain(ymmEmployee.id);
    expect(notifs.every((n) => n.type === "LEAVE_REQUEST_NEW")).toBe(true);
  });

  it("OUTSOURCE talebi → yalnızca İsmail Koş'a gider (ADMIN'e yağmıyor)", async () => {
    asUser(outsourceEmployee);
    const res = await leavePOST(jsonReq("http://localhost/api/leave", "POST", {
      startDate: "2026-08-10", endDate: "2026-08-11", type: "ANNUAL",
    }));
    expect(res.status).toBe(201);
    const data = await json(res);
    createdLeaveIds.push(data.id);

    const notifs = await prisma.notification.findMany({ where: { relatedId: data.id } });
    const recipientIds = notifs.map((n) => n.userId);
    expect(recipientIds).toEqual([ismailKos.id]);
  });
});

describe("L28/L29 — Onay/ret bildirimi talep sahibine gidiyor", () => {
  it("Onay → talep sahibine LEAVE_APPROVED bildirimi", async () => {
    const id = await mkLeave(ymmEmployee.id, {});
    asUser(muratOzgur);
    const res = await leavePATCH(jsonReq(`http://localhost/api/leave/${id}`, "PATCH", { action: "approve" }), { params: { id } });
    expect(res.status).toBe(200);

    const notif = await prisma.notification.findFirst({ where: { relatedId: id, type: "LEAVE_APPROVED" } });
    expect(notif).toBeTruthy();
    expect(notif?.userId).toBe(ymmEmployee.id);
  });

  it("Ret → talep sahibine LEAVE_REJECTED bildirimi, gerekçe mesajda görünüyor", async () => {
    const id = await mkLeave(ymmEmployee.id, {});
    asUser(muratOzgur);
    const res = await leavePATCH(
      jsonReq(`http://localhost/api/leave/${id}`, "PATCH", { action: "reject", reviewNote: "Yoğun dönem" }),
      { params: { id } }
    );
    expect(res.status).toBe(200);

    const notif = await prisma.notification.findFirst({ where: { relatedId: id, type: "LEAVE_REJECTED" } });
    expect(notif).toBeTruthy();
    expect(notif?.userId).toBe(ymmEmployee.id);
    expect(notif?.message).toContain("Yoğun dönem");
  });
});

describe("L30 — Talep sahibi iptal edince onaylayıcılara bildirim gidiyor", () => {
  it("YMM talebini sahibi iptal edince Murat Özgür + Ebubekir Öztürk'e LEAVE_CANCELLED bildirimi gider", async () => {
    const id = await mkLeave(ymmEmployee.id, {});
    asUser(ymmEmployee);
    const res = await leavePATCH(jsonReq(`http://localhost/api/leave/${id}`, "PATCH", { action: "cancel" }), { params: { id } });
    expect(res.status).toBe(200);

    const notifs = await prisma.notification.findMany({ where: { relatedId: id, type: "LEAVE_CANCELLED" } });
    const recipientIds = notifs.map((n) => n.userId);
    expect(recipientIds).toContain(muratOzgur.id);
    expect(recipientIds).toContain(ebubekirOzturk.id);
    expect(recipientIds).not.toContain(ymmEmployee.id);
  });
});

describe("L31/L32/L33 — İptal edilen talep (soft delete) listelerden kalkıyor", () => {
  it("L31: GET /api/leave (Taleplerim) iptal edilen talebi döndürmüyor", async () => {
    const id = await mkLeave(ymmEmployee.id, {});
    asUser(ymmEmployee);
    const cancelRes = await leavePATCH(jsonReq(`http://localhost/api/leave/${id}`, "PATCH", { action: "cancel" }), { params: { id } });
    expect(cancelRes.status).toBe(200);

    const listRes = await leaveGET();
    const list = await json(listRes);
    expect(list.map((r: any) => r.id)).not.toContain(id);
  });

  it("L31b: iptal edilen talep DB'de fiziksel olarak silinmiyor — status=CANCELLED + deletedAt dolu", async () => {
    const id = await mkLeave(ymmEmployee.id, {});
    asUser(ymmEmployee);
    await leavePATCH(jsonReq(`http://localhost/api/leave/${id}`, "PATCH", { action: "cancel" }), { params: { id } });

    const row = await prisma.leaveRequest.findUnique({ where: { id } });
    expect(row).not.toBeNull();
    expect(row?.status).toBe("CANCELLED");
    expect(row?.deletedAt).not.toBeNull();
  });

  it("L32: GET /api/leave/team/[userId] 'requests' listesinde iptal edilen talep dönmüyor", async () => {
    const id = await mkLeave(ymmEmployee.id, { startDate: new Date("2026-04-06"), endDate: new Date("2026-04-07") });
    asUser(ymmEmployee);
    await leavePATCH(jsonReq(`http://localhost/api/leave/${id}`, "PATCH", { action: "cancel" }), { params: { id } });

    asUser(muratOzgur);
    const res = await leaveTeamByIdGET(
      jsonReq(`http://localhost/api/leave/team/${ymmEmployee.id}?year=2026`, "GET"),
      { params: { userId: ymmEmployee.id } }
    );
    expect(res.status).toBe(200);
    const data = await json(res);
    expect(data.requests.map((r: any) => r.id)).not.toContain(id);
  });

  it("L33: iptal edilen talep kullanılan gün toplamına eklenmiyor", async () => {
    asUser(muratOzgur);
    const before = await leaveTeamByIdGET(
      jsonReq(`http://localhost/api/leave/team/${ymmEmployee.id}?year=2026`, "GET"),
      { params: { userId: ymmEmployee.id } }
    );
    const beforeData = await json(before);
    const baseline = beforeData.kullanilanGun;

    const id = await mkLeave(ymmEmployee.id, {
      startDate: new Date("2026-04-13"), endDate: new Date("2026-04-15"), // 3 iş günü
    });
    asUser(ymmEmployee);
    await leavePATCH(jsonReq(`http://localhost/api/leave/${id}`, "PATCH", { action: "cancel" }), { params: { id } });

    asUser(muratOzgur);
    const after = await leaveTeamByIdGET(
      jsonReq(`http://localhost/api/leave/team/${ymmEmployee.id}?year=2026`, "GET"),
      { params: { userId: ymmEmployee.id } }
    );
    const afterData = await json(after);
    expect(afterData.kullanilanGun).toBe(baseline);
  });
});

// ── Birikmiş hak + devir bakiyesi (lib/leave.ts → toplamHakEdilenIzin / izinBakiyesi) ──

const BUGUN = new Date("2026-09-25T12:00:00");

describe("L34 — toplamHakEdilenIzin: birikmiş hak", () => {
  it("2017-01-02 girişli (9 yıl) → 5×14 + 4×20 = 150 gün", () => {
    expect(toplamHakEdilenIzin(new Date("2017-01-02"), BUGUN)).toBe(150);
  });
  it("2013-09-24 girişli (13 yıl) → 5×14 + 8×20 = 230 gün", () => {
    expect(toplamHakEdilenIzin(new Date("2013-09-24"), BUGUN)).toBe(230);
  });
  it("2022-03-28 girişli (4 yıl) → 56 gün", () => {
    expect(toplamHakEdilenIzin(new Date("2022-03-28"), BUGUN)).toBe(56);
  });
  it("2026-06-03 girişli (0 yıl) → 0 gün", () => {
    expect(toplamHakEdilenIzin(new Date("2026-06-03"), BUGUN)).toBe(0);
  });
  it("tamamlanmamış yıl sayılmaz — hak yıldönümünde doğar", () => {
    expect(toplamHakEdilenIzin(new Date("2022-09-26"), BUGUN)).toBe(42); // 3 yıl, 4. yıldönümüne 1 gün var
    expect(toplamHakEdilenIzin(new Date("2022-09-25"), BUGUN)).toBe(56); // 4. yıldönümü bugün
  });
  it("16. yıldan itibaren yıl başına 26 gün", () => {
    // 15 yıl → 5×14 + 10×20 = 270; 16 yıl → 270 + 26 = 296
    expect(toplamHakEdilenIzin(new Date("2011-09-25"), BUGUN)).toBe(270);
    expect(toplamHakEdilenIzin(new Date("2010-09-25"), BUGUN)).toBe(296);
  });
  it("hireDate NULL → null, hesap yapılmıyor", () => {
    expect(toplamHakEdilenIzin(null, BUGUN)).toBeNull();
    const b = izinBakiyesi(null, 31.5, 0, BUGUN);
    expect(b.toplamHakEdilenGun).toBeNull();
    expect(b.kalanGun).toBeNull();
    expect(b.kullanilanGun).toBe(31.5);
  });
});

describe("L35–L39 — Kullanılan = devir + uygulama içi onaylı yıllık izin", () => {
  let carryUser: TUser;

  beforeAll(async () => {
    carryUser = await mkUser("carry-143", "YEMINLI_MALI_MUSAVIR", "2017-01-02", 143);
  });

  async function ozet(u: TUser, year = 2026) {
    asUser(muratOzgur);
    const res = await leaveTeamByIdGET(
      jsonReq(`http://localhost/api/leave/team/${u.id}?year=${year}`, "GET"),
      { params: { userId: u.id } }
    );
    expect(res.status).toBe(200);
    return json(res);
  }

  it("L35: carryUsedDays 143, uygulama içi izin yok → kullanılan 143", async () => {
    const d = await ozet(carryUser);
    expect(d.devirKullanilanGun).toBe(143);
    expect(d.uygulamaKullanilanGun).toBe(0);
    expect(d.kullanilanGun).toBe(143);
    expect(d.kalanGun).toBe(d.toplamHakEdilenGun - 143);
  });

  it("L36: onaylanmış 3 günlük yıllık izin eklenince kullanılan 146", async () => {
    const id = await mkLeave(carryUser.id, {}); // 2026-03-02 → 04, 3 iş günü
    asUser(muratOzgur);
    const res = await leavePATCH(jsonReq(`http://localhost/api/leave/${id}`, "PATCH", { action: "approve" }), { params: { id } });
    expect(res.status).toBe(200);

    const d = await ozet(carryUser);
    expect(d.devirKullanilanGun).toBe(143);
    expect(d.uygulamaKullanilanGun).toBe(3);
    expect(d.kullanilanGun).toBe(146);

    // Birikmiş model — kullanılan yıl filtresinden bağımsız
    const d2025 = await ozet(carryUser, 2025);
    expect(d2025.kullanilanGun).toBe(146);

    // Personel listesinde de aynı değer
    asUser(muratOzgur);
    const listRes = await leaveTeamGET(jsonReq("http://localhost/api/leave/team", "GET"));
    const list = await json(listRes);
    const row = list.users.find((u: any) => u.id === carryUser.id);
    expect(row.kullanilanGun).toBe(146);
    expect(row.devirKullanilanGun).toBe(143);
    expect(row.uygulamaKullanilanGun).toBe(3);
  });

  it("L37: iptal edilen izin kullanılana eklenmiyor", async () => {
    const before = (await ozet(carryUser)).kullanilanGun;
    const id = await mkLeave(carryUser.id, { startDate: new Date("2026-05-11"), endDate: new Date("2026-05-13") });
    asUser(carryUser);
    const cancel = await leavePATCH(jsonReq(`http://localhost/api/leave/${id}`, "PATCH", { action: "cancel" }), { params: { id } });
    expect(cancel.status).toBe(200);
    expect((await ozet(carryUser)).kullanilanGun).toBe(before);
  });

  it("L38: kalan eksi çıkabiliyor, talep oluşturma ve onay engellenmiyor", async () => {
    const negUser = await mkUser("carry-neg", "YEMINLI_MALI_MUSAVIR", "2022-03-28", 500);
    const d = await ozet(negUser);
    expect(d.kalanGun).toBeLessThan(0);
    expect(d.kalanGun).toBe(d.toplamHakEdilenGun - 500);

    asUser(negUser);
    const create = await leavePOST(jsonReq("http://localhost/api/leave", "POST", {
      startDate: "2026-06-01", endDate: "2026-06-02", type: "ANNUAL",
    }));
    expect(create.status).toBe(201);
    const created = await json(create);
    createdLeaveIds.push(created.id);

    asUser(muratOzgur);
    const approve = await leavePATCH(
      jsonReq(`http://localhost/api/leave/${created.id}`, "PATCH", { action: "approve" }),
      { params: { id: created.id } }
    );
    expect(approve.status).toBe(200);

    const after = await ozet(negUser);
    expect(after.kullanilanGun).toBe(502);
    expect(after.kalanGun).toBe(d.kalanGun - 2);
  });

  it("L39: yarım gün (44.5) kayıpsız saklanıyor ve API'den aynen dönüyor", async () => {
    const halfUser = await mkUser("carry-half", "YEMINLI_MALI_MUSAVIR", "2022-03-28", 44.5);
    const row = await prisma.user.findUnique({ where: { id: halfUser.id }, select: { carryUsedDays: true } });
    expect(row?.carryUsedDays).toBe(44.5);

    const d = await ozet(halfUser);
    expect(d.devirKullanilanGun).toBe(44.5);
    expect(d.kullanilanGun).toBe(44.5);
    expect(d.kalanGun).toBe(d.toplamHakEdilenGun - 44.5);
    expect(gunMetni(44.5)).toBe("44,5 gün");
  });
});
