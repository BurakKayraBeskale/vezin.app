/**
 * Personel Harcama Formu — tutar hesapları (saf fonksiyonlar, UI + sunucu ortak).
 *
 * Tüm toplama/çıkarma kuruş (tam sayı) üzerinden yapılır; DB'ye 2 ondalıklı
 * REAL yazılır. Sunucu her kayıtta toplamları kendisi hesaplar — istemcinin
 * gönderdiği toplam/net değerlerine asla güvenilmez.
 */

import type { ExpenseStatus } from "./constants";

/** En büyük kabul edilen tek tutar (satır / avans). */
export const EXPENSE_MAX_AMOUNT = 1_000_000_000;

export function toKurus(amount: number): number {
  return Math.round(amount * 100);
}

export function roundMoney(amount: number): number {
  return toKurus(amount) / 100;
}

export interface ExpenseTotals {
  totalAmount: number;
  cashAdvance: number;
  netAmount: number;
}

/** Genel Toplam = satırların toplamı; Net = Genel Toplam − Nakit Avans. */
export function computeExpenseTotals(items: { amount: number }[], cashAdvance: number): ExpenseTotals {
  const totalK = items.reduce((sum, i) => sum + toKurus(Number(i.amount) || 0), 0);
  const advanceK = toKurus(Number(cashAdvance) || 0);
  return {
    totalAmount: totalK / 100,
    cashAdvance: advanceK / 100,
    netAmount: (totalK - advanceK) / 100,
  };
}

/**
 * Net tutarın yönü:
 *   RECEIVABLE → net > 0, Vezin personele borçlu (personel alacaklı)
 *   REFUND     → net < 0, personel Vezin'e iade edecek
 *   ZERO       → mahsup
 */
export type NetDirection = "RECEIVABLE" | "REFUND" | "ZERO";

export function netDirection(netAmount: number): NetDirection {
  const k = toKurus(netAmount);
  if (k > 0) return "RECEIVABLE";
  if (k < 0) return "REFUND";
  return "ZERO";
}

/** Muhasebe onayı sonrası geçilecek durum. */
export function statusAfterAccountingApproval(netAmount: number): ExpenseStatus {
  const dir = netDirection(netAmount);
  if (dir === "RECEIVABLE") return "PAYMENT_PENDING";
  if (dir === "REFUND") return "REFUND_PENDING";
  return "SETTLED";
}

/**
 * Kullanıcının yazdığı tutarı sayıya çevirir. Türkçe ("1.234,56") ve nokta
 * ondalıklı ("1234.56") yazımı kabul eder. Boş → 0. Geçersiz → null.
 */
export function parseAmountInput(raw: string | number | null | undefined): number | null {
  if (raw === null || raw === undefined) return 0;
  if (typeof raw === "number") return Number.isFinite(raw) ? raw : null;
  let s = raw.replace(/[\s₺TL]/gi, "");
  if (s === "") return 0;
  if (s.includes(",")) {
    // Virgül ondalık ayracı → noktalar binlik ayracıdır
    s = s.replace(/\./g, "").replace(",", ".");
  } else if (/^-?\d{1,3}(\.\d{3})+$/.test(s)) {
    // "1.234" / "1.234.567" → binlik ayraçlı tam sayı
    s = s.replace(/\./g, "");
  }
  if (!/^-?\d+(\.\d+)?$/.test(s)) return null;
  const n = Number(s);
  return Number.isFinite(n) ? n : null;
}

const TRY_FORMAT = new Intl.NumberFormat("tr-TR", { style: "currency", currency: "TRY", minimumFractionDigits: 2 });
const NUMBER_FORMAT = new Intl.NumberFormat("tr-TR", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

/** ₺7.000,00 */
export function formatTRY(amount: number): string {
  return TRY_FORMAT.format(roundMoney(amount));
}

/** 7.000,00 (para birimi simgesi olmadan — düzenlenebilir alanlar için) */
export function formatAmountPlain(amount: number): string {
  return NUMBER_FORMAT.format(roundMoney(amount));
}
