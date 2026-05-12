"use client";

import { useEffect, useState } from "react";
import { useSession } from "next-auth/react";
import clsx from "clsx";

type LeaveType = "ANNUAL" | "EXCUSE" | "UNPAID";
type LeaveStatus = "PENDING" | "APPROVED" | "REJECTED";

interface LeaveRequest {
  id: string;
  startDate: string;
  endDate: string;
  days: number;
  type: LeaveType;
  note?: string | null;
  status: LeaveStatus;
  reviewedBy?: string | null;
  createdAt: string;
  user?: { id: string; name: string; email: string };
}

interface LeaveBalance {
  totalDays: number;
  usedDays: number;
  remainingDays: number;
  year: number;
}

const TYPE_LABELS: Record<LeaveType, string> = {
  ANNUAL: "Yıllık İzin",
  EXCUSE: "Mazeret İzni",
  UNPAID: "Ücretsiz İzin",
};

const TYPE_COLORS: Record<LeaveType, { bg: string; text: string; border: string }> = {
  ANNUAL:  { bg: "var(--badge-indigo-bg)",  text: "var(--badge-indigo-text)",  border: "var(--badge-indigo-border)" },
  EXCUSE:  { bg: "var(--badge-orange-bg)",  text: "var(--badge-orange-text)",  border: "var(--badge-orange-border)" },
  UNPAID:  { bg: "var(--badge-gray-bg)",    text: "var(--badge-gray-text)",    border: "var(--badge-gray-border)" },
};

const STATUS_LABELS: Record<LeaveStatus, string> = {
  PENDING:  "Bekliyor",
  APPROVED: "Onaylandı",
  REJECTED: "Reddedildi",
};

const STATUS_COLORS: Record<LeaveStatus, { bg: string; text: string; border: string }> = {
  PENDING:  { bg: "var(--badge-orange-bg)",  text: "var(--badge-orange-text)",  border: "var(--badge-orange-border)" },
  APPROVED: { bg: "var(--badge-emerald-bg)", text: "var(--badge-emerald-text)", border: "var(--badge-emerald-border)" },
  REJECTED: { bg: "var(--badge-red-bg)",     text: "var(--badge-red-text)",     border: "var(--badge-red-border)" },
};

function TypeBadge({ type }: { type: LeaveType }) {
  const c = TYPE_COLORS[type];
  return (
    <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-semibold border"
      style={{ backgroundColor: c.bg, color: c.text, borderColor: c.border }}>
      {TYPE_LABELS[type]}
    </span>
  );
}

function StatusBadge({ status }: { status: LeaveStatus }) {
  const c = STATUS_COLORS[status];
  return (
    <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-semibold border"
      style={{ backgroundColor: c.bg, color: c.text, borderColor: c.border }}>
      {STATUS_LABELS[status]}
    </span>
  );
}

function formatDate(dateStr: string) {
  return new Date(dateStr).toLocaleDateString("tr-TR", { day: "numeric", month: "short", year: "numeric" });
}

export default function LeavePage() {
  const { data: session } = useSession();
  const isAdmin = session?.user.role === "ADMIN" || (session?.user as any)?.department === "MUHASEBE";

  const [requests, setRequests] = useState<LeaveRequest[]>([]);
  const [balance, setBalance] = useState<LeaveBalance | null>(null);
  const [loading, setLoading] = useState(true);

  // Form
  const [type, setType] = useState<LeaveType>("ANNUAL");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [note, setNote] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [formError, setFormError] = useState("");
  const [success, setSuccess] = useState(false);

  // Admin filter
  const [filterStatus, setFilterStatus] = useState<LeaveStatus | "ALL">("ALL");
  const [filterType, setFilterType] = useState<LeaveType | "ALL">("ALL");

  // Action loading
  const [actioning, setActioning] = useState<string | null>(null);
  const [deleting, setDeleting] = useState<string | null>(null);

  useEffect(() => {
    fetch("/api/leave")
      .then((r) => r.json())
      .then((data) => {
        // Admin/muhasebe: düz array; çalışan: { requests, balance }
        if (Array.isArray(data)) {
          setRequests(data);
        } else {
          setRequests(data.requests ?? []);
          setBalance(data.balance ?? null);
        }
        setLoading(false);
      });
  }, [isAdmin]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setFormError("");
    setSubmitting(true);
    const res = await fetch("/api/leave", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ startDate, endDate, type, note }),
    });
    const data = await res.json();
    if (!res.ok) {
      setFormError(data.error ?? "Bir hata oluştu");
    } else {
      setRequests((r) => [data, ...r]);
      setStartDate(""); setEndDate(""); setNote("");
      setSuccess(true);
      setTimeout(() => setSuccess(false), 3500);
      // Bakiyeyi güncelle
      if (type === "ANNUAL" && !isAdmin) {
        fetch("/api/leave").then((r) => r.json()).then((d) => {
          if (!Array.isArray(d)) setBalance(d.balance ?? null);
        });
      }
    }
    setSubmitting(false);
  }

  async function handleDelete(id: string) {
    if (!confirm("Bu izin talebi silinsin mi?")) return;
    setDeleting(id);
    const res = await fetch(`/api/leave/${id}`, { method: "DELETE" });
    if (res.ok) {
      setRequests((r) => r.filter((x) => x.id !== id));
    }
    setDeleting(null);
  }

  async function handleAction(id: string, status: "APPROVED" | "REJECTED") {
    setActioning(id + status);
    const res = await fetch(`/api/leave/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status }),
    });
    if (res.ok) {
      const updated = await res.json();
      setRequests((r) => r.map((x) => x.id === id ? updated : x));
    }
    setActioning(null);
  }

  const filtered = requests.filter((r) => {
    if (filterStatus !== "ALL" && r.status !== filterStatus) return false;
    if (filterType !== "ALL" && r.type !== filterType) return false;
    return true;
  });

  const pendingCount = requests.filter((r) => r.status === "PENDING").length;
  const today = new Date().toISOString().split("T")[0];

  return (
    <div className="max-w-4xl mx-auto">
      {/* Header */}
      <div className="mb-6 sm:mb-8">
        <h1 className="text-xl sm:text-2xl font-bold text-gray-800">İzin Yönetimi</h1>
        <p className="text-sm text-gray-400 mt-1">
          {isAdmin
            ? `${requests.length} toplam talep · ${pendingCount} bekleyen`
            : "İzin talebinizi oluşturun ve geçmişinizi görüntüleyin"}
        </p>
      </div>

      {/* Employee: Balance card + Form */}
      {!isAdmin && (
        <>
          {/* Balance */}
          <div className="grid grid-cols-3 gap-2 sm:gap-4 mb-6">
            {[
              { label: "Toplam Hak", value: balance?.totalDays ?? 14, colorVar: "var(--badge-indigo-text)" },
              { label: "Kullanılan", value: balance?.usedDays ?? 0,   colorVar: "var(--badge-orange-text)" },
              { label: "Kalan",      value: balance?.remainingDays ?? 14, colorVar: "var(--badge-emerald-text)" },
            ].map((c) => (
              <div key={c.label} className="bg-white rounded-2xl border border-gray-100 shadow-sm p-3 sm:p-5 text-center">
                <p className="text-2xl sm:text-3xl font-bold" style={{ color: c.colorVar }}>{c.value}</p>
                <p className="text-xs text-gray-500 mt-1">{c.label}</p>
                <p className="text-[10px] text-gray-400 hidden sm:block">{new Date().getFullYear()} Yıllık İzin</p>
              </div>
            ))}
          </div>

          {/* Form */}
          <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6 mb-6">
            <h2 className="text-sm font-bold text-gray-700 mb-4">Yeni İzin Talebi</h2>
            <form onSubmit={handleSubmit} className="space-y-4">
              {/* Type */}
              <div>
                <label className="block text-xs font-semibold text-gray-500 mb-2">İzin Türü</label>
                <div className="flex gap-2 flex-wrap">
                  {(["ANNUAL", "EXCUSE", "UNPAID"] as LeaveType[]).map((t) => (
                    <button
                      key={t}
                      type="button"
                      onClick={() => setType(t)}
                      className={clsx(
                        "px-4 py-1.5 rounded-lg text-xs font-semibold border transition-all",
                        type === t
                          ? "border-[#F57C28] bg-[#FFF3E9] text-[#F57C28]"
                          : "border-gray-200 bg-white text-gray-500 hover:border-gray-300"
                      )}
                    >
                      {TYPE_LABELS[t]}
                    </button>
                  ))}
                </div>
              </div>

              {/* Date range */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-gray-500 mb-1.5">Başlangıç</label>
                  <input
                    type="date"
                    value={startDate}
                    min={today}
                    onChange={(e) => setStartDate(e.target.value)}
                    required
                    className="w-full px-3 py-2 text-sm border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-[#F57C28]/30 focus:border-[#F57C28] transition-all"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-gray-500 mb-1.5">Bitiş</label>
                  <input
                    type="date"
                    value={endDate}
                    min={startDate || today}
                    onChange={(e) => setEndDate(e.target.value)}
                    required
                    className="w-full px-3 py-2 text-sm border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-[#F57C28]/30 focus:border-[#F57C28] transition-all"
                  />
                </div>
              </div>

              {/* Note */}
              <div>
                <label className="block text-xs font-semibold text-gray-500 mb-1.5">Açıklama <span className="font-normal text-gray-400">(opsiyonel)</span></label>
                <textarea
                  value={note}
                  onChange={(e) => setNote(e.target.value)}
                  rows={2}
                  placeholder="Varsa açıklama ekleyin..."
                  className="w-full px-3 py-2.5 text-sm border border-gray-200 rounded-xl resize-none focus:outline-none focus:ring-2 focus:ring-[#F57C28]/30 focus:border-[#F57C28] transition-all"
                />
              </div>

              {formError && (
                <div className="flex items-center gap-2 text-red-600 bg-red-50 border border-red-200 rounded-xl px-4 py-2.5 text-sm">
                  <svg className="w-4 h-4 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                  </svg>
                  {formError}
                </div>
              )}

              {success && (
                <div className="flex items-center gap-2 text-emerald-600 bg-emerald-50 border border-emerald-200 rounded-xl px-4 py-2.5 text-sm font-medium">
                  <svg className="w-4 h-4 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                  İzin talebiniz oluşturuldu, onay bekleniyor.
                </div>
              )}

              <div className="flex justify-end">
                <button
                  type="submit"
                  disabled={submitting || !startDate || !endDate}
                  className="inline-flex items-center gap-2 bg-[#F57C28] hover:bg-[#D96A1A] disabled:opacity-50 text-white font-semibold text-sm px-5 py-2 rounded-xl shadow-md shadow-[#F57C28]/25 transition-all hover:-translate-y-0.5 active:translate-y-0"
                >
                  {submitting ? "Gönderiliyor..." : "Talep Oluştur"}
                </button>
              </div>
            </form>
          </div>
        </>
      )}

      {/* List */}
      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm">
        <div className="px-6 py-4 border-b border-gray-100 flex items-center justify-between flex-wrap gap-3">
          <h2 className="text-sm font-bold text-gray-700">
            {isAdmin ? "İzin Talepleri" : "Taleplerim"}
          </h2>
          {isAdmin && (
            <div className="flex items-center gap-2">
              <select
                value={filterType}
                onChange={(e) => setFilterType(e.target.value as LeaveType | "ALL")}
                className="text-xs border border-gray-200 rounded-lg px-2 py-1.5 focus:outline-none focus:ring-1 focus:ring-[#F57C28]/30 text-gray-600"
              >
                <option value="ALL">Tüm Türler</option>
                <option value="ANNUAL">Yıllık İzin</option>
                <option value="EXCUSE">Mazeret İzni</option>
                <option value="UNPAID">Ücretsiz İzin</option>
              </select>
              <select
                value={filterStatus}
                onChange={(e) => setFilterStatus(e.target.value as LeaveStatus | "ALL")}
                className="text-xs border border-gray-200 rounded-lg px-2 py-1.5 focus:outline-none focus:ring-1 focus:ring-[#F57C28]/30 text-gray-600"
              >
                <option value="ALL">Tüm Durumlar</option>
                <option value="PENDING">Bekleyen</option>
                <option value="APPROVED">Onaylandı</option>
                <option value="REJECTED">Reddedildi</option>
              </select>
            </div>
          )}
        </div>

        {loading ? (
          <div className="divide-y divide-gray-50">
            {[...Array(3)].map((_, i) => (
              <div key={i} className="px-6 py-4 animate-pulse flex items-center gap-4">
                <div className="h-4 w-20 bg-gray-100 rounded-full" />
                <div className="h-4 w-32 bg-gray-100 rounded" />
                <div className="h-4 w-16 bg-gray-100 rounded-full ml-auto" />
              </div>
            ))}
          </div>
        ) : filtered.length === 0 ? (
          <div className="px-6 py-12 text-center text-sm text-gray-400">
            {isAdmin ? "Talep bulunamadı." : "Henüz izin talebi oluşturmadınız."}
          </div>
        ) : (
          <ul className="divide-y divide-gray-50">
            {filtered.map((r) => (
              <li key={r.id} className={clsx("px-4 sm:px-6 py-4", isAdmin && r.status === "PENDING" && "bg-orange-50/30")}>
                <div className="flex items-start gap-3 flex-wrap">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1 flex-wrap">
                      {isAdmin && (
                        <span className="text-sm font-semibold text-gray-800">{r.user?.name}</span>
                      )}
                      <TypeBadge type={r.type} />
                      <StatusBadge status={r.status} />
                    </div>
                    <p className="text-sm text-gray-600">
                      {formatDate(r.startDate)}
                      {" — "}
                      {formatDate(r.endDate)}
                      <span className="ml-2 text-gray-400 text-xs">({r.days} iş günü)</span>
                    </p>
                    {r.note && (
                      <p className="text-xs text-gray-400 mt-1 italic">{r.note}</p>
                    )}
                    {r.reviewedBy && r.status !== "PENDING" && (
                      <p className="text-[11px] text-gray-400 mt-0.5">
                        {r.status === "APPROVED" ? "Onaylayan" : "Reddeden"}: {r.reviewedBy}
                      </p>
                    )}
                  </div>

                  <div className="flex items-center gap-2 flex-shrink-0 mt-0.5">
                    <span className="text-xs text-gray-300">
                      {new Date(r.createdAt).toLocaleDateString("tr-TR")}
                    </span>
                    {isAdmin && r.status === "PENDING" && (
                      <>
                        <button
                          onClick={() => handleAction(r.id, "APPROVED")}
                          disabled={actioning !== null}
                          className="px-3 py-1 rounded-lg text-xs font-semibold bg-emerald-50 text-emerald-600 border border-emerald-200 hover:bg-emerald-100 transition-colors disabled:opacity-50"
                        >
                          {actioning === r.id + "APPROVED" ? "..." : "Onayla"}
                        </button>
                        <button
                          onClick={() => handleAction(r.id, "REJECTED")}
                          disabled={actioning !== null}
                          className="px-3 py-1 rounded-lg text-xs font-semibold bg-red-50 text-red-500 border border-red-200 hover:bg-red-100 transition-colors disabled:opacity-50"
                        >
                          {actioning === r.id + "REJECTED" ? "..." : "Reddet"}
                        </button>
                      </>
                    )}
                    {isAdmin && (
                      <button
                        onClick={() => handleDelete(r.id)}
                        disabled={deleting === r.id}
                        className="px-3 py-1 rounded-lg text-xs font-semibold bg-gray-50 text-gray-400 border border-gray-200 hover:bg-red-50 hover:text-red-500 hover:border-red-200 transition-colors disabled:opacity-50"
                      >
                        {deleting === r.id ? "..." : "Sil"}
                      </button>
                    )}
                  </div>
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
