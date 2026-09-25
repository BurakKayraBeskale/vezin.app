"use client";

import { useCallback, useEffect, useState } from "react";
import LeaveBreakdownDrawer from "./LeaveBreakdownDrawer";
import { LeaveBreakdown, TeamMemberSummary } from "./types";
import { gunMetni } from "@/lib/leave";

interface Props {
  currentUserId: string;
  currentUserRole: string;
  currentUserEmail: string | null;
  /** getLeaveOverviewScope(user) !== null — server'da hesaplanır. */
  hasOverviewAccess: boolean;
  /** Bildirimden gelindiyse — bu talebin sahibinin dökümü otomatik açılır. */
  initialRequestId?: string;
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

/** Kalan bakiye rengi — eksi bakiye kırmızı (engellenmez, yalnızca uyarı). */
function kalanRenk(kalan: number | null) {
  return kalan !== null && kalan < 0 ? "text-red-600" : "text-emerald-600";
}

/**
 * /izin-durumu — TÜM aktif kullanıcılar kendi özetini görür (üstte); alttaki
 * personel listesi yalnızca getLeaveOverviewScope kapsamındakilere render
 * edilir (backend zaten 404 döndürür — burada ayrıca kontrol frontend
 * gizlemesi için, gerçek sınır API'de).
 */
export default function LeaveOverviewScreen({ currentUserId, currentUserRole, currentUserEmail, hasOverviewAccess, initialRequestId }: Props) {
  const currentYear = new Date().getFullYear();
  const [myOverview, setMyOverview] = useState<LeaveBreakdown | null>(null);

  const [teamData, setTeamData] = useState<TeamMemberSummary[] | null>(null);
  const [selectedPersonId, setSelectedPersonId] = useState<string | null>(null);
  const [drawerYear, setDrawerYear] = useState(currentYear);

  // Bildirimden ?requestId= ile gelindiyse — talebin sahibini bul ve dökümünü aç.
  useEffect(() => {
    if (!initialRequestId || !hasOverviewAccess) return;
    fetch(`/api/leave/${initialRequestId}`)
      .then((r) => (r.ok ? r.json() : null))
      .then((req) => {
        if (!req?.user?.id) return;
        setSelectedPersonId(req.user.id);
        setDrawerYear(new Date(req.startDate).getFullYear());
      })
      .catch(() => {});
  }, [initialRequestId, hasOverviewAccess]);

  useEffect(() => {
    fetch(`/api/leave/team/${currentUserId}?year=${currentYear}`)
      .then((r) => (r.ok ? r.json() : null))
      .then(setMyOverview)
      .catch(() => setMyOverview(null));
  }, [currentUserId, currentYear]);

  const loadTeam = useCallback(() => {
    if (!hasOverviewAccess) return;
    fetch("/api/leave/team")
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => setTeamData(d?.users ?? []))
      .catch(() => setTeamData([]));
  }, [hasOverviewAccess]);

  useEffect(() => { loadTeam(); }, [loadTeam]);

  return (
    <>
      <div className="mb-6 sm:mb-8">
        <h1 className="text-xl sm:text-2xl font-bold text-gray-800">Personel İzin Durumu</h1>
        <p className="text-sm text-gray-400 mt-1">İzin hakkınızı ve (yetkiniz varsa) personelin izin durumunu görüntüleyin</p>
      </div>

      {/* Kendi özetim — herkes görür */}
      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6 mb-8">
        <h2 className="text-sm font-bold text-gray-700 mb-4">Benim İzin Durumum</h2>
        {myOverview === null ? (
          <div className="grid grid-cols-2 sm:grid-cols-5 gap-3 animate-pulse">
            {[...Array(5)].map((_, i) => <div key={i} className="h-16 bg-gray-100 rounded-xl" />)}
          </div>
        ) : myOverview.mesaj ? (
          <p className="text-sm text-gray-400 italic">{myOverview.mesaj}</p>
        ) : (
          <>
            <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
              {[
                { label: "İşe Giriş Tarihi", value: myOverview.user.hireDate ? formatDate(myOverview.user.hireDate) : "—", color: "text-gray-800" },
                { label: "Hizmet Süresi", value: myOverview.hizmetSuresiMetni, color: "text-gray-800" },
                { label: "Toplam Hak Edilen", value: myOverview.toplamHakEdilenGun !== null ? gunMetni(myOverview.toplamHakEdilenGun) : "—", color: "text-gray-800" },
                { label: "Kullanılan", value: gunMetni(myOverview.kullanilanGun), color: "text-[#F57C28]" },
                { label: "Kalan", value: myOverview.kalanGun !== null ? gunMetni(myOverview.kalanGun) : "—", color: kalanRenk(myOverview.kalanGun) },
              ].map((c) => (
                <div key={c.label} className="bg-gray-50 rounded-xl p-3 text-center">
                  <p className={`text-base font-bold ${c.color}`}>{c.value}</p>
                  <p className="text-[11px] text-gray-400 mt-0.5">{c.label}</p>
                </div>
              ))}
            </div>
            <p className="text-xs text-gray-400 mt-3">
              Devreden kullanım: {gunMetni(myOverview.devirKullanilanGun)} · Uygulama üzerinden: {gunMetni(myOverview.uygulamaKullanilanGun)}
            </p>
          </>
        )}
      </div>

      {/* Personel listesi — yalnızca getLeaveOverviewScope kapsamındakiler */}
      {hasOverviewAccess && (
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm">
          <div className="px-6 py-4 border-b border-gray-100">
            <h2 className="text-sm font-bold text-gray-700">Personel Listesi</h2>
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
                    <th className="px-3 py-2.5">İşe Giriş Tarihi</th>
                    <th className="px-3 py-2.5">Hizmet Süresi</th>
                    <th className="px-3 py-2.5">Toplam Hak Edilen</th>
                    <th className="px-3 py-2.5">Kullanılan</th>
                    <th className="px-3 py-2.5">Kalan</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-50">
                  {teamData.map((m) => (
                    <tr key={m.id} className="hover:bg-gray-50/50 transition-colors">
                      <td className="px-6 py-3">
                        <button
                          onClick={() => { setDrawerYear(currentYear); setSelectedPersonId(m.id); }}
                          className="font-medium text-gray-800 hover:text-[#F57C28] transition-colors text-left"
                        >
                          {m.name}
                        </button>
                      </td>
                      <td className="px-3 py-3 text-gray-500 text-xs">{DEPT_LABELS[m.department] ?? m.department}</td>
                      <td className="px-3 py-3 text-gray-500 text-xs font-mono">
                        {m.hireDate ? formatDate(m.hireDate) : <span className="italic text-gray-300">girilmemiş</span>}
                      </td>
                      <td className="px-3 py-3 text-gray-600 text-xs">{m.hizmetSuresiMetni}</td>
                      <td className="px-3 py-3 text-gray-600 text-xs">{m.toplamHakEdilenGun !== null ? gunMetni(m.toplamHakEdilenGun) : "—"}</td>
                      <td
                        className="px-3 py-3 text-[#F57C28] text-xs font-semibold"
                        title={`Devreden kullanım: ${gunMetni(m.devirKullanilanGun)} · Uygulama üzerinden: ${gunMetni(m.uygulamaKullanilanGun)}`}
                      >
                        {gunMetni(m.kullanilanGun)}
                      </td>
                      <td className={`px-3 py-3 text-xs font-semibold ${kalanRenk(m.kalanGun)}`}>{m.kalanGun !== null ? gunMetni(m.kalanGun) : "—"}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {selectedPersonId && (
        <LeaveBreakdownDrawer
          personId={selectedPersonId}
          initialYear={drawerYear}
          currentUser={{ id: currentUserId, role: currentUserRole, email: currentUserEmail }}
          onClose={() => setSelectedPersonId(null)}
          onChanged={loadTeam}
        />
      )}
    </>
  );
}
