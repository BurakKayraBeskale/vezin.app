"use client";

import { useEffect, useState } from "react";
import { canApproveLeave } from "@/lib/access";
import { LeaveTypeBadge, LeaveStatusBadge } from "./badges";
import { LeaveBreakdown, LeaveRequestRecord } from "./types";

interface Props {
  personId: string;
  currentUser: { id: string; role: string; email: string | null };
  onClose: () => void;
  /** Bir talep onaylanır/reddedilirse üst listenin (Personel İzin Durumu) yenilenmesi için. */
  onChanged: () => void;
  /** Bildirimden gelindiyse — talebin ait olduğu yıl (varsayılan: içinde bulunulan yıl). */
  initialYear?: number;
}

function formatDate(d: string) {
  return new Date(d).toLocaleDateString("tr-TR", { day: "numeric", month: "short", year: "numeric" });
}

function bytesToLabel(size: number | null) {
  if (!size) return "";
  if (size < 1024) return `${size} B`;
  if (size < 1024 * 1024) return `${(size / 1024).toFixed(0)} KB`;
  return `${(size / (1024 * 1024)).toFixed(1)} MB`;
}

export default function LeaveBreakdownDrawer({ personId, currentUser, onClose, onChanged, initialYear }: Props) {
  const [year, setYear] = useState(() => initialYear ?? new Date().getFullYear());
  const [data, setData] = useState<LeaveBreakdown | null>(null);
  const [loading, setLoading] = useState(true);
  const [actioningId, setActioningId] = useState<string | null>(null);
  const [rejectingId, setRejectingId] = useState<string | null>(null);
  const [rejectNote, setRejectNote] = useState("");
  const [actionError, setActionError] = useState("");

  useEffect(() => {
    setLoading(true);
    fetch(`/api/leave/team/${personId}?year=${year}`)
      .then((r) => (r.ok ? r.json() : null))
      .then(setData)
      .finally(() => setLoading(false));
  }, [personId, year]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function handleAction(req: LeaveRequestRecord, action: "approve" | "reject") {
    setActionError("");
    if (action === "reject" && !rejectNote.trim()) {
      setActionError("Reddetme gerekçesi zorunludur");
      return;
    }
    setActioningId(req.id + action);
    try {
      const res = await fetch(`/api/leave/${req.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action, reviewNote: action === "reject" ? rejectNote.trim() : undefined }),
      });
      const updated = await res.json();
      if (!res.ok) {
        setActionError(updated.error || "İşlem başarısız");
        return;
      }
      setData((prev) => prev ? { ...prev, requests: prev.requests.map((r) => (r.id === updated.id ? updated : r)) } : prev);
      setRejectingId(null);
      setRejectNote("");
      onChanged();
    } catch {
      setActionError("Sunucu hatası");
    } finally {
      setActioningId(null);
    }
  }

  const years = Array.from({ length: 5 }, (_, i) => new Date().getFullYear() - 2 + i);

  return (
    <div className="fixed inset-0 z-50 flex justify-end" role="dialog" aria-modal="true">
      <div className="absolute inset-0 bg-black/30" onClick={onClose} />
      <div className="relative z-10 w-full max-w-xl bg-white h-full overflow-y-auto shadow-2xl flex flex-col">
        <div className="flex items-center justify-between p-5 border-b border-gray-100 shrink-0">
          <div>
            <h3 className="font-bold text-gray-800">{data?.user.name ?? "…"}</h3>
            {data?.user.hireDate ? (
              <p className="text-xs text-gray-400 mt-0.5">İşe giriş: {formatDate(data.user.hireDate)}</p>
            ) : data && (
              <p className="text-xs text-gray-400 mt-0.5 italic">İşe giriş tarihi girilmemiş</p>
            )}
          </div>
          <button onClick={onClose} className="p-2 rounded-lg hover:bg-gray-100 text-gray-500 transition-colors" aria-label="Kapat">
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Yıl filtresi */}
        <div className="flex items-center gap-2 px-5 py-3 border-b border-gray-100 bg-gray-50 shrink-0">
          <span className="text-xs text-gray-500">Yıl:</span>
          <select
            value={year}
            onChange={(e) => setYear(Number(e.target.value))}
            className="text-xs border border-gray-200 rounded-lg px-2 py-1 bg-white text-gray-700 focus:outline-none focus:ring-1 focus:ring-[#F57C28]/40"
          >
            {years.map((y) => <option key={y} value={y}>{y}</option>)}
          </select>
        </div>

        <div className="flex-1 p-5 space-y-5">
          {loading && (
            <div className="space-y-2 animate-pulse">
              {[...Array(3)].map((_, i) => <div key={i} className="h-10 bg-gray-100 rounded-lg" />)}
            </div>
          )}

          {!loading && !data && (
            <p className="text-sm text-gray-400 italic">Döküm yüklenemedi.</p>
          )}

          {!loading && data && (
            <>
              {/* Hak özeti */}
              <div className="p-4 bg-gray-50 rounded-xl space-y-1.5">
                {data.mesaj ? (
                  <p className="text-sm text-gray-400 italic">{data.mesaj}</p>
                ) : (
                  <>
                    <div className="flex items-center justify-between text-sm">
                      <span className="text-gray-500">Hizmet Süresi</span>
                      <span className="font-semibold text-gray-800">{data.hizmetSuresiMetni}</span>
                    </div>
                    <div className="flex items-center justify-between text-sm">
                      <span className="text-gray-500">Hak Edilen (Yıllık)</span>
                      <span className="font-semibold text-gray-800">{data.hakEdilenGun} gün</span>
                    </div>
                    <div className="flex items-center justify-between text-sm">
                      <span className="text-gray-500">{data.year} — Kullanılan</span>
                      <span className="font-semibold text-[#F57C28]">{data.kullanilanGun} gün</span>
                    </div>
                    <div className="flex items-center justify-between text-sm">
                      <span className="text-gray-500">Kalan</span>
                      <span className="font-semibold text-emerald-600">{data.kalanGun} gün</span>
                    </div>
                  </>
                )}
              </div>

              {actionError && (
                <div className="bg-red-50 border border-red-200 text-red-600 text-xs rounded-xl px-3 py-2">{actionError}</div>
              )}

              {/* İzin geçmişi */}
              <div>
                <h4 className="text-[11px] font-semibold text-gray-400 uppercase tracking-wide mb-2">
                  {data.year} İzin Geçmişi
                </h4>
                {data.requests.length === 0 ? (
                  <p className="text-sm text-gray-400 italic">Bu yıl için kayıt yok.</p>
                ) : (
                  <ul className="space-y-2">
                    {data.requests.map((r) => {
                      const canApprove = canApproveLeave(currentUser, { userId: r.userId, userDepartment: data.user.department })
                        && r.status === "PENDING";
                      return (
                        <li key={r.id} className="border border-gray-100 rounded-xl p-3">
                          <div className="flex items-center gap-2 flex-wrap mb-1">
                            <LeaveTypeBadge type={r.type} />
                            <LeaveStatusBadge status={r.status} />
                            <span className="text-xs text-gray-400 ml-auto">{r.days} iş günü</span>
                          </div>
                          <p className="text-sm text-gray-700">{formatDate(r.startDate)} — {formatDate(r.endDate)}</p>
                          {r.note && <p className="text-xs text-gray-400 mt-1 italic">{r.note}</p>}
                          {r.status !== "PENDING" && r.reviewedBy && (
                            <p className="text-[11px] text-gray-400 mt-1">
                              {r.status === "APPROVED" ? "Onaylayan" : r.status === "REJECTED" ? "Reddeden" : "İşlem yapan"}: {r.reviewedBy}
                              {r.reviewedAt && ` · ${formatDate(r.reviewedAt)}`}
                            </p>
                          )}
                          {r.reviewNote && (
                            <p className="text-[11px] text-gray-500 mt-1 bg-gray-50 rounded-lg px-2 py-1">Gerekçe: {r.reviewNote}</p>
                          )}
                          {r.attachments.length > 0 && (
                            <div className="mt-2 flex flex-wrap gap-1.5">
                              {r.attachments.map((a) => (
                                <a
                                  key={a.id}
                                  href={`/api/leave/${r.id}/attachments/${a.id}/download`}
                                  className="inline-flex items-center gap-1 text-[11px] px-2 py-1 rounded-lg bg-gray-50 text-gray-600 hover:bg-gray-100 transition-colors border border-gray-100"
                                >
                                  <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
                                    <path strokeLinecap="round" strokeLinejoin="round" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-8-4V4m0 12l-4-4m4 4l4-4" />
                                  </svg>
                                  {a.name} {a.size ? `(${bytesToLabel(a.size)})` : ""}
                                </a>
                              ))}
                            </div>
                          )}

                          {canApprove && (
                            <div className="mt-2.5 pt-2.5 border-t border-gray-100">
                              {rejectingId === r.id ? (
                                <div className="space-y-2">
                                  <textarea
                                    value={rejectNote}
                                    onChange={(e) => setRejectNote(e.target.value)}
                                    rows={2}
                                    placeholder="Reddetme gerekçesi (zorunlu)..."
                                    className="w-full px-2.5 py-2 text-xs border border-gray-200 rounded-lg resize-none focus:outline-none focus:ring-1 focus:ring-red-300"
                                  />
                                  <div className="flex gap-2">
                                    <button
                                      onClick={() => handleAction(r, "reject")}
                                      disabled={actioningId === r.id + "reject"}
                                      className="flex-1 text-xs font-semibold px-3 py-1.5 rounded-lg bg-red-500 text-white hover:bg-red-600 disabled:opacity-60 transition-colors"
                                    >
                                      {actioningId === r.id + "reject" ? "..." : "Reddi Onayla"}
                                    </button>
                                    <button
                                      onClick={() => { setRejectingId(null); setRejectNote(""); }}
                                      className="flex-1 text-xs font-semibold px-3 py-1.5 rounded-lg border border-gray-200 text-gray-500 hover:bg-gray-50 transition-colors"
                                    >
                                      Vazgeç
                                    </button>
                                  </div>
                                </div>
                              ) : (
                                <div className="flex gap-2">
                                  <button
                                    onClick={() => handleAction(r, "approve")}
                                    disabled={actioningId !== null}
                                    className="flex-1 text-xs font-semibold px-3 py-1.5 rounded-lg bg-emerald-500 text-white hover:bg-emerald-600 disabled:opacity-60 transition-colors"
                                  >
                                    {actioningId === r.id + "approve" ? "..." : "Onayla"}
                                  </button>
                                  <button
                                    onClick={() => setRejectingId(r.id)}
                                    disabled={actioningId !== null}
                                    className="flex-1 text-xs font-semibold px-3 py-1.5 rounded-lg border border-red-200 text-red-500 hover:bg-red-50 disabled:opacity-60 transition-colors"
                                  >
                                    Reddet
                                  </button>
                                </div>
                              )}
                            </div>
                          )}
                        </li>
                      );
                    })}
                  </ul>
                )}
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
