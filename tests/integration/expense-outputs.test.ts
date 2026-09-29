/**
 * Personel Harcama Formu (B bloğu — çıktılar) — entegrasyon testleri
 *
 *   B1 Form PDF üretilir; toplamlar, onaylar, muhasebe onayı ve ödeme bilgisi doğru
 *   B2 2 sayfalık form + 8 sayfalık harcama belgesi → 10 sayfalık TEK PDF (storage'a yazılmaz)
 *   B3 Ödendi formda muhasebe PDF'i siler; form, geçmiş ve metadata kalır; birleşik PDF yalnız form döner
 *   B4 Süreç devam ederken (Muhasebe Onayında vb.) PDF silinemez → 403; yetkisiz roller 403/404
 *   B5 Excel: ekran filtreleri (departman/durum/personel/tarih/arama) uygulanır; yetki dışı form girmez
 *   B6 Yetkisiz kullanıcı başka personelin form PDF'ini indiremez → 404
 */

import { describe, it, expect, beforeAll, afterAll, vi } from "vitest";
import { PrismaClient } from "@prisma/client";
import { access, readdir, unlink } from "fs/promises";
import path from "path";
import ExcelJS from "exceljs";
import { jsPDF } from "jspdf";

vi.mock("next-auth", () => ({ getServerSession: vi.fn() }));

import { POST as createPOST } from "../../app/api/expenses/route";
import { GET as detailGET } from "../../app/api/expenses/[id]/route";
import { POST as actionPOST } from "../../app/api/expenses/[id]/actions/route";
import { POST as documentPOST } from "../../app/api/expenses/[id]/document/route";
import { GET as documentGET, DELETE as documentDELETE } from "../../app/api/expenses/[id]/document/[docId]/route";
import { GET as pdfGET } from "../../app/api/expenses/[id]/pdf/route";
import { GET as exportGET } from "../../app/api/expenses/export/route";
import { getServerSession } from "next-auth";
import { documentRoundNumbers } from "../../lib/expense/data";

const prisma = new PrismaClient();
const STAMP = Date.now();
const PREFIX = `test-expout-${STAMP}`;
const DEPT_A = `TEST_OUT_A_${STAMP}`;
const DEPT_B = `TEST_OUT_B_${STAMP}`;
const UPLOADS = path.join(process.cwd(), "uploads");

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

function req(url: string, method = "GET", body?: object): any {
  return new Request(url, {
    method,
    ...(body ? { headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) } : {}),
  });
}

const BASE = "http://localhost/api/expenses";

/** Gerçek, sayfa sayısı bilinen bir "fiş" PDF'i */
function receiptPdf(pages: number): Buffer {
  const doc = new jsPDF({ unit: "pt", format: "a4" });
  for (let i = 1; i <= pages; i++) {
    if (i > 1) doc.addPage();
    doc.setFontSize(28);
    doc.text(`Fis ${i}`, 60, 100);
  }
  return Buffer.from(doc.output("arraybuffer"));
}

async function pageCount(buf: Buffer): Promise<number> {
  const { getDocumentProxy } = await import("unpdf");
  const pdf = await getDocumentProxy(new Uint8Array(buf));
  return pdf.numPages;
}

async function pdfText(buf: Buffer): Promise<string> {
  const { extractText, getDocumentProxy } = await import("unpdf");
  const { text } = await extractText(await getDocumentProxy(new Uint8Array(buf)), { mergePages: true });
  return text as string;
}

function item(amount: number, extra: Partial<Record<string, unknown>> = {}) {
  return { date: "2026-09-01", subject: "Yol", vendor: "Taksi", description: "Müşteri ziyareti", clientProject: null, amount, ...extra };
}

const api = {
  create: async (body: object) => {
    const res = await createPOST(req(BASE, "POST", body));
    const data = await res.json();
    if (res.status === 201) createdFormIds.push(data.id);
    return data;
  },
  get: (id: string) => detailGET(req(`${BASE}/${id}`), { params: { id } }),
  action: (id: string, body: object) => actionPOST(req(`${BASE}/${id}/actions`, "POST", body), { params: { id } }),
  upload: (id: string, content: Buffer, name = "fisler.pdf") => {
    const fd = new FormData();
    fd.append("file", new File([new Uint8Array(content)], name, { type: "application/pdf" }));
    return documentPOST(new Request(`${BASE}/${id}/document`, { method: "POST", body: fd }) as any, { params: { id } });
  },
  download: (id: string, docId: string) => documentGET(req(`${BASE}/${id}/document/${docId}`), { params: { id, docId } }),
  deleteDoc: (id: string, docId: string) => documentDELETE(req(`${BASE}/${id}/document/${docId}`, "DELETE"), { params: { id, docId } }),
  pdf: (id: string, qs = "") => pdfGET(req(`${BASE}/${id}/pdf${qs}`), { params: { id } }),
  export: (qs: string) => exportGET(req(`${BASE}/export?${qs}`)),
};

async function detail(id: string) {
  const res = await api.get(id);
  expect(res.status).toBe(200);
  return res.json();
}

async function bytes(res: Response): Promise<Buffer> {
  return Buffer.from(await res.arrayBuffer());
}

let admin: TUser, acc: TUser, accOther: TUser;
let approverA: TUser, empA: TUser, empA2: TUser;
let approverB: TUser, empB: TUser, empB2: TUser;

/** Sahibi olarak form oluşturur, PDF yükler, gönderir; `until`'e kadar ilerletir. */
async function formAt(
  owner: TUser,
  approver: TUser,
  items: object[],
  opts: { cashAdvance?: number; receipt?: Buffer; until: "DEPT_APPROVAL" | "ACCOUNTING_APPROVAL" | "PAYMENT_PENDING" | "PAID"; accountant?: TUser }
) {
  asUser(owner);
  const created = await api.create({ items, cashAdvance: opts.cashAdvance ?? 0, note: "Ankara denetim ziyareti" });
  expect((await api.upload(created.id, opts.receipt ?? receiptPdf(1))).status).toBe(201);
  let d = await (await api.action(created.id, { action: "submit" })).json();
  expect(d.status).toBe("DEPT_APPROVAL");
  if (opts.until === "DEPT_APPROVAL") return d;

  asUser(approver);
  d = await (await api.action(created.id, { action: "dept-approve", roundId: d.rounds[0].id })).json();
  expect(d.status).toBe("ACCOUNTING_APPROVAL");
  if (opts.until === "ACCOUNTING_APPROVAL") return d;

  asUser(opts.accountant ?? acc);
  d = await (await api.action(created.id, { action: "accounting-approve", version: d.version })).json();
  expect(d.status).toBe("PAYMENT_PENDING");
  if (opts.until === "PAYMENT_PENDING") return d;

  d = await (await api.action(created.id, { action: "mark-paid", version: d.version, transactionDate: "2026-09-20", note: "Havale" })).json();
  expect(d.status).toBe("PAID");
  return d;
}

beforeAll(async () => {
  admin = await mkUser("admin", "ADMIN", "ADMIN");
  acc = await mkUser("muhasebe", "MUHASEBE");
  accOther = await mkUser("muhasebe-2", "MUHASEBE");
  [approverA, empA, empA2, approverB, empB, empB2] = await Promise.all([
    mkUser("a-onayci", DEPT_A),
    mkUser("a-personel", DEPT_A),
    mkUser("a-personel-2", DEPT_A),
    mkUser("b-onayci", DEPT_B),
    mkUser("b-personel", DEPT_B),
    mkUser("b-personel-2", DEPT_B),
  ]);
  await prisma.expenseApprovalConfig.createMany({
    data: [
      { department: DEPT_A, userId: approverA.id },
      { department: DEPT_B, userId: approverB.id },
    ],
  });
});

afterAll(async () => {
  const docs = await prisma.expenseDocument.findMany({ where: { formId: { in: createdFormIds } }, select: { storageKey: true } });
  await Promise.all(docs.map((d) => unlink(path.join(UPLOADS, d.storageKey)).catch(() => {})));
  await prisma.notification.deleteMany({ where: { relatedId: { in: createdFormIds } } });
  await prisma.expenseForm.deleteMany({ where: { id: { in: createdFormIds } } });
  await prisma.expenseApprovalConfig.deleteMany({ where: { userId: { in: createdUserIds } } });
  await prisma.user.deleteMany({ where: { id: { in: createdUserIds } } });
  await prisma.$disconnect();
});

describe("Belge–tur eşleşmesi", () => {
  it("belge, etkin olduğu sırada gönderilen turlara bağlanır", () => {
    const t = (m: number) => new Date(Date.UTC(2026, 8, 1, 0, m));
    const rounds = [
      { roundNumber: 1, submittedAt: t(10) },
      { roundNumber: 2, submittedAt: t(30) },
      { roundNumber: 3, submittedAt: t(50) },
    ];
    expect(documentRoundNumbers({ createdAt: t(5), replacedAt: t(20) }, rounds)).toEqual([1]);
    expect(documentRoundNumbers({ createdAt: t(20), replacedAt: null }, rounds)).toEqual([2, 3]);
    expect(documentRoundNumbers({ createdAt: t(60), replacedAt: null }, rounds)).toEqual([]);
  });
});

describe("B1 — Form PDF", () => {
  it("toplamlar, departman/muhasebe onayı ve ödeme bilgisi doğru", async () => {
    const d = await formAt(empA, approverA, [item(5000, { subject: "Konaklama", vendor: "Otel Ankara" }), item(3000)], {
      cashAdvance: 1000,
      until: "PAID",
    });

    asUser(empA);
    const res = await api.pdf(d.id);
    expect(res.status).toBe(200);
    expect(res.headers.get("Content-Type")).toBe("application/pdf");
    expect(res.headers.get("Content-Disposition")).toContain("inline");
    const buf = await bytes(res);
    expect(buf.subarray(0, 5).toString("latin1")).toBe("%PDF-");

    const text = (await pdfText(buf)).replace(/\s+/g, " ");
    expect(text).toContain("PERSONEL HARCAMA FORMU");
    expect(text).toContain(d.formNo);
    expect(text).toContain(empA.name);
    expect(text).toContain("Otel Ankara");
    expect(text).toContain("8.000,00 TL"); // Genel Toplam
    expect(text).toContain("1.000,00 TL"); // Nakit Avans
    expect(text).toContain("7.000,00 TL"); // Net Sonuç
    expect(text).toContain("Ödendi"); // form durumu (Türkçe karakter korunur)
    expect(text).toContain(approverA.name); // departman onayı — kim
    expect(text).toContain("Onayladı");
    expect(text).toContain(acc.name); // muhasebe onayı
    expect(text).toContain("20.09.2026"); // ödeme işlem tarihi
    expect(text).toContain("Havale");

    const dl = await api.pdf(d.id, "?download=1");
    expect(dl.headers.get("Content-Disposition")).toContain("attachment");
  });
});

describe("B2 — Form + harcama belgeleri birleşik PDF", () => {
  it("2 sayfalık form + 8 sayfalık fiş PDF'i → 10 sayfalık tek PDF, storage'a yazılmaz", async () => {
    const items = Array.from({ length: 30 }, (_, i) => item(100 + i, { description: `Satır ${i + 1}` }));
    const d = await formAt(empB, approverB, items, { receipt: receiptPdf(8), until: "ACCOUNTING_APPROVAL" });

    asUser(empB);
    const formOnly = await bytes(await api.pdf(d.id));
    expect(await pageCount(formOnly)).toBe(2);

    const uploadsBefore = (await readdir(UPLOADS)).length;
    const res = await api.pdf(d.id, "?documents=1");
    expect(res.status).toBe(200);
    expect(res.headers.get("X-Expense-Document")).toBe("included");
    expect(res.headers.get("Content-Disposition")).toContain(encodeURIComponent(`${d.formNo}-belgeler.pdf`));
    expect(await pageCount(await bytes(res))).toBe(10);
    // Birleşik PDF kalıcı dosya olarak saklanmaz
    expect((await readdir(UPLOADS)).length).toBe(uploadsBefore);
    expect(await prisma.expenseDocument.count({ where: { formId: d.id } })).toBe(1);

    // Onaycı ve muhasebe de alabilir (formu görebilenler)
    asUser(acc);
    expect((await api.pdf(d.id, "?documents=1")).status).toBe(200);
  });
});

describe("B3 — Kapanmış formda PDF temizliği", () => {
  it("Ödendi formda muhasebe PDF'i siler; form, geçmiş ve metadata kalır", async () => {
    const d = await formAt(empA, approverA, [item(1200)], { receipt: receiptPdf(3), until: "PAID" });
    const doc = await prisma.expenseDocument.findFirstOrThrow({ where: { formId: d.id } });
    const filePath = path.join(UPLOADS, doc.storageKey);
    await access(filePath);
    const auditsBefore = d.audits.length;
    asUser(empA);
    expect((await detail(d.id)).permissions.canDeleteDocument).toBe(false); // sahibi silemez

    asUser(acc);
    expect((await detail(d.id)).permissions.canDeleteDocument).toBe(true);
    const res = await api.deleteDoc(d.id, doc.id);
    expect(res.status).toBe(200);
    const after = await res.json();

    // Fiziksel dosya yok, kayıt ve metadata var
    await expect(access(filePath)).rejects.toThrow();
    const row = await prisma.expenseDocument.findUniqueOrThrow({ where: { id: doc.id } });
    expect(row.deletedAt).not.toBeNull();
    expect(row.deletedById).toBe(acc.id);
    expect(row.name).toBe("fisler.pdf");
    expect(row.uploadedById).toBe(empA.id);

    expect(after.status).toBe("PAID");
    expect(after.items).toHaveLength(1);
    expect(after.totalAmount).toBe(1200);
    expect(after.rounds).toHaveLength(1);
    expect(after.settlements).toHaveLength(1);
    expect(after.activeDocument).toBeNull();
    expect(after.archivedDocuments).toHaveLength(1);
    expect(after.archivedDocuments[0]).toMatchObject({
      name: "fisler.pdf",
      uploadedByName: empA.name,
      deletedByName: acc.name,
      roundNumbers: [1],
    });
    expect(after.audits.length).toBe(auditsBefore + 1);
    const auditRow = after.audits.find((a: any) => a.action === "DOCUMENT_DELETED");
    expect(auditRow.actorName).toBe(acc.name);
    expect(auditRow.meta).toMatchObject({ name: "fisler.pdf", uploadedById: empA.id, roundNumbers: [1] });

    // Silinmiş belge indirilemez; ikinci silme 409
    expect((await api.download(d.id, doc.id)).status).toBe(404);
    expect((await api.deleteDoc(d.id, doc.id)).status).toBe(409);

    // Birleşik PDF → yalnız form PDF'i + arşiv bilgisi
    asUser(empA);
    const formPages = await pageCount(await bytes(await api.pdf(d.id)));
    const combined = await api.pdf(d.id, "?documents=1");
    expect(combined.status).toBe(200);
    expect(combined.headers.get("X-Expense-Document")).toBe("archived");
    const combinedBuf = await bytes(combined);
    expect(await pageCount(combinedBuf)).toBe(formPages);
    expect((await pdfText(combinedBuf)).replace(/\s+/g, " ")).toContain("Fiziksel belge arşivlendikten sonra sistemden kaldırılmıştır.");
  });

  it("Admin de kapanmış (İptal Edildi) formun PDF'ini silebilir", async () => {
    const d = await formAt(empB2, approverB, [item(50)], { until: "DEPT_APPROVAL" });
    asUser(approverB);
    await api.action(d.id, { action: "dept-reject", roundId: d.rounds[0].id, note: "Hatalı" });
    asUser(empB2);
    expect((await (await api.action(d.id, { action: "cancel" })).json()).status).toBe("CANCELLED");

    asUser(admin);
    const res = await api.deleteDoc(d.id, d.activeDocument.id);
    expect(res.status).toBe(200);
    expect((await res.json()).archivedDocuments).toHaveLength(1);
  });
});

describe("B4 — Süreç devam ederken PDF silinemez", () => {
  it("Muhasebe Onayında → 403; Departman Onayında/Ödeme Bekliyor → 403; yetkisiz rol 403/404", async () => {
    const inAccounting = await formAt(empA2, approverA, [item(300)], { until: "ACCOUNTING_APPROVAL" });
    const docId = inAccounting.activeDocument.id;

    asUser(acc);
    const res = await api.deleteDoc(inAccounting.id, docId);
    expect(res.status).toBe(403);
    expect((await detail(inAccounting.id)).permissions.canDeleteDocument).toBe(false);
    asUser(admin);
    expect((await api.deleteDoc(inAccounting.id, docId)).status).toBe(403);

    const inDept = await formAt(empA2, approverA, [item(10)], { until: "DEPT_APPROVAL" });
    asUser(admin);
    expect((await api.deleteDoc(inDept.id, inDept.activeDocument.id)).status).toBe(403);

    const paymentPending = await formAt(empA2, approverA, [item(20)], { until: "PAYMENT_PENDING" });
    asUser(acc);
    expect((await api.deleteDoc(paymentPending.id, paymentPending.activeDocument.id)).status).toBe(403);

    // Dosya ve kayıt yerinde
    const row = await prisma.expenseDocument.findUniqueOrThrow({ where: { id: docId } });
    expect(row.deletedAt).toBeNull();
    await access(path.join(UPLOADS, row.storageKey));

    // Kapanmış formda bile: sahibi / onaycı → 403, görmeyen çalışan → 404
    const paid = await formAt(empA2, approverA, [item(30)], { until: "PAID" });
    asUser(empA2);
    expect((await api.deleteDoc(paid.id, paid.activeDocument.id)).status).toBe(403);
    asUser(approverA);
    expect((await api.deleteDoc(paid.id, paid.activeDocument.id)).status).toBe(403);
    asUser(empA);
    expect((await api.deleteDoc(paid.id, paid.activeDocument.id)).status).toBe(404);
  });
});

async function readWorkbook(res: Response) {
  expect(res.status).toBe(200);
  expect(res.headers.get("Content-Type")).toContain("spreadsheetml");
  const wb = new ExcelJS.Workbook();
  await wb.xlsx.load((await res.arrayBuffer()) as any);
  const rows = (name: string) => {
    const ws = wb.getWorksheet(name)!;
    expect(ws).toBeTruthy();
    const out: unknown[][] = [];
    ws.eachRow((r, n) => {
      if (n > 1) out.push((r.values as unknown[]).slice(1));
    });
    return { header: (ws.getRow(1).values as unknown[]).slice(1), rows: out };
  };
  return { summary: rows("Form Özeti"), details: rows("Harcama Detayı") };
}

describe("B5 — Excel export", () => {
  it("ekran filtreleri uygulanır; yetki dışı form ve satır girmez", async () => {
    // Diğer testlerin formlarından yalıtılmış departman
    const DEPT_C = `TEST_OUT_C_${STAMP}`;
    const [approverC, empC, empC2] = await Promise.all([mkUser("c-onayci", DEPT_C), mkUser("c-personel", DEPT_C), mkUser("c-personel-2", DEPT_C)]);
    await prisma.expenseApprovalConfig.create({ data: { department: DEPT_C, userId: approverC.id } });

    const b1 = await formAt(empC, approverC, [item(400, { clientProject: "ACME A.Ş." }), item(600)], { cashAdvance: 100, until: "PAID" });
    const b2 = await formAt(empC2, approverC, [item(250)], { until: "ACCOUNTING_APPROVAL" });
    const bDept = await formAt(empC, approverC, [item(75)], { until: "DEPT_APPROVAL" }); // muhasebeye ulaşmadı
    const a1 = await formAt(empA, approverA, [item(90)], { until: "ACCOUNTING_APPROVAL" });

    // Departman filtresi (Tümü görünümü)
    asUser(acc);
    let wb = await readWorkbook(await api.export(`scope=accounting&view=all&department=${DEPT_C}`));
    expect(wb.summary.header).toEqual([
      "Form No", "Personel", "Departman", "Toplam Harcama", "Nakit Avans", "Net Tutar", "Durum", "Muhasebe Onay Tarihi", "Ödeme/İade Tarihi",
    ]);
    const formNos = wb.summary.rows.map((r) => r[0]);
    expect(formNos).toContain(b1.formNo);
    expect(formNos).toContain(b2.formNo);
    expect(formNos).not.toContain(a1.formNo); // başka departman
    expect(formNos).not.toContain(bDept.formNo); // muhasebe yetkisi dışında (departman onayında)
    expect(formNos).toHaveLength(2);
    const b1Row = wb.summary.rows.find((r) => r[0] === b1.formNo)!;
    expect(b1Row.slice(1, 7)).toEqual([empC.name, DEPT_C, 1000, 100, 900, "Ödendi"]);
    expect(b1Row[7]).toBeInstanceOf(Date);
    expect((b1Row[8] as Date).toISOString().slice(0, 10)).toBe("2026-09-20");
    const b2Row = wb.summary.rows.find((r) => r[0] === b2.formNo)!;
    expect(b2Row[6]).toBe("Muhasebe Onayında");
    expect(b2Row[7] ?? null).toBeNull();

    // Sheet 2 — her harcama satırı ayrı satır
    expect(wb.details.header).toEqual([
      "Form No", "Personel", "Departman", "Harcama Tarihi", "Harcama Konusu", "Firma/Harcama Yeri", "Açıklama", "İlgili Müşteri/Proje", "Tutar",
    ]);
    const b1Items = wb.details.rows.filter((r) => r[0] === b1.formNo);
    expect(b1Items).toHaveLength(2);
    expect(b1Items[0].slice(4)).toEqual(["Yol", "Taksi", "Müşteri ziyareti", "ACME A.Ş.", 400]);
    expect((b1Items[0][3] as Date).toISOString().slice(0, 10)).toBe("2026-09-01");
    expect(wb.details.rows.some((r) => r[0] === bDept.formNo || r[0] === a1.formNo)).toBe(false);

    // Durum + personel filtresi
    wb = await readWorkbook(await api.export(`scope=accounting&view=all&department=${DEPT_C}&status=ACCOUNTING_APPROVAL`));
    expect(wb.summary.rows.map((r) => r[0])).toEqual([b2.formNo]);
    wb = await readWorkbook(await api.export(`scope=accounting&view=all&ownerId=${empC.id}`));
    expect(wb.summary.rows.map((r) => r[0])).toEqual([b1.formNo]);

    // Varsayılan "Bekleyen İşlemler" görünümü → kapanmış form girmez
    wb = await readWorkbook(await api.export(`scope=accounting&department=${DEPT_C}`));
    expect(wb.summary.rows.map((r) => r[0])).toEqual([b2.formNo]);

    // Arama + tarih filtresi
    wb = await readWorkbook(await api.export(`scope=accounting&view=all&q=${encodeURIComponent("ACME")}&department=${DEPT_C}`));
    expect(wb.summary.rows.map((r) => r[0])).toEqual([b1.formNo]);
    wb = await readWorkbook(await api.export(`scope=accounting&view=all&department=${DEPT_C}&dateTo=2020-01-01`));
    expect(wb.summary.rows).toHaveLength(0);

    // Admin: Tüm Formlar kapsamı (muhasebeye ulaşmamış form da görünür)
    asUser(admin);
    wb = await readWorkbook(await api.export(`scope=all&department=${DEPT_C}`));
    expect(wb.summary.rows.map((r) => r[0]).sort()).toEqual([b1.formNo, b2.formNo, bDept.formNo].sort());

    // Yetkisiz: muhasebe/admin olmayan → 403 (onaycı da dahil); muhasebe "Tüm Formlar" → 404
    asUser(approverC);
    expect((await api.export(`scope=accounting&department=${DEPT_C}`)).status).toBe(403);
    asUser(empC);
    expect((await api.export("scope=accounting")).status).toBe(403);
    asUser(accOther);
    expect((await api.export("scope=all")).status).toBe(404);
    expect((await api.export("scope=mine")).status).toBe(400);
  });
});

describe("B6 — Başka personelin form PDF'i", () => {
  it("aynı departmandaki çalışan form PDF'ini / birleşik PDF'i indiremez → 404", async () => {
    const d = await formAt(empA, approverA, [item(70)], { until: "DEPT_APPROVAL" });
    asUser(empA2);
    expect((await api.pdf(d.id)).status).toBe(404);
    expect((await api.pdf(d.id, "?documents=1&download=1")).status).toBe(404);
    // Muhasebe aşamasına gelmemiş form muhasebeye de görünmez
    asUser(acc);
    expect((await api.pdf(d.id)).status).toBe(404);
    // Taslak onaycıya görünmez
    asUser(empA);
    const draft = await api.create({ items: [item(5)] });
    asUser(approverA);
    expect((await api.pdf(draft.id)).status).toBe(404);
    // Sahibi ve onaycı alabilir
    expect((await api.pdf(d.id)).status).toBe(200);
    asUser(empA);
    expect((await api.pdf(draft.id)).status).toBe(200);
  });
});
