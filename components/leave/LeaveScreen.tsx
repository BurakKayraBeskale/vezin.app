"use client";

import { useCallback, useEffect, useState } from "react";
import { LeaveTypeBadge, LeaveStatusBadge } from "./badges";
import NewLeaveRequestModal from "./NewLeaveRequestModal";
import LeaveBreakdownDrawer from "./LeaveBreakdownDrawer";
import { LeaveRequestRecord, TeamMemberSummary } from "./types";

interface Props {
  isApprover: boolean;
  currentUserId: string;
  currentUserRole: string;
  currentUserEmail: string | null;
}

function formatDate(d: string) {
  return new Date(d).toLocaleDateString("tr-TR", { day: "numeric", month: "short", year: "numeric" });
}

const DEPT_LABELS: Record<string, string> = {
  OUTSOURCE: "Outsource",
  BAGIMSIZ_DENETIM: "Bağımsız Denetim",
  MUHASEBE: "Muhasebe",
  YEMINLI_MALI_MUSAVIR: "YMM",
  IDARI_ISLER: "İdari İşler",
  ADMIN: "Yönetim",
};

export default function LeaveScreen({ isApprover, currentUserId, currentUserRole, currentUserEmail }: Props) {
  const [myRequests, setMyRequests] = useState<LeaveRequestRecord[] | null>(null);
  const [showNewRequest, setShowNewRequest] = useState(false);
  const [cancellingId, setCancellingId] = useState<string | null>(null);
  const [toast, setToast] = useState<string | null>(null);

  const [teamYear, setTeamYear] = useState(() => new Date().getFullYear());
  const [teamData, setTeamData] = useState<TeamMemberSummary[] | null>(null);
  const [selectedPersonId, setSelectedPersonId] = useState<string | null>(null);

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

  const loadTeam = useCallback(() => {
    if (!isApprover) return;
    fetch(`/api/leave/team?year=${teamYear}`)
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => setTeamData(d?.users ?? []))
      .catch(() => setTeamData([]));
  }, [isApprover, teamYear]);

  useEffect(() => { loadMyRequests(); }, [loadMyRequests]);
  useEffect(() => { loadTeam(); }, [loadTeam]);

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

  const years = Array.from({ length: 5 }, (_, i) => new Date().getFullYear() - 2 + i);

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

      {/* ── a) Taleplerim ──────────────────────────────────────────────── */}
      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm mb-8">
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
              <li key={r.id} className="px-4 sm:px-6 py-4">
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

      {/* ── b) Personel İzin Durumu — yalnızca onaylayıcılar ve ADMIN ──── */}
      {isApprover && (
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm">
          <div className="px-6 py-4 border-b border-gray-100 flex items-center justify-between flex-wrap gap-3">
            <h2 className="text-sm font-bold text-gray-700">Personel İzin Durumu</h2>
            <select
              value={teamYear}
              onChange={(e) => setTeamYear(Number(e.target.value))}
              className="text-xs border border-gray-200 rounded-lg px-2 py-1.5 bg-white text-gray-600 focus:outline-none focus:ring-1 focus:ring-[#F57C28]/30"
            >
              {years.map((y) => <option key={y} value={y}>{y}</option>)}
            </select>
          </div>

          {teamData === null ? (
            <div className="px-6 py-8 text-center text-sm text-gray-400">Yükleniyor...</div>
          ) : teamData.length === 0 ? (
            <div className="px-6 py-12 text-center text-sm text-gray-400">Kapsamınızda personel bulunamadı.</div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-left text-[11px] font-semibold text-gray-400 uppercase tracking-wide">
                    <th className="px-6 py-2.5">Ad</th>
                    <th className="px-3 py-2.5">Departman</th>
                    <th className="px-3 py-2.5">İşe Giriş</th>
                    <th className="px-3 py-2.5">Hizmet Yılı</th>
                    <th className="px-3 py-2.5">Hak Edilen</th>
                    <th className="px-3 py-2.5">Kullanılan ({teamYear})</th>
                    <th className="px-3 py-2.5">Kalan</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-50">
                  {teamData.map((m) => (
                    <tr key={m.id} className="hover:bg-gray-50/50 transition-colors">
                      <td className="px-6 py-3">
                        <button
                          onClick={() => setSelectedPersonId(m.id)}
                          className="font-medium text-gray-800 hover:text-[#F57C28] transition-colors text-left"
                        >
                          {m.name}
                        </button>
                      </td>
                      <td className="px-3 py-3 text-gray-500 text-xs">{DEPT_LABELS[m.department] ?? m.department}</td>
                      <td className="px-3 py-3 text-gray-500 text-xs font-mono">
                        {m.hireDate ? formatDate(m.hireDate) : <span className="italic text-gray-300">girilmemiş</span>}
                      </td>
                      <td className="px-3 py-3 text-gray-600 text-xs">{m.hizmetYili !== null ? `${m.hizmetYili} yıl` : "—"}</td>
                      <td className="px-3 py-3 text-gray-600 text-xs">{m.hakEdilenGun !== null ? `${m.hakEdilenGun} gün` : "—"}</td>
                      <td className="px-3 py-3 text-[#F57C28] text-xs font-semibold">{m.kullanilanGun} gün</td>
                      <td className="px-3 py-3 text-emerald-600 text-xs font-semibold">{m.kalanGun !== null ? `${m.kalanGun} gün` : "—"}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {showNewRequest && (
        <NewLeaveRequestModal onClose={() => setShowNewRequest(false)} onCreated={handleCreated} />
      )}

      {selectedPersonId && (
        <LeaveBreakdownDrawer
          personId={selectedPersonId}
          currentUser={{ id: currentUserId, role: currentUserRole, email: currentUserEmail }}
          onClose={() => setSelectedPersonId(null)}
          onChanged={() => { loadTeam(); loadMyRequests(); }}
        />
      )}
    </>
  );
}
