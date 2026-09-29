"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import clsx from "clsx";
import { formatTRY } from "@/lib/expense/calc";
import ApprovalSettingsPanel from "./ApprovalSettingsPanel";
import { EMPTY_FILTERS, ExpenseFilters, ExpenseListTable, type ExpenseColumn, type ExpenseFilterValue } from "./ExpenseListTable";
import type { ExpenseListResponse, ExpenseTabAccess } from "./types";
import { btnPrimary } from "./ui";

export type ExpenseTab = "mine" | "approvals" | "accounting" | "all" | "settings";

const TAB_LABELS: Record<ExpenseTab, string> = {
  mine: "Formlarım",
  approvals: "Onay Bekleyenler",
  accounting: "Muhasebe İşlemleri",
  all: "Tüm Formlar",
  settings: "Onay Ayarları",
};

const MINE_COLUMNS: ExpenseColumn[] = ["formNo", "createdAt", "total", "advance", "net", "status", "lastAction"];
const STAFF_COLUMNS: ExpenseColumn[] = ["formNo", "owner", "department", "createdAt", "total", "advance", "net", "status", "lastAction"];
const APPROVAL_COLUMNS: ExpenseColumn[] = ["formNo", "owner", "department", "createdAt", "total", "advance", "net", "status", "progress", "lastAction"];

const EMPTY_TEXT: Record<Exclude<ExpenseTab, "settings">, { pending: string; all: string }> = {
  mine: { pending: "Henüz harcama formu oluşturmadınız.", all: "Henüz harcama formu oluşturmadınız." },
  approvals: { pending: "Onayınızı bekleyen form yok.", all: "Onay kapsamınızda form yok." },
  accounting: { pending: "Muhasebe işlemi bekleyen form yok.", all: "Muhasebe aşamasına gelmiş form yok." },
  all: { pending: "Form bulunamadı.", all: "Form bulunamadı." },
};

function SummaryCard({ label, amount, sub, tone }: { label: string; amount: string; sub: string; tone: "emerald" | "red" | "indigo" }) {
  return (
    <div className="bg-white rounded-2xl border border-gray-100 shadow-sm px-5 py-4">
      <p className="text-[11px] font-semibold text-gray-400 uppercase tracking-wide">{label}</p>
      <p
        className={clsx(
          "text-xl font-bold tabular-nums mt-1",
          tone === "emerald" && "text-emerald-600",
          tone === "red" && "text-red-600",
          tone === "indigo" && "text-indigo-600"
        )}
      >
        {amount}
      </p>
      <p className="text-xs text-gray-400 mt-0.5">{sub}</p>
    </div>
  );
}

/**
 * initialFilters: URL'den (Dashboard drill-down, ör. ?tab=accounting&status=PAYMENT_PENDING)
 * gelen başlangıç filtreleri — yalnız ilk açılışta uygulanır; yetki API'de doğrulanır.
 */
export default function ExpenseScreen({
  access,
  initialTab,
  initialFilters,
}: {
  access: ExpenseTabAccess;
  initialTab?: string;
  initialFilters?: { status?: string; ownerId?: string; view?: string };
}) {
  const tabs = useMemo(
    () => (Object.keys(TAB_LABELS) as ExpenseTab[]).filter((t) => access[t]),
    [access]
  );
  const [tab, setTab] = useState<ExpenseTab>(tabs.includes(initialTab as ExpenseTab) ? (initialTab as ExpenseTab) : "mine");
  const [view, setView] = useState<"pending" | "all">(initialFilters?.view === "all" ? "all" : "pending");
  const [filters, setFilters] = useState<ExpenseFilterValue>({
    ...EMPTY_FILTERS,
    status: initialFilters?.status ?? "",
    ownerId: initialFilters?.ownerId ?? "",
  });
  const [debouncedQ, setDebouncedQ] = useState("");
  const [data, setData] = useState<ExpenseListResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [exporting, setExporting] = useState(false);

  function switchTab(t: ExpenseTab) {
    setTab(t);
    setView("pending");
    setFilters(EMPTY_FILTERS);
    setDebouncedQ("");
    setData(null);
    try {
      window.history.replaceState(null, "", t === "mine" ? "/harcama" : `/harcama?tab=${t}`);
    } catch {
      /* yok say */
    }
  }

  useEffect(() => {
    const h = setTimeout(() => setDebouncedQ(filters.q.trim()), 300);
    return () => clearTimeout(h);
  }, [filters.q]);

  /** Liste ve Excel export AYNI parametreleri kullanır — ekrandaki filtreler export'a birebir uygulanır. */
  function listParams(): URLSearchParams {
    const params = new URLSearchParams({ scope: tab });
    if (tab === "approvals" || tab === "accounting") params.set("view", view);
    if (debouncedQ) params.set("q", debouncedQ);
    if (filters.status) params.set("status", filters.status);
    if (filters.dateFrom) params.set("dateFrom", filters.dateFrom);
    if (filters.dateTo) params.set("dateTo", filters.dateTo);
    if (tab !== "mine") {
      if (filters.department) params.set("department", filters.department);
      if (filters.ownerId) params.set("ownerId", filters.ownerId);
    }
    return params;
  }

  async function exportExcel() {
    setExporting(true);
    setError("");
    try {
      const res = await fetch(`/api/expenses/export?${listParams()}`);
      if (!res.ok) {
        const body = await res.json().catch(() => null);
        setError(body?.error ?? "Excel oluşturulamadı");
        return;
      }
      const blob = await res.blob();
      const name = /filename="([^"]+)"/.exec(res.headers.get("Content-Disposition") ?? "")?.[1] ?? "harcama-formlari.xlsx";
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = name;
      document.body.appendChild(a);
      a.click();
      a.remove();
      setTimeout(() => URL.revokeObjectURL(url), 10_000);
    } catch {
      setError("Sunucuya ulaşılamadı");
    } finally {
      setExporting(false);
    }
  }

  useEffect(() => {
    if (tab === "settings") return;
    const params = listParams();
    let cancelled = false;
    setLoading(true);
    setError("");
    fetch(`/api/expenses?${params}`)
      .then(async (r) => {
        const body = await r.json().catch(() => null);
        if (cancelled) return;
        if (!r.ok) {
          setError(body?.error ?? "Liste yüklenemedi");
          setData({ forms: [], facets: null, summary: null, truncated: false });
        } else {
          setData(body);
        }
      })
      .catch(() => !cancelled && setError("Sunucuya ulaşılamadı"))
      .finally(() => !cancelled && setLoading(false));
    return () => {
      cancelled = true;
    };
    // listParams yalnız bu bağımlılıklardan türetilir
  }, [tab, view, debouncedQ, filters.status, filters.dateFrom, filters.dateTo, filters.department, filters.ownerId]);

  const columns = tab === "mine" ? MINE_COLUMNS : tab === "approvals" ? APPROVAL_COLUMNS : STAFF_COLUMNS;
  const hasViewToggle = tab === "approvals" || tab === "accounting";
  // Muhasebe İşlemleri (muhasebe) ve Tüm Formlar (Admin) — yetki sunucuda yeniden doğrulanır
  const canExport = tab === "accounting" || tab === "all";
  const summary = tab === "mine" ? data?.summary : null;

  return (
    <>
      <div className="mb-5 flex items-start justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold text-gray-800">Personel Harcama Formu</h1>
          <p className="text-sm text-gray-400 mt-1">Harcamalarınızı beyan edin, onay ve ödeme sürecini takip edin</p>
        </div>
        <Link href="/harcama/yeni" className={btnPrimary}>
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
          </svg>
          Yeni Form
        </Link>
      </div>

      {tabs.length > 1 && (
        <div className="flex gap-1 border-b border-gray-200 mb-5 overflow-x-auto">
          {tabs.map((t) => (
            <button
              key={t}
              type="button"
              onClick={() => switchTab(t)}
              className={clsx(
                "px-4 py-2.5 text-sm font-semibold whitespace-nowrap border-b-2 -mb-px transition-colors",
                tab === t ? "border-[#F57C28] text-[#F57C28]" : "border-transparent text-gray-400 hover:text-gray-600"
              )}
            >
              {TAB_LABELS[t]}
            </button>
          ))}
        </div>
      )}

      {tab === "settings" ? (
        <ApprovalSettingsPanel />
      ) : (
        <>
          {tab === "mine" && (
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mb-5">
              <SummaryCard
                label="Vezin'den Alacağım"
                amount={summary ? formatTRY(summary.receivable.amount) : "—"}
                sub={summary ? `${summary.receivable.count} form ödeme bekliyor` : " "}
                tone="emerald"
              />
              <SummaryCard
                label="Vezin'e İade Etmem Gereken"
                amount={summary ? formatTRY(summary.refund.amount) : "—"}
                sub={summary ? `${summary.refund.count} form iade bekliyor` : " "}
                tone="red"
              />
              <SummaryCard
                label="Onay Sürecindeki Talepler"
                amount={summary ? `${summary.inApproval.count} form` : "—"}
                sub={summary ? `Net ${formatTRY(summary.inApproval.amount)} — henüz kesinleşmedi` : " "}
                tone="indigo"
              />
            </div>
          )}

          <div className="bg-white rounded-2xl border border-gray-100 shadow-sm">
            {(hasViewToggle || canExport) && (
              <div className="px-5 pt-3 flex gap-1.5 items-center">
                {hasViewToggle &&
                  (["pending", "all"] as const).map((v) => (
                    <button
                      key={v}
                      type="button"
                      onClick={() => setView(v)}
                      className={clsx(
                        "px-3 py-1.5 rounded-lg text-xs font-semibold border transition-colors",
                        view === v ? "border-[#F57C28] bg-[#FFF3E9] text-[#F57C28]" : "border-gray-200 text-gray-500 hover:border-gray-300"
                      )}
                    >
                      {v === "pending" ? (tab === "approvals" ? "Onayımı Bekleyenler" : "Bekleyen İşlemler") : "Tümü"}
                    </button>
                  ))}
                {canExport && (
                  <button
                    type="button"
                    onClick={exportExcel}
                    disabled={exporting || !data || data.forms.length === 0}
                    className="ml-auto inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold border border-emerald-200 bg-emerald-50 text-emerald-700 hover:bg-emerald-100 disabled:opacity-50 transition-colors"
                  >
                    <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v12m0 0l-4-4m4 4l4-4M4 20h16" />
                    </svg>
                    {exporting ? "Hazırlanıyor…" : "Excel'e Aktar"}
                  </button>
                )}
              </div>
            )}
            <ExpenseFilters value={filters} onChange={setFilters} showDepartmentAndOwner={tab !== "mine"} facets={data?.facets ?? null} />
            {error && <div className="px-5 pt-3 text-sm text-red-600">{error}</div>}
            <ExpenseListTable
              rows={data?.forms ?? null}
              columns={columns}
              loading={loading}
              emptyText={EMPTY_TEXT[tab][hasViewToggle ? view : "all"]}
            />
            {data?.truncated && (
              <p className="px-5 py-2.5 text-xs text-gray-400 border-t border-gray-100">
                İlk 500 kayıt gösteriliyor — daraltmak için filtre kullanın.
              </p>
            )}
          </div>
        </>
      )}
    </>
  );
}
