/**
 * Personel Harcama Formu — iş akışı (durum geçişleri). Tüm geçişler buradan
 * geçer; API uçları yalnız bu fonksiyonları çağırır.
 *
 * Concurrency:
 *   - Her geçişin transaction içindeki İLK ifadesi koşullu bir yazmadır
 *     (updateMany WHERE id + beklenen durum [+ version]). SQLite yazmaları
 *     serileştirdiği için aynı anda gelen iki istekten yalnız biri 1 satır
 *     günceller; diğeri 0 satır görür ve 409 alır.
 *   - Muhasebe/ödeme/iade/geri alma işlemleri istemcinin gördüğü `version`
 *     değerini ister: stale ekrandan (ör. form reddedilip yeniden gönderilmiş
 *     ve tekrar muhasebeye gelmişken) işlem yapılamaz.
 *   - Departman onayı `roundId` ister: onaycı yalnız o anki açık turdaki kendi
 *     PENDING kaydını, yalnız bir kez sonuçlandırabilir; reddedilmiş turdan onay
 *     verilemez. (version yerine roundId kullanılır ki paralel onaycılar
 *     birbirinin onayı yüzünden 409 almasın.)
 *
 * Hata → ExpenseError(status): 400 doğrulama, 403 yetkisiz işlem, 404 görünmez
 * form, 409 durum/sürüm çakışması.
 */

import { randomBytes } from "crypto";
import { mkdir, readFile, unlink, writeFile } from "fs/promises";
import path from "path";
import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { sendNotification, sendNotificationToMany } from "@/lib/notifications";
import { computeExpenseTotals, formatTRY, netDirection, statusAfterAccountingApproval } from "./calc";
import {
  EXPENSE_CLOSED_STATUSES,
  EXPENSE_EDITABLE_STATUSES,
  EXPENSE_NOTIFICATION_TYPES as NT,
  EXPENSE_NO_APPROVER_MESSAGE,
  EXPENSE_PDF_MAX_BYTES,
  EXPENSE_REVERT_TARGET,
  EXPENSE_STALE_MESSAGE,
  formatExpenseFormNo,
  EXPENSE_FORM_NO_PREFIX,
  type ExpenseStatus,
} from "./constants";
import { accountingRecipientIds, documentRoundNumbers, resolveDepartmentApprovers, type ExpenseActorFull } from "./data";
import {
  canDeleteExpenseForm,
  canDeleteExpensePdf,
  canViewExpenseForm,
  currentRound,
  hasExpenseAccountingRole,
  isExpenseAdmin,
  type ExpenseActorScope,
} from "./permissions";
import {
  ExpenseError,
  isPdfUpload,
  parseDateOnly,
  validateExpenseForSubmission,
  type ExpenseDraftInput,
} from "./validation";

type Tx = Prisma.TransactionClient;

// ── Yardımcılar ──────────────────────────────────────────────────────────────

function stale(): never {
  throw new ExpenseError(409, EXPENSE_STALE_MESSAGE);
}

function requireVersion(v: unknown): number {
  if (typeof v !== "number" || !Number.isInteger(v)) throw new ExpenseError(400, "Form sürümü (version) gerekli");
  return v;
}

function requireNote(v: unknown, message: string): string {
  const s = typeof v === "string" ? v.trim() : "";
  if (!s) throw new ExpenseError(400, message);
  if (s.length > 2000) throw new ExpenseError(400, "Açıklama en fazla 2000 karakter olabilir");
  return s;
}

function optionalNote(v: unknown): string | null {
  const s = typeof v === "string" ? v.trim() : "";
  if (s.length > 2000) throw new ExpenseError(400, "Açıklama en fazla 2000 karakter olabilir");
  return s || null;
}

/** Bugünün tarihi (Türkiye, UTC+3) — UTC gece yarısı olarak. */
function todayDateOnly(): Date {
  const tr = new Date(Date.now() + 3 * 60 * 60 * 1000);
  return new Date(Date.UTC(tr.getUTCFullYear(), tr.getUTCMonth(), tr.getUTCDate()));
}

/**
 * Koşullu form güncellemesi — beklenen durum (ve verildiyse version) tutmuyorsa
 * 409. Her başarılı geçişte version +1 ve lastActionAt güncellenir.
 */
async function guardedFormUpdate(
  tx: Tx,
  formId: string,
  expect: { status: string | { in: string[] }; version?: number },
  data: Prisma.ExpenseFormUpdateManyMutationInput
): Promise<void> {
  const res = await tx.expenseForm.updateMany({
    where: { id: formId, status: expect.status, ...(expect.version !== undefined ? { version: expect.version } : {}) },
    data: { ...data, version: { increment: 1 }, lastActionAt: new Date() },
  });
  if (res.count !== 1) stale();
}

async function audit(
  tx: Tx,
  formId: string,
  actor: { id: string; name: string } | null,
  action: string,
  opts: { from?: string | null; to?: string | null; note?: string | null; meta?: Record<string, unknown> } = {}
): Promise<string> {
  const row = await tx.expenseAudit.create({
    data: {
      formId,
      action,
      actorId: actor?.id ?? null,
      actorName: actor?.name ?? null,
      fromStatus: opts.from ?? null,
      toStatus: opts.to ?? null,
      note: opts.note ?? null,
      meta: opts.meta ? JSON.stringify(opts.meta) : null,
    },
  });
  return row.id;
}

const actionFormInclude = {
  rounds: { orderBy: { roundNumber: "asc" as const }, include: { approvals: true } },
};

async function loadForAction(formId: string, actor: ExpenseActorFull, scope: ExpenseActorScope) {
  const form = await prisma.expenseForm.findUnique({ where: { id: formId }, include: actionFormInclude });
  if (!form || !canViewExpenseForm(actor, form, scope)) throw new ExpenseError(404, "Form bulunamadı");
  return form;
}

function ownerDisplayName(form: { ownerNameSnapshot: string | null }, fallback: string): string {
  return form.ownerNameSnapshot ?? fallback;
}

function isUniqueViolation(e: unknown): boolean {
  return typeof e === "object" && e !== null && (e as { code?: string }).code === "P2002";
}

// ── Form No ──────────────────────────────────────────────────────────────────

async function nextFormNo(tx: Tx, year: number): Promise<string> {
  const prefix = `${EXPENSE_FORM_NO_PREFIX}-${year}-`;
  const last = await tx.expenseForm.findFirst({
    where: { formNo: { startsWith: prefix } },
    orderBy: { formNo: "desc" },
    select: { formNo: true },
  });
  const lastSeq = last ? parseInt(last.formNo.slice(prefix.length), 10) || 0 : 0;
  return formatExpenseFormNo(year, lastSeq + 1);
}

// ── Taslak: oluştur / düzenle / sil ──────────────────────────────────────────

export async function createExpenseForm(actor: ExpenseActorFull, input: ExpenseDraftInput): Promise<string> {
  const totals = computeExpenseTotals(input.items, input.cashAdvance);
  const year = todayDateOnly().getUTCFullYear();
  for (let attempt = 0; ; attempt++) {
    try {
      return await prisma.$transaction(async (tx) => {
        const formNo = await nextFormNo(tx, year);
        const form = await tx.expenseForm.create({
          data: {
            formNo,
            ownerId: actor.id,
            note: input.note,
            ...totals,
            items: { create: input.items.map((i, idx) => ({ ...i, sortOrder: idx })) },
          },
        });
        await audit(tx, form.id, actor, "CREATED", { to: "DRAFT", meta: { formNo } });
        return form.id;
      });
    } catch (e) {
      // Aynı anda iki taslak aynı numarayı almaya çalıştı → yeniden dene
      if (isUniqueViolation(e) && attempt < 5) continue;
      throw e;
    }
  }
}

export async function updateExpenseDraft(
  actor: ExpenseActorFull,
  scope: ExpenseActorScope,
  formId: string,
  input: ExpenseDraftInput
): Promise<void> {
  const form = await loadForAction(formId, actor, scope);
  if (form.ownerId !== actor.id) throw new ExpenseError(403, "Formu yalnızca sahibi düzenleyebilir");
  if (!EXPENSE_EDITABLE_STATUSES.includes(form.status as ExpenseStatus)) {
    throw new ExpenseError(409, "Onay sürecindeki veya kapanmış form düzenlenemez");
  }
  const totals = computeExpenseTotals(input.items, input.cashAdvance);
  await prisma.$transaction(async (tx) => {
    await guardedFormUpdate(tx, formId, { status: { in: EXPENSE_EDITABLE_STATUSES } }, { note: input.note, ...totals });
    await tx.expenseFormItem.deleteMany({ where: { formId } });
    if (input.items.length) {
      await tx.expenseFormItem.createMany({ data: input.items.map((i, idx) => ({ ...i, formId, sortOrder: idx })) });
    }
    if (form.status === "REVISION") {
      await audit(tx, formId, actor, "UPDATED", { meta: { ...totals, itemCount: input.items.length } });
    }
  });
}

/** Taslak kalıcı silme — iş akışı başlamamışsa (hiç gönderilmemiş) hard delete. */
export async function deleteExpenseDraft(actor: ExpenseActorFull, scope: ExpenseActorScope, formId: string): Promise<void> {
  const form = await loadForAction(formId, actor, scope);
  if (form.ownerId !== actor.id) throw new ExpenseError(403, "Formu yalnızca sahibi silebilir");
  if (!canDeleteExpenseForm(actor, form)) {
    throw new ExpenseError(409, "Yalnızca onaya hiç gönderilmemiş taslak silinebilir");
  }
  const res = await prisma.expenseForm.deleteMany({
    where: { id: formId, ownerId: actor.id, status: "DRAFT", rounds: { none: {} } },
  });
  if (res.count !== 1) stale();
}

// ── Belge (tek PDF) ──────────────────────────────────────────────────────────

function uploadsDir(): string {
  return path.join(process.cwd(), "uploads");
}

export async function uploadExpenseDocument(
  actor: ExpenseActorFull,
  scope: ExpenseActorScope,
  formId: string,
  file: { name: string; type: string; buffer: Buffer }
) {
  const form = await loadForAction(formId, actor, scope);
  if (form.ownerId !== actor.id) throw new ExpenseError(403, "Belgeyi yalnızca form sahibi yükleyebilir");
  if (!EXPENSE_EDITABLE_STATUSES.includes(form.status as ExpenseStatus)) {
    throw new ExpenseError(409, "Onay sürecindeki veya kapanmış formun belgesi değiştirilemez");
  }
  if (file.buffer.length === 0) throw new ExpenseError(400, "Dosya boş");
  if (file.buffer.length > EXPENSE_PDF_MAX_BYTES) throw new ExpenseError(400, "PDF en fazla 20 MB olabilir");
  if (!isPdfUpload(file.name, file.type, file.buffer)) throw new ExpenseError(400, "Yalnızca PDF dosyası yüklenebilir");

  // Diskteki ad kullanıcı girdisi içermez; gerçek ad yalnız DB'de tutulur
  const storageKey = `expense_${Date.now()}_${randomBytes(6).toString("hex")}.pdf`;
  await mkdir(uploadsDir(), { recursive: true });
  const filePath = path.join(uploadsDir(), storageKey);
  await writeFile(filePath, file.buffer);

  try {
    return await prisma.$transaction(async (tx) => {
      await guardedFormUpdate(tx, formId, { status: { in: EXPENSE_EDITABLE_STATUSES } }, {});
      const prev = await tx.expenseDocument.findFirst({ where: { formId, replacedAt: null, deletedAt: null } });
      if (prev) await tx.expenseDocument.update({ where: { id: prev.id }, data: { replacedAt: new Date() } });
      const doc = await tx.expenseDocument.create({
        data: {
          formId,
          name: file.name,
          storageKey,
          size: file.buffer.length,
          mimeType: "application/pdf",
          uploadedById: actor.id,
          uploadedByName: actor.name,
        },
      });
      await audit(tx, formId, actor, prev ? "DOCUMENT_REPLACED" : "DOCUMENT_UPLOADED", {
        meta: { name: file.name, previousName: prev?.name ?? null },
      });
      return doc;
    });
  } catch (e) {
    // Kayda bağlanamayan dosyayı bırakma
    await unlink(filePath).catch(() => {});
    throw e;
  }
}

/** Belge okuma — görüntüleme yetkisi yoksa 404 (URL tahminiyle erişilemez). */
export async function readExpenseDocument(actor: ExpenseActorFull, scope: ExpenseActorScope, formId: string, docId: string) {
  await loadForAction(formId, actor, scope);
  const doc = await prisma.expenseDocument.findFirst({ where: { id: docId, formId, deletedAt: null } });
  if (!doc) throw new ExpenseError(404, "Belge bulunamadı");
  try {
    const buffer = await readFile(path.join(uploadsDir(), path.basename(doc.storageKey)));
    return { name: doc.name, buffer };
  } catch {
    throw new ExpenseError(404, "Belge diskte bulunamadı");
  }
}

/**
 * Harcama belgesi PDF'ini sunucudan kalıcı olarak kaldırır (manuel temizlik —
 * otomatik saklama süresi YOK). Yalnız Muhasebe/Admin, yalnız kapanmış formda.
 *
 * Kayıt SİLİNMEZ: ad, yükleyen, yükleme zamanı, kullanıldığı turlar korunur;
 * deletedAt/deletedById dolar ve DOCUMENT_DELETED audit'i yazılır.
 *
 * Sıra bozuk referansı önler: önce kayıt koşullu olarak (form hâlâ kapalıyken)
 * işaretlenir, sonra dosya silinir. Dosya silinemezse (ENOENT hariç) işaret geri
 * alınır — kayıt ile disk her durumda tutarlı kalır. Diskteki dosyanın elle
 * silinmesine dayanan bir akış yoktur.
 */
export async function deleteExpenseDocumentFile(
  actor: ExpenseActorFull,
  scope: ExpenseActorScope,
  formId: string,
  docId: string
): Promise<void> {
  const form = await loadForAction(formId, actor, scope);
  const doc = await prisma.expenseDocument.findFirst({ where: { id: docId, formId } });
  if (!doc) throw new ExpenseError(404, "Belge bulunamadı");
  if (!hasExpenseAccountingRole(actor)) {
    throw new ExpenseError(403, "Harcama belgesini yalnızca Muhasebe veya Admin kaldırabilir");
  }
  if (!canDeleteExpensePdf(actor, form)) {
    throw new ExpenseError(403, "Süreç devam eden formun harcama belgesi silinemez; yalnız kapanmış formlarda kaldırılabilir");
  }
  if (doc.deletedAt) throw new ExpenseError(409, "Bu belge zaten sunucudan kaldırılmış");

  const now = new Date();
  const roundNumbers = documentRoundNumbers(doc, form.rounds);
  const auditId = await prisma.$transaction(async (tx) => {
    const res = await tx.expenseDocument.updateMany({
      where: { id: doc.id, deletedAt: null, form: { status: { in: EXPENSE_CLOSED_STATUSES } } },
      data: { deletedAt: now, deletedById: actor.id },
    });
    if (res.count !== 1) stale();
    return audit(tx, formId, actor, "DOCUMENT_DELETED", {
      meta: {
        documentId: doc.id,
        name: doc.name,
        size: doc.size,
        uploadedById: doc.uploadedById,
        uploadedByName: doc.uploadedByName,
        uploadedAt: doc.createdAt.toISOString(),
        roundNumbers,
        wasActive: !doc.replacedAt,
        formStatus: form.status,
      },
    });
  });

  try {
    await unlink(path.join(uploadsDir(), path.basename(doc.storageKey)));
  } catch (e) {
    if ((e as NodeJS.ErrnoException).code !== "ENOENT") {
      await prisma.$transaction([
        prisma.expenseDocument.updateMany({ where: { id: doc.id, deletedAt: now }, data: { deletedAt: null, deletedById: null } }),
        prisma.expenseAudit.deleteMany({ where: { id: auditId } }),
      ]);
      throw new ExpenseError(500, "Belge dosyası sunucudan kaldırılamadı; kayıt değiştirilmedi. Lütfen tekrar deneyin.");
    }
  }
}

// ── Onaya gönderme ───────────────────────────────────────────────────────────

async function submitInternal(
  actor: ExpenseActorFull,
  scope: ExpenseActorScope,
  formId: string,
  expected: "DRAFT" | "REVISION"
): Promise<void> {
  const form = await prisma.expenseForm.findUnique({
    where: { id: formId },
    include: {
      items: { orderBy: { sortOrder: "asc" } },
      documents: { where: { replacedAt: null, deletedAt: null } },
      ...actionFormInclude,
    },
  });
  if (!form || !canViewExpenseForm(actor, form, scope)) throw new ExpenseError(404, "Form bulunamadı");
  if (form.ownerId !== actor.id) throw new ExpenseError(403, "Formu yalnızca sahibi onaya gönderebilir");
  if (form.status !== expected) {
    throw new ExpenseError(409, expected === "DRAFT" ? "Yalnızca taslak form onaya gönderilebilir" : "Yalnızca düzeltme bekleyen form yeniden gönderilebilir");
  }

  // Departman: ilk gönderimde dondurulur; yeniden gönderimde dondurulmuş departman kullanılır
  const department = form.departmentSnapshot ?? actor.department;
  if (!department) throw new ExpenseError(400, EXPENSE_NO_APPROVER_MESSAGE);
  const approvers = await resolveDepartmentApprovers(department);
  if (approvers.length === 0) throw new ExpenseError(400, EXPENSE_NO_APPROVER_MESSAGE);

  const errors = validateExpenseForSubmission({
    cashAdvance: form.cashAdvance,
    items: form.items,
    activeDocument: form.documents[0] ?? null,
  });
  if (errors.length) throw new ExpenseError(400, errors.join(" "));

  const totals = computeExpenseTotals(form.items, form.cashAdvance);
  // BYPASS: gönderen, departmanının tanımlı onaycılarından biriyse departman onayı tamamen atlanır
  const bypass = approvers.some((a) => a.id === actor.id);
  const toStatus: ExpenseStatus = bypass ? "ACCOUNTING_APPROVAL" : "DEPT_APPROVAL";
  const now = new Date();
  const firstSubmission = form.snapshotAt === null;
  const roundNumber = (currentRound(form)?.roundNumber ?? 0) + 1;

  await prisma.$transaction(async (tx) => {
    await guardedFormUpdate(
      tx,
      formId,
      { status: expected, version: form.version },
      {
        status: toStatus,
        ...totals,
        lastSubmittedAt: now,
        ...(firstSubmission
          ? {
              ownerNameSnapshot: actor.name,
              departmentSnapshot: department,
              titleSnapshot: actor.title,
              snapshotAt: now,
              firstSubmittedAt: now,
            }
          : {}),
        ...(bypass && !form.reachedAccountingAt ? { reachedAccountingAt: now } : {}),
      }
    );
    // APPROVER SNAPSHOT: o anki onaycılar bu tura dondurulur
    await tx.expenseApprovalRound.create({
      data: {
        formId,
        roundNumber,
        status: bypass ? "SKIPPED" : "PENDING",
        bypassed: bypass,
        requiredCount: bypass ? 0 : approvers.length,
        submittedById: actor.id,
        submittedAt: now,
        closedAt: bypass ? now : null,
        ...(bypass ? {} : { approvals: { create: approvers.map((a) => ({ approverId: a.id })) } }),
      },
    });
    await audit(tx, formId, actor, expected === "DRAFT" ? "SUBMITTED" : "RESUBMITTED", {
      from: expected,
      to: toStatus,
      meta: { roundNumber, ...totals },
    });
    await audit(tx, formId, actor, "ROUND_CREATED", {
      meta: { roundNumber, approvers: bypass ? [] : approvers.map((a) => a.name) },
    });
    if (bypass) await audit(tx, formId, actor, "DEPT_BYPASSED", { meta: { roundNumber } });
  });

  const ownerName = firstSubmission ? actor.name : ownerDisplayName(form, actor.name);
  if (bypass) {
    await notifyAccounting(form.formNo, ownerName, totals.netAmount, formId, actor.id);
  } else {
    await sendNotificationToMany(
      approvers.map((a) => a.id).filter((id) => id !== actor.id),
      NT.approvalRequest,
      `${form.formNo} numaralı harcama formu onayınızı bekliyor — ${ownerName}, net ${formatTRY(totals.netAmount)}.`,
      formId
    );
  }
}

/** Taslağı ilk kez onaya gönderir (yeni round, personel bilgisi snapshot'ı). */
export function submitExpenseForm(actor: ExpenseActorFull, scope: ExpenseActorScope, formId: string) {
  return submitInternal(actor, scope, formId, "DRAFT");
}

/** Düzeltme sonrası yeniden gönderim — YENİ round açılır, departman onayı 0/X'ten başlar. */
export function resubmitExpenseForm(actor: ExpenseActorFull, scope: ExpenseActorScope, formId: string) {
  return submitInternal(actor, scope, formId, "REVISION");
}

async function notifyAccounting(formNo: string, ownerName: string, net: number, formId: string, exceptId: string) {
  const ids = (await accountingRecipientIds()).filter((id) => id !== exceptId);
  await sendNotificationToMany(
    ids,
    NT.accountingRequest,
    `${formNo} numaralı harcama formu muhasebe onayına geldi — ${ownerName}, net ${formatTRY(net)}.`,
    formId
  );
}

// ── Departman onayı ──────────────────────────────────────────────────────────

async function loadDepartmentAction(actor: ExpenseActorFull, scope: ExpenseActorScope, formId: string, roundId: unknown) {
  const form = await loadForAction(formId, actor, scope);
  if (form.ownerId === actor.id) throw new ExpenseError(403, "Kendi formunuz için onay işlemi yapamazsınız");
  const round = currentRound(form);
  const isMember = !!round?.approvals.some((a) => a.approverId === actor.id && a.status !== "REPLACED");
  if (!isMember && !isExpenseAdmin(actor)) throw new ExpenseError(403, "Bu formun onaycısı değilsiniz");
  if (typeof roundId !== "string" || !roundId) throw new ExpenseError(400, "Onay turu (roundId) gerekli");
  if (form.status !== "DEPT_APPROVAL" || !round || round.status !== "PENDING" || round.id !== roundId) stale();
  const myApproval = round.approvals.find((a) => a.approverId === actor.id && a.status === "PENDING") ?? null;
  if (!myApproval && isMember) throw new ExpenseError(409, "Bu onay turu için kararınızı zaten verdiniz");
  return { form, round, myApproval };
}

/**
 * Departman onayı — paralel, sırasız; turdaki TÜM onaycılar onaylayınca form
 * otomatik Muhasebe Onayına geçer. Admin tur üyesi değilse aşamayı tek başına
 * kapatır (bekleyen kayıtlar OVERRIDDEN olur).
 */
export async function approveDepartmentExpense(
  actor: ExpenseActorFull,
  scope: ExpenseActorScope,
  formId: string,
  roundId: unknown
): Promise<void> {
  const { form, round, myApproval } = await loadDepartmentAction(actor, scope, formId, roundId);
  const now = new Date();
  let movedToAccounting = false;

  await prisma.$transaction(async (tx) => {
    if (myApproval) {
      const res = await tx.expenseApproval.updateMany({
        where: { id: myApproval.id, status: "PENDING", round: { status: "PENDING" } },
        data: { status: "APPROVED", decidedAt: now },
      });
      if (res.count !== 1) stale();
      const [pending, approved, required] = await Promise.all([
        tx.expenseApproval.count({ where: { roundId: round.id, status: "PENDING" } }),
        tx.expenseApproval.count({ where: { roundId: round.id, status: "APPROVED" } }),
        tx.expenseApproval.count({ where: { roundId: round.id, status: { not: "REPLACED" } } }),
      ]);
      await audit(tx, formId, actor, "DEPT_APPROVED", { meta: { roundNumber: round.roundNumber, approved, required } });
      movedToAccounting = pending === 0;
    } else {
      const res = await tx.expenseApprovalRound.updateMany({
        where: { id: round.id, status: "PENDING" },
        data: { status: "APPROVED", closedAt: now, closedById: actor.id, adminOverride: true },
      });
      if (res.count !== 1) stale();
      await tx.expenseApproval.updateMany({ where: { roundId: round.id, status: "PENDING" }, data: { status: "OVERRIDDEN", decidedAt: now } });
      await audit(tx, formId, actor, "DEPT_ADMIN_APPROVED", { meta: { roundNumber: round.roundNumber } });
      movedToAccounting = true;
    }

    if (movedToAccounting) {
      if (myApproval) {
        const res = await tx.expenseApprovalRound.updateMany({
          where: { id: round.id, status: "PENDING" },
          data: { status: "APPROVED", closedAt: now },
        });
        if (res.count !== 1) stale();
      }
      await guardedFormUpdate(tx, formId, { status: "DEPT_APPROVAL" }, {
        status: "ACCOUNTING_APPROVAL",
        reachedAccountingAt: form.reachedAccountingAt ?? now,
      });
      await audit(tx, formId, actor, "DEPT_COMPLETED", { from: "DEPT_APPROVAL", to: "ACCOUNTING_APPROVAL", meta: { roundNumber: round.roundNumber } });
    } else {
      await guardedFormUpdate(tx, formId, { status: "DEPT_APPROVAL" }, {});
    }
  });

  if (movedToAccounting) {
    const owner = await prisma.user.findUnique({ where: { id: form.ownerId }, select: { name: true } });
    await notifyAccounting(form.formNo, ownerDisplayName(form, owner?.name ?? ""), form.netAmount, formId, actor.id);
  }
}

/**
 * Departman reddi — açıklama zorunlu. Turu kapatır, form Düzeltme Bekliyor olur.
 * Turdaki önceki onaylar geçmişte kalır, yeni tura taşınmaz.
 */
export async function rejectDepartmentExpense(
  actor: ExpenseActorFull,
  scope: ExpenseActorScope,
  formId: string,
  roundId: unknown,
  noteRaw: unknown
): Promise<void> {
  const note = requireNote(noteRaw, "Red/Düzeltme açıklaması zorunludur");
  const { form, round, myApproval } = await loadDepartmentAction(actor, scope, formId, roundId);
  const now = new Date();

  await prisma.$transaction(async (tx) => {
    if (myApproval) {
      const res = await tx.expenseApproval.updateMany({
        where: { id: myApproval.id, status: "PENDING", round: { status: "PENDING" } },
        data: { status: "REJECTED", decidedAt: now, note },
      });
      if (res.count !== 1) stale();
    }
    const res = await tx.expenseApprovalRound.updateMany({
      where: { id: round.id, status: "PENDING" },
      data: { status: "REJECTED", closedAt: now, closedById: actor.id, rejectionNote: note, adminOverride: !myApproval },
    });
    if (res.count !== 1) stale();
    await guardedFormUpdate(tx, formId, { status: "DEPT_APPROVAL" }, { status: "REVISION" });
    await audit(tx, formId, actor, "DEPT_REJECTED", {
      from: "DEPT_APPROVAL",
      to: "REVISION",
      note,
      meta: { roundNumber: round.roundNumber, adminOverride: !myApproval },
    });
  });

  await sendNotification(
    form.ownerId,
    NT.rejected,
    `${form.formNo} numaralı harcama formunuz departman onayında reddedildi. Sebep: ${note}`,
    formId
  );
}

/**
 * Pasifleşen onaycıyı, form özelinde aynı departmandan başka bir aktif
 * kullanıcıyla değiştirir (yalnız Admin). Eski kayıt REPLACED olarak kalır.
 */
export async function replaceExpenseApprover(
  actor: ExpenseActorFull,
  scope: ExpenseActorScope,
  formId: string,
  approvalId: unknown,
  newApproverId: unknown
): Promise<void> {
  const form = await loadForAction(formId, actor, scope);
  if (!isExpenseAdmin(actor)) throw new ExpenseError(403, "Onaycıyı yalnızca Admin değiştirebilir");
  if (typeof approvalId !== "string" || typeof newApproverId !== "string") {
    throw new ExpenseError(400, "Değiştirilecek onay kaydı ve yeni onaycı gerekli");
  }
  const round = currentRound(form);
  if (form.status !== "DEPT_APPROVAL" || !round || round.status !== "PENDING") stale();
  const approval = round.approvals.find((a) => a.id === approvalId);
  if (!approval || approval.status !== "PENDING") stale();

  const [oldUser, newUser] = await Promise.all([
    prisma.user.findUnique({ where: { id: approval.approverId }, select: { id: true, name: true, status: true } }),
    prisma.user.findUnique({ where: { id: newApproverId }, select: { id: true, name: true, status: true, department: true } }),
  ]);
  if (oldUser?.status === "ACTIVE") throw new ExpenseError(400, "Yalnızca pasifleşmiş onaycı değiştirilebilir");
  if (!newUser || newUser.status !== "ACTIVE" || newUser.department !== form.departmentSnapshot) {
    throw new ExpenseError(400, "Yeni onaycı formun departmanındaki aktif kullanıcılardan seçilmelidir");
  }
  if (newUser.id === form.ownerId) throw new ExpenseError(400, "Form sahibi kendi formunun onaycısı olamaz");
  if (round.approvals.some((a) => a.approverId === newUser.id && a.status !== "REPLACED")) {
    throw new ExpenseError(400, "Bu kullanıcı zaten bu turun onaycısı");
  }

  const now = new Date();
  await prisma.$transaction(async (tx) => {
    const res = await tx.expenseApproval.updateMany({
      where: { id: approval.id, status: "PENDING", round: { status: "PENDING" } },
      data: { status: "REPLACED", replacedAt: now, replacedById: actor.id },
    });
    if (res.count !== 1) stale();
    await tx.expenseApproval.create({
      data: { roundId: round.id, approverId: newUser.id, replacesApprovalId: approval.id },
    });
    await guardedFormUpdate(tx, formId, { status: "DEPT_APPROVAL" }, {});
    await audit(tx, formId, actor, "APPROVER_REPLACED", {
      meta: {
        roundNumber: round.roundNumber,
        oldApproverId: oldUser?.id ?? approval.approverId,
        oldApproverName: oldUser?.name ?? null,
        newApproverId: newUser.id,
        newApproverName: newUser.name,
      },
    });
  });

  const owner = await prisma.user.findUnique({ where: { id: form.ownerId }, select: { name: true } });
  await sendNotification(
    newUser.id,
    NT.approverChanged,
    `${form.formNo} numaralı harcama formunun departman onayı size devredildi — ${ownerDisplayName(form, owner?.name ?? "")}.`,
    formId
  );
}

// ── Muhasebe ─────────────────────────────────────────────────────────────────

async function loadAccountingAction(
  actor: ExpenseActorFull,
  scope: ExpenseActorScope,
  formId: string,
  versionRaw: unknown,
  expected: ExpenseStatus
) {
  const form = await loadForAction(formId, actor, scope);
  if (!hasExpenseAccountingRole(actor)) throw new ExpenseError(403, "Bu işlem için Muhasebe veya Admin yetkisi gerekir");
  if (form.ownerId === actor.id) throw new ExpenseError(403, "Kendi formunuz için muhasebe işlemi yapamazsınız");
  const version = requireVersion(versionRaw);
  if (form.status !== expected || form.version !== version) stale();
  return { form, version };
}

/**
 * Muhasebe onayı — TEK kişinin onayı yeterlidir. Net'e göre:
 *   > 0 → Ödeme Bekliyor, < 0 → İade Bekliyor, = 0 → Mahsuplaştı (otomatik kapanır)
 */
export async function approveAccountingExpense(
  actor: ExpenseActorFull,
  scope: ExpenseActorScope,
  formId: string,
  versionRaw: unknown
): Promise<void> {
  const { form, version } = await loadAccountingAction(actor, scope, formId, versionRaw, "ACCOUNTING_APPROVAL");
  const toStatus = statusAfterAccountingApproval(form.netAmount);
  const round = currentRound(form);
  const now = new Date();

  await prisma.$transaction(async (tx) => {
    await guardedFormUpdate(tx, formId, { status: "ACCOUNTING_APPROVAL", version }, { status: toStatus });
    if (round) {
      await tx.expenseApprovalRound.update({
        where: { id: round.id },
        data: { accountingStatus: "APPROVED", accountingById: actor.id, accountingAt: now, accountingNote: null },
      });
    }
    await audit(tx, formId, actor, "ACCOUNTING_APPROVED", { from: "ACCOUNTING_APPROVAL", to: toStatus, meta: { netAmount: form.netAmount } });
    await audit(tx, formId, actor, toStatus, { meta: { netAmount: form.netAmount } });
    if (toStatus === "SETTLED") {
      await tx.expenseSettlement.create({
        data: {
          formId,
          type: "OFFSET",
          amount: 0,
          transactionDate: todayDateOnly(),
          createdById: actor.id,
          createdByName: actor.name,
        },
      });
    }
  });

  const dir = netDirection(form.netAmount);
  const message =
    dir === "RECEIVABLE"
      ? `${form.formNo} numaralı harcama formunuz muhasebe tarafından onaylandı. Vezin'den alacağınız ${formatTRY(form.netAmount)} ödeme bekliyor.`
      : dir === "REFUND"
        ? `${form.formNo} numaralı harcama formunuz muhasebe tarafından onaylandı. Vezin'e iade etmeniz gereken tutar: ${formatTRY(-form.netAmount)}.`
        : `${form.formNo} numaralı harcama formunuz muhasebe tarafından onaylandı ve mahsuplaştı; ödeme/iade gerekmiyor.`;
  await sendNotification(form.ownerId, NT.accountingApproved, message, formId);
}

/**
 * Muhasebe reddi — açıklama zorunlu, form Düzeltme Bekliyor olur. Yeniden
 * gönderimde form doğrudan muhasebeye DÖNMEZ; departman onayı baştan başlar.
 */
export async function rejectAccountingExpense(
  actor: ExpenseActorFull,
  scope: ExpenseActorScope,
  formId: string,
  versionRaw: unknown,
  noteRaw: unknown
): Promise<void> {
  const note = requireNote(noteRaw, "Red/Düzeltme açıklaması zorunludur");
  const { form, version } = await loadAccountingAction(actor, scope, formId, versionRaw, "ACCOUNTING_APPROVAL");
  const round = currentRound(form);
  const now = new Date();

  await prisma.$transaction(async (tx) => {
    await guardedFormUpdate(tx, formId, { status: "ACCOUNTING_APPROVAL", version }, { status: "REVISION" });
    if (round) {
      await tx.expenseApprovalRound.update({
        where: { id: round.id },
        data: { accountingStatus: "REJECTED", accountingById: actor.id, accountingAt: now, accountingNote: note },
      });
    }
    await audit(tx, formId, actor, "ACCOUNTING_REJECTED", { from: "ACCOUNTING_APPROVAL", to: "REVISION", note });
  });

  await sendNotification(
    form.ownerId,
    NT.rejected,
    `${form.formNo} numaralı harcama formunuz muhasebe tarafından reddedildi. Sebep: ${note}`,
    formId
  );
}

// ── Ödeme / İade kapanışı ────────────────────────────────────────────────────

async function closeSettlement(
  kind: "PAYMENT" | "REFUND",
  actor: ExpenseActorFull,
  scope: ExpenseActorScope,
  formId: string,
  body: { version?: unknown; transactionDate?: unknown; note?: unknown }
): Promise<void> {
  const expected: ExpenseStatus = kind === "PAYMENT" ? "PAYMENT_PENDING" : "REFUND_PENDING";
  const toStatus: ExpenseStatus = kind === "PAYMENT" ? "PAID" : "REFUND_RECEIVED";
  const { form, version } = await loadAccountingAction(actor, scope, formId, body.version, expected);
  const transactionDate = parseDateOnly(body.transactionDate, "İşlem tarihi") ?? todayDateOnly();
  const note = optionalNote(body.note);
  // Kısmi ödeme/iade YOK — tutar her zaman sistemdeki net tutardır (istemciden alınmaz)
  const amount = kind === "PAYMENT" ? form.netAmount : -form.netAmount;

  await prisma.$transaction(async (tx) => {
    await guardedFormUpdate(tx, formId, { status: expected, version }, { status: toStatus });
    await tx.expenseSettlement.create({
      data: { formId, type: kind, amount, transactionDate, note, createdById: actor.id, createdByName: actor.name },
    });
    await audit(tx, formId, actor, toStatus, {
      from: expected,
      to: toStatus,
      note,
      meta: { amount, transactionDate: transactionDate.toISOString().slice(0, 10) },
    });
  });

  await sendNotification(
    form.ownerId,
    kind === "PAYMENT" ? NT.paid : NT.refundReceived,
    kind === "PAYMENT"
      ? `${form.formNo} numaralı harcama formunuz için ${formatTRY(amount)} ödendi.`
      : `${form.formNo} numaralı harcama formunuz için ${formatTRY(amount)} iadeniz alındı.`,
    formId
  );
}

export function markExpensePaid(actor: ExpenseActorFull, scope: ExpenseActorScope, formId: string, body: { version?: unknown; transactionDate?: unknown; note?: unknown }) {
  return closeSettlement("PAYMENT", actor, scope, formId, body);
}

export function markRefundReceived(actor: ExpenseActorFull, scope: ExpenseActorScope, formId: string, body: { version?: unknown; transactionDate?: unknown; note?: unknown }) {
  return closeSettlement("REFUND", actor, scope, formId, body);
}

// ── İptal / geri alma ────────────────────────────────────────────────────────

/** Formu İptal Et — yalnız sahibi, yalnız Düzeltme Bekliyor'da. İptal edilen form tekrar açılamaz. */
export async function cancelExpenseForm(
  actor: ExpenseActorFull,
  scope: ExpenseActorScope,
  formId: string,
  versionRaw?: unknown
): Promise<void> {
  const form = await loadForAction(formId, actor, scope);
  if (form.ownerId !== actor.id) throw new ExpenseError(403, "Formu yalnızca sahibi iptal edebilir");
  if (form.status !== "REVISION") {
    throw new ExpenseError(409, "Yalnızca düzeltme bekleyen form iptal edilebilir");
  }
  const version = versionRaw === undefined ? undefined : requireVersion(versionRaw);
  if (version !== undefined && version !== form.version) stale();

  await prisma.$transaction(async (tx) => {
    await guardedFormUpdate(tx, formId, { status: "REVISION", version }, { status: "CANCELLED" });
    await audit(tx, formId, actor, "CANCELLED", { from: "REVISION", to: "CANCELLED" });
  });
}

/**
 * Kapanış geri alma — yalnız Admin, gerekçe zorunlu. Kapanış kaydı silinmez
 * (revertedAt dolar); bakiye yeniden oluşur.
 *   Ödendi → Ödeme Bekliyor, İade Alındı → İade Bekliyor, Mahsuplaştı → Muhasebe Onayında
 */
export async function revertSettlement(
  actor: ExpenseActorFull,
  scope: ExpenseActorScope,
  formId: string,
  versionRaw: unknown,
  reasonRaw: unknown
): Promise<void> {
  const form = await loadForAction(formId, actor, scope);
  if (!isExpenseAdmin(actor)) throw new ExpenseError(403, "Kapanışı yalnızca Admin geri alabilir");
  const reason = requireNote(reasonRaw, "Geri alma gerekçesi zorunludur");
  const version = requireVersion(versionRaw);
  const target = EXPENSE_REVERT_TARGET[form.status as ExpenseStatus];
  if (!target || form.version !== version) stale();
  const round = currentRound(form);
  const now = new Date();

  await prisma.$transaction(async (tx) => {
    await guardedFormUpdate(tx, formId, { status: form.status, version }, { status: target });
    await tx.expenseSettlement.updateMany({
      where: { formId, revertedAt: null },
      data: { revertedAt: now, revertedById: actor.id, revertedByName: actor.name, revertReason: reason },
    });
    if (target === "ACCOUNTING_APPROVAL" && round) {
      // Mahsup geri alındı → muhasebe kararı yeniden verilecek
      await tx.expenseApprovalRound.update({
        where: { id: round.id },
        data: { accountingStatus: null, accountingById: null, accountingAt: null, accountingNote: null },
      });
    }
    await audit(tx, formId, actor, "SETTLEMENT_REVERTED", { from: form.status, to: target, note: reason });
  });

  await sendNotification(
    form.ownerId,
    NT.settlementReverted,
    `${form.formNo} numaralı harcama formunuzun kapanışı Admin tarafından geri alındı. Gerekçe: ${reason}`,
    formId
  );
}
