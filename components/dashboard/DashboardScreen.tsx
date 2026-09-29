"use client";

/**
 * Dashboard — çalışma kontrol merkezi (A bloğu).
 *
 * TEK master state: selectedDashboardUser. KPI, Bekleyen İşlemler, Bugün &
 * Yaklaşan, Görev Dağılımı, Öne Çıkan Projeler ve finansal özet aynı kişiden
 * ve tek istekten (/api/dashboard?userId=) gelir — bölümler arasında kişi
 * ayrışması olamaz.
 *
 * Kişi değişiminde eski kişinin verisi HEMEN kaldırılır (skeleton); hızlı
 * geçişlerde (Ahmet → Mehmet → Ayşe) önceki istek iptal edilir ve sıra
 * numarası tutmayan yanıt yok sayılır — eski yanıt yeni kişinin üzerine yazamaz.
 *
 * Seçim ?person= ile adres çubuğuna yansıtılır (geri tuşu aynı kişiye döner);
 * Dashboard menüden açıldığında parametre yoktur → kullanıcının kendisi.
 */

import { useCallback, useEffect, useRef, useState } from "react";
import TaskDetail from "@/components/TaskDetail";
import PersonSelector from "./PersonSelector";
import {
  CalendarPlaceholder,
  DashboardSkeleton,
  FeaturedProjects,
  FinanceSummary,
  KpiCards,
  PendingActions,
  TaskDistribution,
  UpcomingTasks,
} from "./DashboardSections";
import type { DashboardPersonDTO, DashboardSummaryDTO } from "./types";

const todayLabel = () =>
  new Date().toLocaleDateString("tr-TR", { weekday: "long", year: "numeric", month: "long", day: "numeric" });

export default function DashboardScreen({
  currentUser,
  initialPersonId,
  isAdmin,
}: {
  currentUser: { id: string; name: string };
  initialPersonId?: string;
  isAdmin: boolean;
}) {
  const [people, setPeople] = useState<DashboardPersonDTO[]>([
    { id: currentUser.id, name: currentUser.name, title: "", department: "" },
  ]);
  const [selectedDashboardUser, setSelectedDashboardUser] = useState<string>(initialPersonId || currentUser.id);
  const [data, setData] = useState<DashboardSummaryDTO | null>(null);
  const [error, setError] = useState("");
  const [openTaskId, setOpenTaskId] = useState<string | null>(null);

  const requestSeq = useRef(0);
  const inflight = useRef<AbortController | null>(null);

  /** silent=true → mevcut veri ekranda kalır (görev güncellemesi sonrası arka plan tazeleme). */
  const load = useCallback(async (personId: string, silent: boolean) => {
    inflight.current?.abort();
    const controller = new AbortController();
    inflight.current = controller;
    const seq = ++requestSeq.current;
    if (!silent) setData(null);
    setError("");
    try {
      const res = await fetch(`/api/dashboard?userId=${encodeURIComponent(personId)}`, { signal: controller.signal });
      const body = await res.json().catch(() => null);
      if (seq !== requestSeq.current) return;
      if (!res.ok) {
        setError(body?.error ?? "Dashboard yüklenemedi");
        if (res.status === 404 && personId !== currentUser.id) setSelectedDashboardUser(currentUser.id);
        return;
      }
      setData(body);
    } catch (e) {
      if ((e as Error).name === "AbortError") return;
      if (seq === requestSeq.current) setError("Sunucuya ulaşılamadı");
    }
  }, [currentUser.id]);

  useEffect(() => {
    load(selectedDashboardUser, false);
    try {
      const url = selectedDashboardUser === currentUser.id ? "/" : `/?person=${encodeURIComponent(selectedDashboardUser)}`;
      window.history.replaceState(window.history.state, "", url);
    } catch {
      /* yok say */
    }
  }, [selectedDashboardUser, currentUser.id, load]);

  useEffect(() => {
    fetch("/api/dashboard/people")
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => d?.people && setPeople(d.people))
      .catch(() => {});
    // Mevcut davranış: tekrarlayan görevler Dashboard açılışında işlenir
    fetch("/api/tasks/process-recurring", { method: "POST" }).catch(() => {});
    return () => inflight.current?.abort();
  }, []);

  // Başka sekmede/modülde yapılan işlemler (izin/harcama onayı vb.) dönüşte yansısın
  useEffect(() => {
    function onVisible() {
      if (document.visibilityState === "visible") load(selectedDashboardUser, true);
    }
    document.addEventListener("visibilitychange", onVisible);
    return () => document.removeEventListener("visibilitychange", onVisible);
  }, [selectedDashboardUser, load]);

  const viewingOther = selectedDashboardUser !== currentUser.id;
  const selectedName = people.find((p) => p.id === selectedDashboardUser)?.name ?? data?.person.name ?? "";
  const shown = data && data.person.id === selectedDashboardUser ? data : null;

  return (
    <div className="max-w-7xl mx-auto">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-4 mb-5">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold text-gray-800">Dashboard</h1>
          <p className="text-sm text-gray-400 mt-1 capitalize">{todayLabel()}</p>
        </div>
        <PersonSelector
          people={people}
          selectedId={selectedDashboardUser}
          currentUserId={currentUser.id}
          onSelect={setSelectedDashboardUser}
        />
      </div>

      {viewingOther && (
        <div className="mb-4 flex items-center justify-between gap-3 rounded-xl border border-indigo-200 bg-indigo-50 px-4 py-2.5 text-sm">
          <span className="text-indigo-700">
            <strong>{selectedName}</strong> Dashboard&apos;u görüntüleniyor — yalnız sizin görebildiğiniz kayıtlar sayılır.
          </span>
          <button type="button" onClick={() => setSelectedDashboardUser(currentUser.id)} className="text-xs font-semibold text-indigo-700 hover:underline flex-shrink-0">
            Kendi Dashboard&apos;uma dön
          </button>
        </div>
      )}

      {error && (
        <div className="mb-4 bg-red-50 border border-red-200 text-red-600 text-sm rounded-xl px-4 py-2.5">{error}</div>
      )}

      {!shown ? (
        !error && <DashboardSkeleton />
      ) : (
        <div className="space-y-4">
          <KpiCards data={shown} />

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 items-start">
            <UpcomingTasks data={shown} onOpenTask={setOpenTaskId} />
            <div className="space-y-4">
              <PendingActions data={shown} />
              <FinanceSummary data={shown} />
            </div>
          </div>

          <CalendarPlaceholder />

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 items-start">
            <TaskDistribution data={shown} />
            <div className="lg:col-span-2">
              <FeaturedProjects data={shown} />
            </div>
          </div>
        </div>
      )}

      {openTaskId && (
        <TaskDetail
          taskId={openTaskId}
          isAdmin={isAdmin}
          onClose={() => {
            setOpenTaskId(null);
            load(selectedDashboardUser, true);
          }}
          onUpdate={() => load(selectedDashboardUser, true)}
          onDelete={() => {
            setOpenTaskId(null);
            load(selectedDashboardUser, true);
          }}
        />
      )}
    </div>
  );
}
