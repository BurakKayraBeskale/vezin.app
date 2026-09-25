"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { LeaveTypeBadge, LeaveStatusBadge } from "./badges";
import NewLeaveRequestModal from "./NewLeaveRequestModal";
import { LeaveRequestRecord } from "./types";

function formatDate(d: string) {
  return new Date(d).toLocaleDateString("tr-TR", { day: "numeric", month: "short", year: "numeric" });
}

interface Props {
  /** Bildirimden gelindiyse — bu talep listede vurgulanır ve görünüme kaydırılır. */
  highlightId?: string;
}

/**
 * /leave — yalnızca "Taleplerim" + yeni talep oluşturma. "Personel İzin
 * Durumu" (personel listesi + kişi bazlı döküm) artık ayrı sayfada:
 * /izin-durumu (bkz. components/leave/LeaveOverviewScreen.tsx).
 */
export default function LeaveScreen({ highlightId }: Props) {
  const [myRequests, setMyRequests] = useState<LeaveRequestRecord[] | null>(null);
  const [showNewRequest, setShowNewRequest] = useState(false);
  const [cancellingId, setCancellingId] = useState<string | null>(null);
  const [toast, setToast] = useState<string | null>(null);
  const highlightRef = useRef<HTMLLIElement | null>(null);

  useEffect(() => {
    if (highlightId && myRequests?.some((r) => r.id === highlightId)) {
      highlightRef.current?.scrollIntoView({ behavior: "smooth", block: "center" });
    }
  }, [highlightId, myRequests]);

  function showToast(msg: string) {
    setToast(msg);
    setTimeout(() => setToast(null), 2500);
  }

  const loadMyRequests = useCallback(() => {
    fetch("/api/leave")
      .then((r) => (r.ok ? r.json() : []))
      .then(setMyRequests)
      .catch(() => setMyRequests([]));
  }, []);

  useEffect(() => { loadMyRequests(); }, [loadMyRequests]);

  function handleCreated(created: LeaveRequestRecord) {
    setMyRequests((prev) => [created, ...(prev ?? [])]);
    setShowNewRequest(false);
    showToast("İzin talebiniz oluşturuldu, onay bekleniyor.");
  }

  async function handleCancel(id: string) {
    if (!confirm("Bu izin talebini iptal etmek istediğinize emin misiniz?")) return;
    setCancellingId(id);
    try {
      const res = await fetch(`/api/leave/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "cancel" }),
      });
      if (res.ok) {
        const updated = await res.json();
        setMyRequests((prev) => (prev ?? []).map((r) => (r.id === id ? updated : r)));
        showToast("Talep iptal edildi.");
      }
    } finally {
      setCancellingId(null);
    }
  }

  return (
    <>
      {toast && (
        <div className="fixed bottom-6 right-6 z-50 flex items-center gap-2 bg-gray-900 text-white text-sm font-medium px-4 py-2.5 rounded-xl shadow-xl">
          <svg className="w-4 h-4 text-emerald-400 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2.5}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
          </svg>
          {toast}
        </div>
      )}

      <div className="mb-6 sm:mb-8">
        <h1 className="text-xl sm:text-2xl font-bold text-gray-800">İzin Yönetimi</h1>
        <p className="text-sm text-gray-400 mt-1">İzin talebinizi oluşturun ve geçmişinizi görüntüleyin</p>
      </div>

      {/* Taleplerim */}
      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm">
        <div className="px-6 py-4 border-b border-gray-100 flex items-center justify-between flex-wrap gap-3">
          <h2 className="text-sm font-bold text-gray-700">Taleplerim</h2>
          <button
            onClick={() => setShowNewRequest(true)}
            className="flex items-center gap-1.5 text-xs bg-[#F57C28] hover:bg-[#D96A1A] text-white font-semibold px-3 py-2 rounded-xl transition-colors shadow-md shadow-[#F57C28]/25"
          >
            <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
            </svg>
            Yeni Talep
          </button>
        </div>

        {myRequests === null ? (
          <div className="divide-y divide-gray-50">
            {[...Array(2)].map((_, i) => (
              <div key={i} className="px-6 py-4 animate-pulse flex items-center gap-4">
                <div className="h-4 w-20 bg-gray-100 rounded-full" />
                <div className="h-4 w-32 bg-gray-100 rounded" />
              </div>
            ))}
          </div>
        ) : myRequests.length === 0 ? (
          <div className="px-6 py-12 text-center text-sm text-gray-400">Henüz izin talebi oluşturmadınız.</div>
        ) : (
          <ul className="divide-y divide-gray-50">
            {myRequests.map((r) => (
              <li
                key={r.id}
                ref={r.id === highlightId ? highlightRef : undefined}
                className={
                  r.id === highlightId
                    ? "px-4 sm:px-6 py-4 bg-orange-50 ring-1 ring-inset ring-[#F57C28]/40"
                    : "px-4 sm:px-6 py-4"
                }
              >
                <div className="flex items-start gap-3 flex-wrap">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1 flex-wrap">
                      <LeaveTypeBadge type={r.type} />
                      <LeaveStatusBadge status={r.status} />
                    </div>
                    <p className="text-sm text-gray-600">
                      {formatDate(r.startDate)} — {formatDate(r.endDate)}
                      <span className="ml-2 text-gray-400 text-xs">({r.days} iş günü)</span>
                    </p>
                    {r.note && <p className="text-xs text-gray-400 mt-1 italic">{r.note}</p>}
                    {r.status !== "PENDING" && r.reviewedBy && (
                      <p className="text-[11px] text-gray-400 mt-0.5">
                        {r.status === "APPROVED" ? "Onaylayan" : r.status === "REJECTED" ? "Reddeden" : "İşlem yapan"}: {r.reviewedBy}
                      </p>
                    )}
                    {r.reviewNote && (
                      <p className="text-[11px] text-gray-500 mt-1 bg-gray-50 rounded-lg px-2 py-1 w-fit">Gerekçe: {r.reviewNote}</p>
                    )}
                  </div>
                  <div className="flex items-center gap-2 flex-shrink-0 mt-0.5">
                    <span className="text-xs text-gray-300">{formatDate(r.createdAt)}</span>
                    {r.status === "PENDING" && (
                      <button
                        onClick={() => handleCancel(r.id)}
                        disabled={cancellingId === r.id}
                        className="px-3 py-1 rounded-lg text-xs font-semibold bg-gray-50 text-gray-400 border border-gray-200 hover:bg-red-50 hover:text-red-500 hover:border-red-200 transition-colors disabled:opacity-50"
                      >
                        {cancellingId === r.id ? "..." : "İptal Et"}
                      </button>
                    )}
                  </div>
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>

      {showNewRequest && (
        <NewLeaveRequestModal onClose={() => setShowNewRequest(false)} onCreated={handleCreated} />
      )}
    </>
  );
}
