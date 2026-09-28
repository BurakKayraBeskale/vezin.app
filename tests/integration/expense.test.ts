/**
 * Personel Harcama Formu (A bloğu) — entegrasyon testleri
 *
 *   E1  2 onaycılı departman: gönderim → Departman Onayında 0/2; ikisi onaylayınca Muhasebe Onayında
 *   E2  Tanımlı onaycı kendi formunu gönderir → departman onayı atlanır, doğrudan Muhasebe Onayında
 *   E3  3 onaycı sırasız onaylayabilir (1/3, 2/3, 3/3)
 *   E4  1 onay varken 2. kişi reddeder → açıklama zorunlu, Düzeltme Bekliyor, 1/2 yeni tura taşınmaz
 *   E5  Muhasebe reddeder, personel düzeltip gönderir → departman onayı 0/X'ten başlar
 *   E6  Net +7.000 → Ödeme Bekliyor, "Vezin'den Alacağım" 7.000; Ödendi sonrası 0
 *   E7  Net −2.000 → İade Bekliyor; İade Alındı sonrası 0
 *   E8  Net 0 → Mahsuplaştı otomatik
 *   E9  Muhasebede 5 kişi; biri onaylar → diğerlerinden onay beklenmez, stale ikinci işlem 409
 *   E10 Taslak PDF'siz kaydedilir; Onaya Gönder PDF'siz yapılamaz; PDF dışı dosya reddedilir
 *   E11 Departman/Muhasebe Onayında form düzenlenemez; Düzeltme Bekliyor'da düzenlenir
 *   E12 Admin workflow aksiyonu yapabilir ama satır/tutar değiştiremez
 *   E13 Approver snapshot: ayar sonradan değişse de açık form eski onaycılarla devam eder
 *   E14 Personel pasifleşir → form iptal olmaz, muhasebe kapatabilir
 *   E15 Bir form Muhasebe Onayındayken yeni taslak açılabilir
 *   E16 İki muhasebe kullanıcısı aynı anda onaylar → yalnız biri başarılı (409)
 *   E17 Başka personelin formuna API'den erişilemez → 404 (detay, PDF, liste, aksiyon)
 *   E18 Onaycı tanımsız departman → Onaya Gönder engellenir (tam mesaj)
 *   E19 Form No PHF-YYYY-NNNNNN biçiminde, artan ve benzersiz
 *   E20 Admin kapanışı geri alır (gerekçe zorunlu); muhasebe kullanıcısı geri alamaz
 *   E21 Pasif onaycı Admin tarafından değiştirilir → audit + yeni onaycıya bildirim
 *   E22 Reddedilmiş turdan stale onay verilemez; onaycı kaydını ikinci kez sonuçlandıramaz
 *   E23 Onay ayarları: yalnız Admin, yalnız o departmanın aktif kullanıcıları, departmanlar dinamik
 *   E24 Formu İptal Et (Düzeltme Bekliyor) → tekrar gönderilemez; taslak silinir, gönderilmiş silinemez
 *   E25 Sekme uçları: onaycı olmayan/muhasebe olmayan kullanıcı ilgili listeye erişemez → 404
 *   E26 Bildirimler: red sebebi form sahibine, muhasebe onayı net durumuna göre metin
 */

import { describe, it, expect, beforeAll, afterAll, vi } from "vitest";
import { PrismaClient } from "@prisma/client";
import { unlink } from "fs/promises";
import path from "path";

vi.mock("next-auth", () => ({ getServerSession: vi.fn() }));

import { GET as listGET, POST as createPOST } from "../../app/api/expenses/route";
import { GET as detailGET, PATCH as detailPATCH, DELETE as detailDELETE } from "../../app/api/expenses/[id]/route";
import { POST as actionPOST } from "../../app/api/expenses/[id]/actions/route";
import { POST as documentPOST } from "../../app/api/expenses/[id]/document/route";
import { GET as documentGET } from "../../app/api/expenses/[id]/document/[docId]/route";
import { GET as settingsGET, PUT as settingsPUT } from "../../app/api/expenses/approval-settings/route";
import { getServerSession } from "next-auth";
import { computeExpenseTotals, parseAmountInput } from "../../lib/expense/calc";
import { EXPENSE_NO_APPROVER_MESSAGE } from "../../lib/expense/constants";

const prisma = new PrismaClient();
const STAMP = Date.now();
const PREFIX = `test-expense-${STAMP}`;
const DEPT_YMM = `TEST_YMM_${STAMP}`;
const DEPT_BD = `TEST_BD_${STAMP}`;
const DEPT_EMPTY = `TEST_EMPTY_${STAMP}`;

type TUser = { id: string; name: string };

const createdUserIds: string[] = [];
const createdFormIds: string[] = [];

async function mkUser(slug: string, department: string, role = "EMPLOYEE"): Promise<TUser> {
  const u = await prisma.user.create({
    data: {
      name: `${PREFIX} ${slug}`,
      email: `${PREFIX}-${slug}@expense.test`,
      password: "x",
      role,
      department,
      title: "Senior 1",
      mustChangePassword: false,
    },
  });
  createdUserIds.push(u.id);
  return { id: u.id, name: u.name };
}

function asUser(u: TUser) {
  vi.mocked(getServerSession).mockResolvedValue({ user: { id: u.id, name: u.name }, expires: "2099-01-01" } as any);
}

function jsonReq(url: string, method: string, body?: object): any {
  return new Request(url, {
    method,
    ...(body ? { headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) } : {}),
  });
}

const BASE = "http://localhost/api/expenses";
const PDF = Buffer.from("%PDF-1.4\n1 0 obj<<>>endobj\ntrailer<<>>\n%%EOF");

function item(amount: number, extra: Partial<Record<string, unknown>> = {}) {
  return {
    date: "2026-09-01",
    subject: "Yol",
    vendor: "Taksi",
    description: "Müşteri ziyareti",
    clientProject: null,
    amount,
    ...extra,
  };
}

const api = {
  create: async (body: object) => {
    const res = await createPOST(jsonReq(BASE, "POST", body));
    const data = await res.json();
    if (res.status === 201) createdFormIds.push(data.id);
    return { res, data };
  },
  get: (id: string) => detailGET(jsonReq(`${BASE}/${id}`, "GET"), { params: { id } }),
  patch: (id: string, body: object) => detailPATCH(jsonReq(`${BASE}/${id}`, "PATCH", body), { params: { id } }),
  del: (id: string) => detailDELETE(jsonReq(`${BASE}/${id}`, "DELETE"), { params: { id } }),
  action: (id: string, body: object) => actionPOST(jsonReq(`${BASE}/${id}/actions`, "POST", body), { params: { id } }),
  upload: (id: string, content: Buffer = PDF, name = "belgeler.pdf", type = "application/pdf") => {
    const fd = new FormData();
    fd.append("file", new File([new Uint8Array(content)], name, { type }));
    return documentPOST(new Request(`${BASE}/${id}/document`, { method: "POST", body: fd }) as any, { params: { id } });
  },
  download: (id: string, docId: string) =>
    documentGET(jsonReq(`${BASE}/${id}/document/${docId}`, "GET"), { params: { id, docId } }),
  list: (qs: string) => listGET(jsonReq(`${BASE}?${qs}`, "GET")),
};

async function detail(id: string) {
  const res = await api.get(id);
  expect(res.status).toBe(200);
  return res.json();
}

/** Sahibi olarak taslak oluşturur, PDF yükler, onaya gönderir. */
async function submittedForm(owner: TUser, amounts: number[], cashAdvance = 0) {
  asUser(owner);
  const { res, data } = await api.create({ items: amounts.map((a) => item(a)), cashAdvance });
  expect(res.status).toBe(201);
  expect((await api.upload(data.id)).status).toBe(201);
  const sub = await api.action(data.id, { action: "submit" });
  expect(sub.status).toBe(200);
  return sub.json();
}

async function approveAllDept(formId: string, approvers: TUser[]) {
  for (const a of approvers) {
    asUser(a);
    const d = await detail(formId);
    const round = d.rounds[d.rounds.length - 1];
    const res = await api.action(formId, { action: "dept-approve", roundId: round.id });
    expect(res.status).toBe(200);
  }
  return detail(formId);
}

async function setApprovers(department: string, users: TUser[]) {
  await prisma.expenseApprovalConfig.deleteMany({ where: { department } });
  if (users.length) {
    await prisma.expenseApprovalConfig.createMany({ data: users.map((u) => ({ department, userId: u.id })) });
  }
}

let admin: TUser;
let ymmA: TUser, ymmB: TUser, ymmC: TUser, ymmEmp: TUser, ymmEmp2: TUser;
let bdApprover: TUser, bdEmp: TUser;
let emptyDeptEmp: TUser;
let acc: TUser[] = [];

beforeAll(async () => {
  admin = await mkUser("admin", "ADMIN", "ADMIN");
  [ymmA, ymmB, ymmC, ymmEmp, ymmEmp2] = await Promise.all([
    mkUser("ymm-a", DEPT_YMM),
    mkUser("ymm-b", DEPT_YMM),
    mkUser("ymm-c", DEPT_YMM),
    mkUser("ymm-emp", DEPT_YMM),
    mkUser("ymm-emp2", DEPT_YMM),
  ]);
  [bdApprover, bdEmp, emptyDeptEmp] = await Promise.all([
    mkUser("bd-approver", DEPT_BD),
    mkUser("bd-emp", DEPT_BD),
    mkUser("empty-emp", DEPT_EMPTY),
  ]);
  acc = await Promise.all([1, 2, 3, 4, 5].map((i) => mkUser(`muhasebe-${i}`, "MUHASEBE")));
  await setApprovers(DEPT_YMM, [ymmA, ymmB]);
  await setApprovers(DEPT_BD, [bdApprover]);
});

afterAll(async () => {
  const docs = await prisma.expenseDocument.findMany({ where: { formId: { in: createdFormIds } }, select: { storageKey: true } });
  await Promise.all(docs.map((d) => unlink(path.join(process.cwd(), "uploads", d.storageKey)).catch(() => {})));
  await prisma.notification.deleteMany({ where: { relatedId: { in: createdFormIds } } });
  await prisma.expenseForm.deleteMany({ where: { id: { in: createdFormIds } } });
  await prisma.expenseApprovalConfig.deleteMany({ where: { userId: { in: createdUserIds } } });
  await prisma.user.deleteMany({ where: { id: { in: createdUserIds } } });
  await prisma.$disconnect();
});

describe("Hesap yardımcıları", () => {
  it("kuruş bazlı toplam ve Türkçe tutar ayrıştırma", () => {
    expect(computeExpenseTotals([{ amount: 0.1 }, { amount: 0.2 }], 0)).toEqual({ totalAmount: 0.3, cashAdvance: 0, netAmount: 0.3 });
    expect(computeExpenseTotals([{ amount: 5000 }], 7000).netAmount).toBe(-2000);
    expect(parseAmountInput("1.234,56")).toBe(1234.56);
    expect(parseAmountInput("1234.5")).toBe(1234.5);
    expect(parseAmountInput("1.234")).toBe(1234);
    expect(parseAmountInput("abc")).toBeNull();
  });
});

describe("E1 — 2 onaycılı departman", () => {
  it("0/2 → 1/2 → 2/2 → Muhasebe Onayında; bildirimler doğru kişilere", async () => {
    const d0 = await submittedForm(ymmEmp, [1000, 250.5]);
    expect(d0.status).toBe("DEPT_APPROVAL");
    expect(d0.rounds).toHaveLength(1);
    expect(d0.rounds[0].approvedCount).toBe(0);
    expect(d0.rounds[0].requiredCount).toBe(2);
    expect(d0.totalAmount).toBe(1250.5);

    const approvalNotifs = await prisma.notification.findMany({ where: { relatedId: d0.id, type: "EXPENSE_APPROVAL_REQUEST" } });
    expect(approvalNotifs.map((n) => n.userId).sort()).toEqual([ymmA.id, ymmB.id].sort());

    asUser(ymmB);
    let res = await api.action(d0.id, { action: "dept-approve", roundId: d0.rounds[0].id });
    expect(res.status).toBe(200);
    let d = await res.json();
    expect(d.status).toBe("DEPT_APPROVAL");
    expect(d.rounds[0].approvedCount).toBe(1);

    asUser(ymmA);
    res = await api.action(d0.id, { action: "dept-approve", roundId: d0.rounds[0].id });
    d = await res.json();
    expect(d.status).toBe("ACCOUNTING_APPROVAL");
    expect(d.rounds[0].status).toBe("APPROVED");

    const accNotifs = await prisma.notification.findMany({ where: { relatedId: d0.id, type: "EXPENSE_ACCOUNTING_REQUEST" } });
    const accIds = accNotifs.map((n) => n.userId);
    for (const a of acc) expect(accIds).toContain(a.id);
  });
});

describe("E2 — Onaycı kendi formunu gönderir", () => {
  it("departman onayı atlanır, doğrudan Muhasebe Onayında", async () => {
    const d = await submittedForm(ymmA, [500]);
    expect(d.status).toBe("ACCOUNTING_APPROVAL");
    expect(d.rounds[0].status).toBe("SKIPPED");
    expect(d.rounds[0].bypassed).toBe(true);
    expect(d.rounds[0].approvals).toHaveLength(0);
    expect(d.audits.map((a: any) => a.action)).toContain("DEPT_BYPASSED");
  });
});

describe("E3 — 3 onaycı sırasız onaylar", () => {
  it("1/3, 2/3, 3/3 → Muhasebe", async () => {
    await setApprovers(DEPT_YMM, [ymmA, ymmB, ymmC]);
    try {
      const d0 = await submittedForm(ymmEmp, [100]);
      const roundId = d0.rounds[0].id;
      const expected = [1, 2, 3];
      const order = [ymmC, ymmA, ymmB];
      for (let i = 0; i < order.length; i++) {
        asUser(order[i]);
        const d = await (await api.action(d0.id, { action: "dept-approve", roundId })).json();
        expect(d.rounds[0].approvedCount).toBe(expected[i]);
        expect(d.rounds[0].requiredCount).toBe(3);
        expect(d.status).toBe(i < 2 ? "DEPT_APPROVAL" : "ACCOUNTING_APPROVAL");
      }
    } finally {
      await setApprovers(DEPT_YMM, [ymmA, ymmB]);
    }
  });
});

describe("E4 — Onay varken ikinci onaycı reddeder", () => {
  it("açıklama zorunlu; Düzeltme Bekliyor; yeniden gönderimde yeni tur 0/2", async () => {
    const d0 = await submittedForm(ymmEmp, [300]);
    const roundId = d0.rounds[0].id;
    asUser(ymmA);
    expect((await api.action(d0.id, { action: "dept-approve", roundId })).status).toBe(200);

    asUser(ymmB);
    expect((await api.action(d0.id, { action: "dept-reject", roundId, note: "  " })).status).toBe(400);
    const res = await api.action(d0.id, { action: "dept-reject", roundId, note: "Fiş eksik" });
    expect(res.status).toBe(200);
    const d1 = await res.json();
    expect(d1.status).toBe("REVISION");
    expect(d1.lastRejection).toMatchObject({ stage: "DEPARTMENT", note: "Fiş eksik" });

    asUser(ymmEmp);
    const d2 = await (await api.action(d0.id, { action: "submit" })).json();
    expect(d2.status).toBe("DEPT_APPROVAL");
    expect(d2.rounds).toHaveLength(2);
    expect(d2.rounds[0].status).toBe("REJECTED");
    expect(d2.rounds[0].approvals.find((a: any) => a.approverId === ymmA.id).status).toBe("APPROVED");
    expect(d2.rounds[1].approvedCount).toBe(0);
    expect(d2.rounds[1].requiredCount).toBe(2);
    expect(d2.audits.map((a: any) => a.action)).toContain("RESUBMITTED");
  });
});

describe("E5 — Muhasebe reddi sonrası yeniden gönderim", () => {
  it("departman onayı baştan başlar (0/X), doğrudan muhasebeye dönmez", async () => {
    const d0 = await submittedForm(ymmEmp, [400]);
    const d1 = await approveAllDept(d0.id, [ymmA, ymmB]);
    expect(d1.status).toBe("ACCOUNTING_APPROVAL");

    asUser(acc[0]);
    expect((await api.action(d0.id, { action: "accounting-reject", version: d1.version })).status).toBe(400);
    const rej = await (await api.action(d0.id, { action: "accounting-reject", version: d1.version, note: "Tutar hatalı" })).json();
    expect(rej.status).toBe("REVISION");
    expect(rej.lastRejection).toMatchObject({ stage: "ACCOUNTING", note: "Tutar hatalı" });

    asUser(ymmEmp);
    expect((await api.patch(d0.id, { items: [item(350)], cashAdvance: 0 })).status).toBe(200);
    const d2 = await (await api.action(d0.id, { action: "submit" })).json();
    expect(d2.status).toBe("DEPT_APPROVAL");
    expect(d2.rounds).toHaveLength(2);
    expect(d2.rounds[1].approvedCount).toBe(0);
    expect(d2.rounds[1].requiredCount).toBe(2);
    expect(d2.totalAmount).toBe(350);
  });
});

async function summary(u: TUser) {
  asUser(u);
  const res = await api.list("scope=mine");
  expect(res.status).toBe(200);
  return (await res.json()).summary;
}

describe("E6 — Net +7.000", () => {
  it("Ödeme Bekliyor, Vezin'den Alacağım 7.000; Ödendi sonrası 0", async () => {
    const owner = await mkUser("e6-owner", DEPT_BD);
    const d0 = await submittedForm(owner, [5000, 3000], 1000);
    expect((await summary(owner)).receivable.amount).toBe(0); // onay tamamlanmadan dahil değil
    const d1 = await approveAllDept(d0.id, [bdApprover]);
    asUser(acc[1]);
    const d2 = await (await api.action(d0.id, { action: "accounting-approve", version: d1.version })).json();
    expect(d2.status).toBe("PAYMENT_PENDING");
    expect(d2.netAmount).toBe(7000);

    const s1 = await summary(owner);
    expect(s1.receivable.amount).toBe(7000);
    expect(s1.inApproval.count).toBe(0);

    asUser(acc[2]);
    const d3 = await (await api.action(d0.id, { action: "mark-paid", version: d2.version, transactionDate: "2026-09-20", note: "Havale" })).json();
    expect(d3.status).toBe("PAID");
    expect(d3.settlements).toHaveLength(1);
    expect(d3.settlements[0]).toMatchObject({ type: "PAYMENT", amount: 7000, note: "Havale" });
    expect((await summary(owner)).receivable.amount).toBe(0);

    const notif = await prisma.notification.findMany({ where: { relatedId: d0.id, userId: owner.id } });
    expect(notif.map((n) => n.type)).toEqual(expect.arrayContaining(["EXPENSE_ACCOUNTING_APPROVED", "EXPENSE_PAID"]));
    expect(notif.find((n) => n.type === "EXPENSE_ACCOUNTING_APPROVED")!.message).toContain("alacağınız");
  });
});

describe("E7 — Net −2.000", () => {
  it("İade Bekliyor; İade Alındı sonrası 0", async () => {
    const owner = await mkUser("e7-owner", DEPT_BD);
    const d0 = await submittedForm(owner, [3000], 5000);
    const d1 = await approveAllDept(d0.id, [bdApprover]);
    asUser(acc[0]);
    const d2 = await (await api.action(d0.id, { action: "accounting-approve", version: d1.version })).json();
    expect(d2.status).toBe("REFUND_PENDING");
    expect((await summary(owner)).refund.amount).toBe(2000);

    asUser(admin);
    const d3 = await (await api.action(d0.id, { action: "mark-refund-received", version: d2.version })).json();
    expect(d3.status).toBe("REFUND_RECEIVED");
    expect(d3.settlements[0]).toMatchObject({ type: "REFUND", amount: 2000 });
    expect((await summary(owner)).refund.amount).toBe(0);
  });
});

describe("E8 — Net 0", () => {
  it("Mahsuplaştı otomatik, OFFSET kapanış kaydı", async () => {
    const owner = await mkUser("e8-owner", DEPT_BD);
    const d0 = await submittedForm(owner, [1500], 1500);
    const d1 = await approveAllDept(d0.id, [bdApprover]);
    asUser(acc[3]);
    const d2 = await (await api.action(d0.id, { action: "accounting-approve", version: d1.version })).json();
    expect(d2.status).toBe("SETTLED");
    expect(d2.settlements[0]).toMatchObject({ type: "OFFSET", amount: 0 });
    expect(d2.permissions.canMarkPaid).toBe(false);
    expect(d2.permissions.canMarkRefundReceived).toBe(false);
  });
});

describe("E9 — Muhasebede 5 kişi", () => {
  it("biri onaylar → form ilerler; diğerinin stale işlemi 409", async () => {
    const owner = await mkUser("e9-owner", DEPT_BD);
    const d0 = await submittedForm(owner, [800]);
    const d1 = await approveAllDept(d0.id, [bdApprover]);
    // 5 muhasebecinin hepsi görebiliyor
    for (const a of acc) {
      asUser(a);
      expect((await api.get(d0.id)).status).toBe(200);
    }
    asUser(acc[4]);
    expect((await api.action(d0.id, { action: "accounting-approve", version: d1.version })).status).toBe(200);
    asUser(acc[0]);
    expect((await api.action(d0.id, { action: "accounting-approve", version: d1.version })).status).toBe(409);
    expect((await api.action(d0.id, { action: "accounting-reject", version: d1.version, note: "x" })).status).toBe(409);
  });
});

describe("E10 — PDF kuralları", () => {
  it("taslak PDF'siz kaydedilir; gönderim PDF'siz 400; PDF dışı dosya 400", async () => {
    asUser(ymmEmp);
    const { res, data } = await api.create({ items: [item(100)] });
    expect(res.status).toBe(201);
    expect(data.status).toBe("DRAFT");
    expect(data.activeDocument).toBeNull();

    const sub = await api.action(data.id, { action: "submit" });
    expect(sub.status).toBe(400);
    expect((await sub.json()).error).toContain("PDF");

    expect((await api.upload(data.id, Buffer.from("merhaba"), "not.txt", "text/plain")).status).toBe(400);
    expect((await api.upload(data.id, Buffer.from("merhaba"), "sahte.pdf", "application/pdf")).status).toBe(400);

    expect((await api.upload(data.id)).status).toBe(201);
    const replaced = await (await api.upload(data.id, PDF, "yeni.pdf")).json();
    expect(replaced.activeDocument.name).toBe("yeni.pdf");
    expect(replaced.previousDocuments).toHaveLength(1);
    expect(replaced.audits.map((a: any) => a.action)).toContain("DOCUMENT_REPLACED");
  });

  it("eksik satır alanı ve sıfır tutar gönderimi engeller", async () => {
    asUser(ymmEmp);
    const { data } = await api.create({ items: [item(0, { vendor: "" })] });
    await api.upload(data.id);
    const sub = await api.action(data.id, { action: "submit" });
    expect(sub.status).toBe(400);
    const msg = (await sub.json()).error;
    expect(msg).toContain("firma/harcama yeri");
    expect(msg).toContain("sıfırdan büyük");
    expect((await api.patch(data.id, { items: [item(-5)] })).status).toBe(400);
  });
});

describe("E11 — Kilit kuralları", () => {
  it("Departman/Muhasebe Onayında düzenlenemez, PDF değiştirilemez; Düzeltme Bekliyor'da düzenlenir", async () => {
    const d0 = await submittedForm(ymmEmp, [200]);
    asUser(ymmEmp);
    expect((await api.patch(d0.id, { items: [item(999)] })).status).toBe(409);
    expect((await api.upload(d0.id)).status).toBe(409);
    expect((await api.action(d0.id, { action: "cancel" })).status).toBe(409);
    expect((await api.del(d0.id)).status).toBe(409);

    const d1 = await approveAllDept(d0.id, [ymmA, ymmB]);
    asUser(ymmEmp);
    expect((await api.patch(d0.id, { items: [item(999)] })).status).toBe(409);

    asUser(acc[0]);
    await api.action(d0.id, { action: "accounting-reject", version: d1.version, note: "Düzelt" });
    asUser(ymmEmp);
    const res = await api.patch(d0.id, { items: [item(210), item(15)], cashAdvance: 25 });
    expect(res.status).toBe(200);
    const d2 = await res.json();
    expect(d2.totalAmount).toBe(225);
    expect(d2.netAmount).toBe(200);
    expect((await api.upload(d0.id, PDF, "duzeltilmis.pdf")).status).toBe(201);
  });
});

describe("E12 — Admin içerik değiştiremez", () => {
  it("Admin departman ve muhasebe aksiyonu yapar; PATCH/PDF 403", async () => {
    const d0 = await submittedForm(ymmEmp, [120]);
    asUser(admin);
    expect((await api.patch(d0.id, { items: [item(1)] })).status).toBe(403);
    expect((await api.upload(d0.id)).status).toBe(403);

    const d1 = await (await api.action(d0.id, { action: "dept-approve", roundId: d0.rounds[0].id })).json();
    expect(d1.status).toBe("ACCOUNTING_APPROVAL");
    expect(d1.rounds[0].adminOverride).toBe(true);
    expect(d1.rounds[0].approvals.every((a: any) => a.status === "OVERRIDDEN")).toBe(true);

    const d2 = await (await api.action(d0.id, { action: "accounting-approve", version: d1.version })).json();
    expect(d2.status).toBe("PAYMENT_PENDING");
    expect(d2.totalAmount).toBe(120);
  });
});

describe("E13 — Approver snapshot", () => {
  it("Ahmet+Mehmet ile gönderilen form, ayar Ahmet+Ayşe olsa da Ahmet+Mehmet ile devam eder", async () => {
    // ymmA = Ahmet, ymmB = Mehmet, ymmC = Ayşe
    const d0 = await submittedForm(ymmEmp, [90]);
    await setApprovers(DEPT_YMM, [ymmA, ymmC]);
    try {
      asUser(ymmC);
      expect((await api.action(d0.id, { action: "dept-approve", roundId: d0.rounds[0].id })).status).toBe(403);
      const d1 = await approveAllDept(d0.id, [ymmA, ymmB]);
      expect(d1.status).toBe("ACCOUNTING_APPROVAL");
      expect(d1.rounds[0].approvals.map((a: any) => a.approverId).sort()).toEqual([ymmA.id, ymmB.id].sort());

      // Yeni gönderim yeni ayarı alır
      const n = await submittedForm(ymmEmp2, [10]);
      expect(n.rounds[0].approvals.map((a: any) => a.approverId).sort()).toEqual([ymmA.id, ymmC.id].sort());
    } finally {
      await setApprovers(DEPT_YMM, [ymmA, ymmB]);
    }
  });
});

describe("E14 — Personel pasifleşir", () => {
  it("form iptal olmaz, muhasebe onaylayıp kapatabilir; pasif kullanıcıya bildirim gitmez", async () => {
    const owner = await mkUser("e14-owner", DEPT_BD);
    const d0 = await submittedForm(owner, [640]);
    await prisma.user.update({ where: { id: owner.id }, data: { status: "INACTIVE" } });
    const d1 = await approveAllDept(d0.id, [bdApprover]);
    expect(d1.status).toBe("ACCOUNTING_APPROVAL");
    asUser(acc[1]);
    const d2 = await (await api.action(d0.id, { action: "accounting-approve", version: d1.version })).json();
    const d3 = await (await api.action(d0.id, { action: "mark-paid", version: d2.version })).json();
    expect(d3.status).toBe("PAID");
    const ownerNotifs = await prisma.notification.count({ where: { relatedId: d0.id, userId: owner.id } });
    expect(ownerNotifs).toBe(0);
  });
});

describe("E15 — Birden çok açık form", () => {
  it("bir form Muhasebe Onayındayken yeni taslak açılabilir ve gönderilebilir", async () => {
    const owner = await mkUser("e15-owner", DEPT_BD);
    const first = await submittedForm(owner, [100]);
    await approveAllDept(first.id, [bdApprover]);
    const second = await submittedForm(owner, [200]);
    expect(second.status).toBe("DEPT_APPROVAL");
    expect(second.formNo).not.toBe(first.formNo);
  });
});

describe("E16 — Eşzamanlı muhasebe onayı", () => {
  it("aynı anda iki onay → biri 200, diğeri 409; tek kapanış", async () => {
    const owner = await mkUser("e16-owner", DEPT_BD);
    const d0 = await submittedForm(owner, [900]);
    const d1 = await approveAllDept(d0.id, [bdApprover]);
    // getServerSession her çağrıda aynı mock'u döndürür — iki farklı muhasebeci sırayla bağlanır
    vi.mocked(getServerSession)
      .mockResolvedValueOnce({ user: { id: acc[0].id } } as any)
      .mockResolvedValueOnce({ user: { id: acc[1].id } } as any);
    const results = await Promise.all([
      api.action(d0.id, { action: "accounting-approve", version: d1.version }),
      api.action(d0.id, { action: "accounting-approve", version: d1.version }),
    ]);
    expect(results.map((r) => r.status).sort()).toEqual([200, 409]);
    const audits = await prisma.expenseAudit.count({ where: { formId: d0.id, action: "ACCOUNTING_APPROVED" } });
    expect(audits).toBe(1);

    // Ödendi için de aynı koruma
    asUser(acc[2]);
    const cur = await detail(d0.id);
    vi.mocked(getServerSession)
      .mockResolvedValueOnce({ user: { id: acc[2].id } } as any)
      .mockResolvedValueOnce({ user: { id: acc[3].id } } as any);
    const paid = await Promise.all([
      api.action(d0.id, { action: "mark-paid", version: cur.version }),
      api.action(d0.id, { action: "mark-paid", version: cur.version }),
    ]);
    expect(paid.map((r) => r.status).sort()).toEqual([200, 409]);
    expect(await prisma.expenseSettlement.count({ where: { formId: d0.id } })).toBe(1);
  });
});

describe("E17 — Başka personelin formu", () => {
  it("aynı departmandaki çalışan detay/PDF/aksiyon/liste ile erişemez → 404", async () => {
    const d0 = await submittedForm(ymmEmp, [70]);
    asUser(ymmEmp2);
    expect((await api.get(d0.id)).status).toBe(404);
    expect((await api.download(d0.id, d0.activeDocument.id)).status).toBe(404);
    expect((await api.action(d0.id, { action: "dept-approve", roundId: d0.rounds[0].id })).status).toBe(404);
    expect((await api.action(d0.id, { action: "accounting-approve", version: d0.version })).status).toBe(404);
    expect((await api.patch(d0.id, { items: [item(1)] })).status).toBe(404);
    const list = await (await api.list("scope=mine")).json();
    expect(list.forms.map((f: any) => f.id)).not.toContain(d0.id);

    // Muhasebe aşamasına gelmemiş form muhasebeye de görünmez
    asUser(acc[0]);
    expect((await api.get(d0.id)).status).toBe(404);

    // Sahibi ve onaycı PDF'e erişebilir
    asUser(ymmA);
    const dl = await api.download(d0.id, d0.activeDocument.id);
    expect(dl.status).toBe(200);
    expect(dl.headers.get("Content-Type")).toBe("application/pdf");

    // Taslak onaycıya da görünmez
    asUser(ymmEmp);
    const { data: draft } = await api.create({ items: [item(5)] });
    asUser(ymmA);
    expect((await api.get(draft.id)).status).toBe(404);
  });
});

describe("E18 — Onaycı tanımsız departman", () => {
  it("Onaya Gönder engellenir, otomatik muhasebeye gitmez", async () => {
    asUser(emptyDeptEmp);
    const { data } = await api.create({ items: [item(10)] });
    await api.upload(data.id);
    const res = await api.action(data.id, { action: "submit" });
    expect(res.status).toBe(400);
    expect((await res.json()).error).toBe(EXPENSE_NO_APPROVER_MESSAGE);
    expect((await detail(data.id)).status).toBe("DRAFT");
  });
});

describe("E19 — Form No", () => {
  it("PHF-YYYY-NNNNNN, artan ve benzersiz; istemci belirleyemez", async () => {
    asUser(bdEmp);
    const a = (await api.create({ items: [], formNo: "PHF-1999-000001" })).data;
    const b = (await api.create({ items: [] })).data;
    expect(a.formNo).toMatch(/^PHF-\d{4}-\d{6}$/);
    expect(a.formNo).not.toBe("PHF-1999-000001");
    const seq = (f: string) => parseInt(f.slice(-6), 10);
    expect(seq(b.formNo)).toBe(seq(a.formNo) + 1);
  });
});

describe("E20 — Kapanış geri alma", () => {
  it("Admin gerekçeyle geri alır → bakiye yeniden oluşur; muhasebe geri alamaz", async () => {
    const owner = await mkUser("e20-owner", DEPT_BD);
    const d0 = await submittedForm(owner, [1200]);
    const d1 = await approveAllDept(d0.id, [bdApprover]);
    asUser(acc[0]);
    const d2 = await (await api.action(d0.id, { action: "accounting-approve", version: d1.version })).json();
    const d3 = await (await api.action(d0.id, { action: "mark-paid", version: d2.version })).json();
    expect((await api.action(d0.id, { action: "revert-settlement", version: d3.version, reason: "hata" })).status).toBe(403);

    asUser(admin);
    expect((await api.action(d0.id, { action: "revert-settlement", version: d3.version })).status).toBe(400);
    const d4 = await (await api.action(d0.id, { action: "revert-settlement", version: d3.version, reason: "Yanlış forma işlendi" })).json();
    expect(d4.status).toBe("PAYMENT_PENDING");
    expect(d4.settlements[0].revertedAt).not.toBeNull();
    expect(d4.settlements[0].revertReason).toBe("Yanlış forma işlendi");
    expect((await summary(owner)).receivable.amount).toBe(1200);
    expect(d4.audits.map((a: any) => a.action)).toContain("SETTLEMENT_REVERTED");
  });
});

describe("E21 — Pasif onaycı değişimi", () => {
  it("Admin aynı departmandan aktif kullanıcıyla değiştirir; audit + bildirim", async () => {
    const d0 = await submittedForm(ymmEmp, [60]);
    const approvalB = d0.rounds[0].approvals.find((a: any) => a.approverId === ymmB.id);

    asUser(admin);
    // Aktif onaycı değiştirilemez
    let res = await api.action(d0.id, { action: "replace-approver", approvalId: approvalB.id, newApproverId: ymmC.id });
    expect(res.status).toBe(400);

    await prisma.user.update({ where: { id: ymmB.id }, data: { status: "INACTIVE" } });
    try {
      // Başka departmandan seçilemez
      res = await api.action(d0.id, { action: "replace-approver", approvalId: approvalB.id, newApproverId: bdEmp.id });
      expect(res.status).toBe(400);
      // Onaycı olmayan değiştiremez
      asUser(ymmA);
      res = await api.action(d0.id, { action: "replace-approver", approvalId: approvalB.id, newApproverId: ymmC.id });
      expect(res.status).toBe(403);

      asUser(admin);
      const d1 = await (await api.action(d0.id, { action: "replace-approver", approvalId: approvalB.id, newApproverId: ymmC.id })).json();
      const approvals = d1.rounds[0].approvals;
      expect(approvals.find((a: any) => a.id === approvalB.id).status).toBe("REPLACED");
      expect(approvals.find((a: any) => a.approverId === ymmC.id).status).toBe("PENDING");
      expect(d1.rounds[0].requiredCount).toBe(2);
      const auditRow = d1.audits.find((a: any) => a.action === "APPROVER_REPLACED");
      expect(auditRow.meta).toMatchObject({ oldApproverId: ymmB.id, newApproverId: ymmC.id });
      expect(auditRow.actorName).toBe(admin.name);
      expect(await prisma.notification.count({ where: { relatedId: d0.id, userId: ymmC.id, type: "EXPENSE_APPROVER_CHANGED" } })).toBe(1);

      const d2 = await approveAllDept(d0.id, [ymmA, ymmC]);
      expect(d2.status).toBe("ACCOUNTING_APPROVAL");
    } finally {
      await prisma.user.update({ where: { id: ymmB.id }, data: { status: "ACTIVE" } });
    }
  });
});

describe("E22 — Stale departman onayı", () => {
  it("reddedilmiş turdan onay verilemez; aynı kayıt iki kez sonuçlandırılamaz; kendi formu onaylanamaz", async () => {
    const d0 = await submittedForm(ymmEmp, [30]);
    const roundId = d0.rounds[0].id;
    asUser(ymmA);
    expect((await api.action(d0.id, { action: "dept-approve", roundId })).status).toBe(200);
    expect((await api.action(d0.id, { action: "dept-approve", roundId })).status).toBe(409);
    expect((await api.action(d0.id, { action: "dept-reject", roundId, note: "vazgeçtim" })).status).toBe(409);

    asUser(ymmB);
    await api.action(d0.id, { action: "dept-reject", roundId, note: "Eksik" });
    asUser(ymmEmp);
    const d1 = await (await api.action(d0.id, { action: "submit" })).json();
    // B, eski turun ekranından onay vermeye çalışır
    asUser(ymmB);
    expect((await api.action(d0.id, { action: "dept-approve", roundId })).status).toBe(409);
    expect((await api.action(d0.id, { action: "dept-approve", roundId: d1.rounds[1].id })).status).toBe(200);

  });

  it("Admin bile kendi formunu departman/muhasebe aşamasında onaylayamaz → 403", async () => {
    const bdAdmin = await mkUser("bd-admin", DEPT_BD, "ADMIN");
    const d0 = await submittedForm(bdAdmin, [5]);
    expect(d0.status).toBe("DEPT_APPROVAL");
    expect(d0.permissions.canApproveDepartment).toBe(false);
    asUser(bdAdmin);
    expect((await api.action(d0.id, { action: "dept-approve", roundId: d0.rounds[0].id })).status).toBe(403);
    const d1 = await approveAllDept(d0.id, [bdApprover]);
    asUser(bdAdmin);
    expect((await api.action(d0.id, { action: "accounting-approve", version: d1.version })).status).toBe(403);
  });
});

describe("E23 — Onay ayarları", () => {
  it("yalnız Admin; departmanlar dinamik; başka departmandan onaycı seçilemez", async () => {
    asUser(ymmA);
    expect((await settingsGET()).status).toBe(404);
    expect((await settingsPUT(jsonReq(`${BASE}/approval-settings`, "PUT", { department: DEPT_BD, approverIds: [] }))).status).toBe(403);

    asUser(admin);
    const res = await settingsGET();
    expect(res.status).toBe(200);
    const { departments } = await res.json();
    const ymm = departments.find((d: any) => d.department === DEPT_YMM);
    expect(ymm).toBeTruthy();
    expect(ymm.approverIds.sort()).toEqual([ymmA.id, ymmB.id].sort());
    expect(ymm.users.map((u: any) => u.id)).not.toContain(bdEmp.id);

    const bad = await settingsPUT(jsonReq(`${BASE}/approval-settings`, "PUT", { department: DEPT_BD, approverIds: [bdApprover.id, ymmA.id] }));
    expect(bad.status).toBe(400);
    const unknownDept = await settingsPUT(jsonReq(`${BASE}/approval-settings`, "PUT", { department: "YOK_BOYLE", approverIds: [] }));
    expect(unknownDept.status).toBe(400);

    const ok = await settingsPUT(jsonReq(`${BASE}/approval-settings`, "PUT", { department: DEPT_BD, approverIds: [bdApprover.id, bdEmp.id] }));
    expect(ok.status).toBe(200);
    const bd = (await ok.json()).departments.find((d: any) => d.department === DEPT_BD);
    expect(bd.approverIds.sort()).toEqual([bdApprover.id, bdEmp.id].sort());
    await setApprovers(DEPT_BD, [bdApprover]);
  });
});

describe("E24 — İptal ve silme", () => {
  it("Düzeltme Bekliyor'da iptal → tekrar açılamaz; taslak silinir", async () => {
    const d0 = await submittedForm(ymmEmp, [44]);
    asUser(ymmA);
    await api.action(d0.id, { action: "dept-reject", roundId: d0.rounds[0].id, note: "Hatalı" });
    asUser(ymmEmp);
    const c = await api.action(d0.id, { action: "cancel" });
    expect(c.status).toBe(200);
    expect((await c.json()).status).toBe("CANCELLED");
    expect((await api.action(d0.id, { action: "submit" })).status).toBe(409);
    expect((await api.patch(d0.id, { items: [item(1)] })).status).toBe(409);

    const { data: draft } = await api.create({ items: [item(1)] });
    asUser(ymmEmp2);
    expect((await api.del(draft.id)).status).toBe(404);
    asUser(ymmEmp);
    expect((await api.del(draft.id)).status).toBe(200);
    expect(await prisma.expenseForm.count({ where: { id: draft.id } })).toBe(0);
  });
});

describe("E25 — Sekme uçları", () => {
  it("onaycı olmayan Onay Bekleyenler'e, muhasebe olmayan Muhasebe İşlemleri'ne, admin olmayan Tüm Formlar'a erişemez", async () => {
    asUser(ymmEmp2);
    expect((await api.list("scope=approvals")).status).toBe(404);
    expect((await api.list("scope=accounting")).status).toBe(404);
    expect((await api.list("scope=all")).status).toBe(404);

    const d0 = await submittedForm(ymmEmp, [11]);
    asUser(ymmA);
    const pending = await (await api.list("scope=approvals")).json();
    expect(pending.forms.map((f: any) => f.id)).toContain(d0.id);
    expect(pending.forms.find((f: any) => f.id === d0.id).approvalProgress).toEqual({ approved: 0, required: 2 });

    asUser(acc[0]);
    const accList = await api.list("scope=accounting&view=all");
    expect(accList.status).toBe(200);
    expect((await accList.json()).forms.map((f: any) => f.id)).not.toContain(d0.id);

    asUser(admin);
    const all = await (await api.list(`scope=all&department=${DEPT_YMM}&q=${encodeURIComponent(d0.formNo)}`)).json();
    expect(all.forms.map((f: any) => f.id)).toEqual([d0.id]);
    expect(all.facets.departments).toContain(DEPT_YMM);
  });
});

describe("E26 — Red bildirimi", () => {
  it("red sebebi form sahibine bildirimde görünür", async () => {
    const d0 = await submittedForm(ymmEmp2, [12]);
    asUser(ymmB);
    await api.action(d0.id, { action: "dept-reject", roundId: d0.rounds[0].id, note: "Otopark fişi okunmuyor" });
    const n = await prisma.notification.findFirst({ where: { relatedId: d0.id, userId: ymmEmp2.id, type: "EXPENSE_REJECTED" } });
    expect(n?.message).toContain("Otopark fişi okunmuyor");
  });
});
