/**
 * Personel Harcama Formu — girdi ayrıştırma ve onaya gönderim doğrulaması.
 *
 * Taslak kaydı gevşektir (eksik satır kaydedilebilir); onaya gönderim sıkıdır.
 * Her iki kontrol de sunucuda çalışır — istemci doğrulaması yalnız kolaylıktır.
 */

import { EXPENSE_MAX_AMOUNT, parseAmountInput, roundMoney } from "./calc";

export class ExpenseError extends Error {
  constructor(public status: number, message: string) {
    super(message);
    this.name = "ExpenseError";
  }
}

const MAX_ITEMS = 200;
const MAX_TEXT = 500;
const MAX_NOTE = 2000;

export interface ExpenseItemInput {
  date: Date | null;
  subject: string;
  vendor: string;
  description: string;
  clientProject: string | null;
  amount: number;
}

export interface ExpenseDraftInput {
  note: string | null;
  cashAdvance: number;
  items: ExpenseItemInput[];
}

function text(v: unknown, field: string, max = MAX_TEXT): string {
  if (v === null || v === undefined) return "";
  if (typeof v !== "string") throw new ExpenseError(400, `${field} metin olmalı`);
  const s = v.trim();
  if (s.length > max) throw new ExpenseError(400, `${field} en fazla ${max} karakter olabilir`);
  return s;
}

/** "YYYY-MM-DD" → UTC gece yarısı. Boş → null. */
export function parseDateOnly(v: unknown, field: string): Date | null {
  if (v === null || v === undefined || v === "") return null;
  if (typeof v !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(v.slice(0, 10))) {
    throw new ExpenseError(400, `${field} geçersiz`);
  }
  const d = new Date(`${v.slice(0, 10)}T00:00:00.000Z`);
  if (Number.isNaN(d.getTime())) throw new ExpenseError(400, `${field} geçersiz`);
  return d;
}

function amount(v: unknown, field: string): number {
  const n = parseAmountInput(v as string | number | null | undefined);
  if (n === null) throw new ExpenseError(400, `${field} geçerli bir tutar değil`);
  if (n < 0) throw new ExpenseError(400, `${field} negatif olamaz`);
  if (n > EXPENSE_MAX_AMOUNT) throw new ExpenseError(400, `${field} çok büyük`);
  return roundMoney(n);
}

/** PATCH/POST gövdesini ayrıştırır. Tamamen boş satırlar atılır. */
export function parseExpenseDraftInput(body: any): ExpenseDraftInput {
  if (!body || typeof body !== "object") throw new ExpenseError(400, "Geçersiz istek");
  const rawItems = body.items ?? [];
  if (!Array.isArray(rawItems)) throw new ExpenseError(400, "Harcama satırları liste olmalı");
  if (rawItems.length > MAX_ITEMS) throw new ExpenseError(400, `En fazla ${MAX_ITEMS} harcama satırı girilebilir`);

  const items: ExpenseItemInput[] = [];
  rawItems.forEach((raw: any, idx: number) => {
    const n = idx + 1;
    const item: ExpenseItemInput = {
      date: parseDateOnly(raw?.date, `${n}. satır tarihi`),
      subject: text(raw?.subject, `${n}. satır harcama konusu`),
      vendor: text(raw?.vendor, `${n}. satır firma/harcama yeri`),
      description: text(raw?.description, `${n}. satır açıklaması`),
      clientProject: text(raw?.clientProject, `${n}. satır müşteri/proje`) || null,
      amount: amount(raw?.amount, `${n}. satır tutarı`),
    };
    const empty = !item.date && !item.subject && !item.vendor && !item.description && !item.clientProject && item.amount === 0;
    if (!empty) items.push(item);
  });

  return {
    note: text(body.note, "Genel açıklama", MAX_NOTE) || null,
    cashAdvance: amount(body.cashAdvance ?? 0, "Nakit avans"),
    items,
  };
}

/**
 * Onaya gönderim için içerik doğrulaması. Hata mesajlarının listesini döner
 * (boş liste = geçerli).
 */
export function validateExpenseForSubmission(form: {
  cashAdvance: number;
  items: { date: Date | null; subject: string; vendor: string; description: string; amount: number }[];
  activeDocument: { mimeType: string } | null;
}): string[] {
  const errors: string[] = [];
  if (form.items.length === 0) errors.push("En az bir harcama satırı girilmelidir.");
  form.items.forEach((i, idx) => {
    const missing: string[] = [];
    if (!i.date) missing.push("tarih");
    if (!i.subject.trim()) missing.push("harcama konusu");
    if (!i.vendor.trim()) missing.push("firma/harcama yeri");
    if (!i.description.trim()) missing.push("açıklama");
    if (missing.length) errors.push(`${idx + 1}. satırda eksik alan: ${missing.join(", ")}.`);
    if (!(i.amount > 0)) errors.push(`${idx + 1}. satırın tutarı sıfırdan büyük olmalıdır.`);
  });
  if (form.cashAdvance < 0) errors.push("Nakit avans negatif olamaz.");
  if (!form.activeDocument) errors.push("Onaya göndermek için harcama belgelerini içeren 1 PDF yüklenmelidir.");
  else if (form.activeDocument.mimeType !== "application/pdf") errors.push("Harcama belgesi PDF olmalıdır.");
  return errors;
}

/** Yüklenen dosyanın gerçekten PDF olup olmadığı — uzantı/MIME + "%PDF-" imzası. */
export function isPdfUpload(name: string, type: string, buffer: Buffer): boolean {
  const looksPdf = name.toLowerCase().endsWith(".pdf") || type === "application/pdf";
  return looksPdf && buffer.length >= 5 && buffer.subarray(0, 5).toString("latin1") === "%PDF-";
}
