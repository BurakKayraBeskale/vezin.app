"use client";

import clsx from "clsx";
import { formatTRY, netDirection } from "@/lib/expense/calc";
import { EXPENSE_STATUS_LABELS, type ExpenseStatus } from "@/lib/expense/constants";

type BadgeColor = "indigo" | "orange" | "gray" | "red" | "emerald";

const STATUS_COLOR: Record<ExpenseStatus, BadgeColor> = {
  DRAFT:               "gray",
  DEPT_APPROVAL:       "indigo",
  REVISION:            "red",
  ACCOUNTING_APPROVAL: "indigo",
  PAYMENT_PENDING:     "orange",
  REFUND_PENDING:      "orange",
  PAID:                "emerald",
  REFUND_RECEIVED:     "emerald",
  SETTLED:             "emerald",
  CANCELLED:           "gray",
};

export function Badge({ color, children }: { color: BadgeColor; children: React.ReactNode }) {
  return (
    <span
      className="inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-semibold border whitespace-nowrap"
      style={{
        backgroundColor: `var(--badge-${color}-bg)`,
        color: `var(--badge-${color}-text)`,
        borderColor: `var(--badge-${color}-border)`,
      }}
    >
      {children}
    </span>
  );
}

export function ExpenseStatusBadge({ status }: { status: string }) {
  const color = STATUS_COLOR[status as ExpenseStatus] ?? "gray";
  return <Badge color={color}>{EXPENSE_STATUS_LABELS[status as ExpenseStatus] ?? status}</Badge>;
}

/** Net tutar — işaret ve yönle: +₺7.000,00 alacak / −₺2.000,00 iade / ₺0,00 mahsup. */
export function NetAmount({ amount, withLabel = false, className }: { amount: number; withLabel?: boolean; className?: string }) {
  const dir = netDirection(amount);
  const text =
    dir === "RECEIVABLE" ? `+${formatTRY(amount)}` : dir === "REFUND" ? `−${formatTRY(-amount)}` : formatTRY(0);
  const label = dir === "RECEIVABLE" ? "Alacak" : dir === "REFUND" ? "İade" : "Mahsup";
  return (
    <span
      className={clsx(
        "tabular-nums font-semibold whitespace-nowrap",
        dir === "RECEIVABLE" && "text-emerald-600",
        dir === "REFUND" && "text-red-600",
        dir === "ZERO" && "text-gray-500",
        className
      )}
    >
      {text}
      {withLabel && <span className="ml-1.5 text-[11px] font-medium opacity-80">{label}</span>}
    </span>
  );
}

/** Satır tarihi — DB'de UTC gece yarısı saklanır, UTC'de gösterilir (gün kaymaz). */
export function formatDay(iso: string | null | undefined): string {
  if (!iso) return "—";
  return new Date(iso).toLocaleDateString("tr-TR", { timeZone: "UTC", day: "2-digit", month: "2-digit", year: "numeric" });
}

export function formatDateTime(iso: string | null | undefined): string {
  if (!iso) return "—";
  return new Date(iso).toLocaleString("tr-TR", {
    timeZone: "Europe/Istanbul",
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export function formatCreatedDate(iso: string | null | undefined): string {
  if (!iso) return "—";
  return new Date(iso).toLocaleDateString("tr-TR", { timeZone: "Europe/Istanbul", day: "2-digit", month: "2-digit", year: "numeric" });
}

/** Bugün (Türkiye) — YYYY-MM-DD */
export function todayIso(): string {
  return new Date(Date.now() + 3 * 60 * 60 * 1000).toISOString().slice(0, 10);
}

export function Card({ title, right, children, className }: { title?: React.ReactNode; right?: React.ReactNode; children: React.ReactNode; className?: string }) {
  return (
    <section className={clsx("bg-white rounded-2xl border border-gray-100 shadow-sm", className)}>
      {(title || right) && (
        <div className="px-5 py-3.5 border-b border-gray-100 flex items-center justify-between gap-3 flex-wrap">
          {title && <h2 className="text-sm font-bold text-gray-700">{title}</h2>}
          {right}
        </div>
      )}
      {children}
    </section>
  );
}

export function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="min-w-0">
      <p className="text-[11px] font-semibold text-gray-400 uppercase tracking-wide mb-0.5">{label}</p>
      <div className="text-sm text-gray-800 truncate">{children}</div>
    </div>
  );
}

export function ErrorBox({ children }: { children: React.ReactNode }) {
  return <div className="bg-red-50 border border-red-200 text-red-600 text-sm rounded-xl px-4 py-2.5 whitespace-pre-line">{children}</div>;
}

export const inputCls =
  "w-full px-3 py-2 text-sm border border-gray-200 rounded-xl bg-white focus:outline-none focus:ring-2 focus:ring-[#F57C28]/30 focus:border-[#F57C28] transition-all";

export const btnPrimary =
  "inline-flex items-center justify-center gap-1.5 px-4 py-2 rounded-xl bg-[#F57C28] hover:bg-[#D96A1A] disabled:opacity-60 text-white text-sm font-semibold transition-colors shadow-md shadow-[#F57C28]/25";
export const btnSecondary =
  "inline-flex items-center justify-center gap-1.5 px-4 py-2 rounded-xl border border-gray-200 bg-white text-sm font-medium text-gray-600 hover:bg-gray-50 disabled:opacity-60 transition-colors";
export const btnDanger =
  "inline-flex items-center justify-center gap-1.5 px-4 py-2 rounded-xl border border-red-200 bg-red-50 text-sm font-semibold text-red-600 hover:bg-red-100 disabled:opacity-60 transition-colors";
export const btnSuccess =
  "inline-flex items-center justify-center gap-1.5 px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 disabled:opacity-60 text-white text-sm font-semibold transition-colors shadow-md shadow-emerald-600/20";

/** Basit modal kabuğu — mevcut modal görünümüyle aynı. */
export function Modal({ title, onClose, children, width = "max-w-md" }: { title: string; onClose: () => void; children: React.ReactNode; width?: string }) {
  return (
    <div className="fixed inset-0 bg-black/40 backdrop-blur-sm flex items-center justify-center z-[60] p-4">
      <div className={clsx("bg-white rounded-2xl shadow-2xl w-full max-h-[95vh] overflow-y-auto", width)}>
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
          <h3 className="text-base font-bold text-gray-900">{title}</h3>
          <button type="button" onClick={onClose} className="p-1.5 rounded-lg text-gray-400 hover:bg-gray-100 transition-colors" aria-label="Kapat">
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>
        <div className="p-6">{children}</div>
      </div>
    </div>
  );
}

export async function readError(res: Response): Promise<string> {
  const data = await res.json().catch(() => null);
  return data?.error ?? "Bir hata oluştu";
}
