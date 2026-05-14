"use client";

import { useEffect, useState } from "react";
import { useSession } from "next-auth/react";
import MetricCard from "@/components/MetricCard";
import PerformanceChart from "@/components/PerformanceChart";
import DashboardCalendar from "@/components/DashboardCalendar";

interface TasksByStatus { todo: number; inProgress: number; review: number; done: number; }

interface OverdueTask {
  id: string; title: string; dueDate: string;
  assignedTo: { name: string } | null; priority: string;
}

interface DashboardData {
  openTasks: number;
  completedThisWeek: number;
  overdueTasks: number;
  activeUsers: number;
  completedLastWeek: number;
  overdueLastWeek: number;
  tasksByStatus: TasksByStatus;
  weeklyData: { week: string; acilan: number; kapanan: number; geciken: number }[];
  overdueList?: OverdueTask[];
}

const today = new Date().toLocaleDateString("tr-TR", {
  weekday: "long", year: "numeric", month: "long", day: "numeric",
});

const STATUS_BARS = [
  { key: "todo" as const,       label: "Yapılacak",    color: "#9CA3AF", bg: "#F3F4F6" },
  { key: "inProgress" as const, label: "Devam Ediyor", color: "#F57C28", bg: "#FFF3E9" },
  { key: "review" as const,     label: "İncelemede",   color: "#6366F1", bg: "#EEF2FF" },
  { key: "done" as const,       label: "Tamamlandı",   color: "#10B981", bg: "#ECFDF5" },
];

function TaskStatusBar({ data }: { data: TasksByStatus }) {
  const total = data.todo + data.inProgress + data.review + data.done;
  if (total === 0) return null;

  return (
    <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6">
      <div className="flex items-center justify-between mb-5">
        <div>
          <h2 className="text-base font-bold text-gray-800">Görev Durumu</h2>
          <p className="text-xs text-gray-400 mt-0.5">Toplam {total} görev</p>
        </div>
        <div className="hidden sm:flex items-center gap-3 flex-wrap">
          {STATUS_BARS.map(({ key, label, color }) => (
            <span key={key} className="flex items-center gap-1 text-xs text-gray-400">
              <span className="w-2.5 h-2.5 rounded-full flex-shrink-0" style={{ backgroundColor: color }} />
              {label}
            </span>
          ))}
        </div>
      </div>

      <div className="flex rounded-full overflow-hidden h-3 mb-4">
        {STATUS_BARS.map(({ key, color }) => {
          const pct = (data[key] / total) * 100;
          if (pct === 0) return null;
          return (
            <div key={key} className="h-full transition-all" style={{ width: `${pct}%`, backgroundColor: color }} title={`${data[key]}`} />
          );
        })}
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 sm:gap-3">
        {STATUS_BARS.map(({ key, label, color, bg }) => {
          const pct = total > 0 ? Math.round((data[key] / total) * 100) : 0;
          return (
            <div key={key} className="rounded-xl p-3" style={{ backgroundColor: bg }}>
              <p className="text-xl font-bold" style={{ color }}>{data[key]}</p>
              <p className="text-[11px] font-medium text-gray-500 mt-0.5">{label}</p>
              <p className="text-[10px] text-gray-400">{pct}%</p>
            </div>
          );
        })}
      </div>
    </div>
  );
}

export default function DashboardPage() {
  const { data: session } = useSession();
  const isAdmin = session?.user?.role === "ADMIN";
  const firstName = (session?.user?.name ?? "").split(" ")[0] || null;
  const [data, setData] = useState<DashboardData | null>(null);
  const [generatingPdf, setGeneratingPdf] = useState(false);

  useEffect(() => {
    fetch("/api/dashboard").then((r) => r.json()).then(setData);
  }, []);

  // Process recurring tasks on mount
  useEffect(() => {
    fetch("/api/tasks/process-recurring", { method: "POST" }).catch(() => {});
  }, []);

  async function handleDownloadPdf() {
    if (!data) return;
    setGeneratingPdf(true);
    try {
      const { jsPDF } = await import("jspdf");
      const autoTable = (await import("jspdf-autotable")).default;

      const doc = new jsPDF({ orientation: "portrait", unit: "mm", format: "a4" });
      const pageW = doc.internal.pageSize.getWidth();
      const now = new Date().toLocaleDateString("tr-TR", { day: "numeric", month: "long", year: "numeric" });

      // Header bar
      doc.setFillColor(245, 124, 40);
      doc.rect(0, 0, pageW, 20, "F");

      doc.setTextColor(255, 255, 255);
      doc.setFontSize(14);
      doc.setFont("helvetica", "bold");
      doc.text("Vezin - Dashboard Raporu", 14, 13);
      doc.setFontSize(9);
      doc.setFont("helvetica", "normal");
      doc.text(now, pageW - 14, 13, { align: "right" });

      let y = 30;

      // Metrics section
      doc.setTextColor(30, 30, 30);
      doc.setFontSize(11);
      doc.setFont("helvetica", "bold");
      doc.text("Metrik Ozeti", 14, y);
      y += 6;

      const metrics = [
        ["Acik Gorevler", String(data.openTasks)],
        ["Bu Hafta Tamamlanan", String(data.completedThisWeek)],
        ["Geciken Isler", String(data.overdueTasks)],
        ...(isAdmin ? [["Aktif Kullanicilar", String(data.activeUsers)]] : []),
      ];

      autoTable(doc, {
        startY: y,
        head: [["Metrik", "Deger"]],
        body: metrics,
        theme: "grid",
        headStyles: { fillColor: [245, 124, 40], textColor: 255, fontStyle: "bold", fontSize: 9 },
        bodyStyles: { fontSize: 9 },
        columnStyles: { 1: { halign: "center", fontStyle: "bold" } },
        margin: { left: 14, right: 14 },
      });

      y = (doc as any).lastAutoTable.finalY + 10;

      // Weekly performance table
      doc.setFontSize(11);
      doc.setFont("helvetica", "bold");
      doc.setTextColor(30, 30, 30);
      doc.text("Son 7 Hafta Performansi", 14, y);
      y += 6;

      autoTable(doc, {
        startY: y,
        head: [["Hafta", "Acilan", "Kapanan", "Geciken"]],
        body: data.weeklyData.map((w) => [w.week, w.acilan, w.kapanan, w.geciken]),
        theme: "striped",
        headStyles: { fillColor: [99, 102, 241], textColor: 255, fontSize: 9 },
        bodyStyles: { fontSize: 9 },
        margin: { left: 14, right: 14 },
      });

      y = (doc as any).lastAutoTable.finalY + 10;

      // Overdue tasks
      if (data.overdueList && data.overdueList.length > 0) {
        if (y > 240) { doc.addPage(); y = 20; }
        doc.setFontSize(11);
        doc.setFont("helvetica", "bold");
        doc.setTextColor(30, 30, 30);
        doc.text("Geciken Gorevler", 14, y);
        y += 6;

        autoTable(doc, {
          startY: y,
          head: [["Gorev", "Atanan", "Son Tarih", "Oncelik"]],
          body: data.overdueList.map((t) => [
            t.title.slice(0, 40),
            t.assignedTo?.name ?? "—",
            new Date(t.dueDate).toLocaleDateString("tr-TR"),
            t.priority === "HIGH" ? "Yuksek" : t.priority === "MEDIUM" ? "Orta" : "Dusuk",
          ]),
          theme: "grid",
          headStyles: { fillColor: [239, 68, 68], textColor: 255, fontSize: 9 },
          bodyStyles: { fontSize: 9 },
          margin: { left: 14, right: 14 },
        });
      }

      // Footer
      const pageCount = (doc.internal as any).getNumberOfPages();
      for (let i = 1; i <= pageCount; i++) {
        doc.setPage(i);
        doc.setFontSize(8);
        doc.setTextColor(150);
        doc.setFont("helvetica", "normal");
        doc.text(`Sayfa ${i} / ${pageCount}  |  vezin.app`, pageW / 2, doc.internal.pageSize.getHeight() - 8, { align: "center" });
      }

      doc.save(`vezin-rapor-${new Date().toISOString().slice(0, 10)}.pdf`);
    } catch (err) {
      console.error("PDF hatasi:", err);
      window.print();
    } finally {
      setGeneratingPdf(false);
    }
  }

  const metricCards = data ? [
    {
      title: "Açık Görevler",
      value: data.openTasks,
      sub: "Tamamlanmamış görevler",
      accentColor: "var(--badge-orange-text)",
      bgColor: "var(--badge-orange-bg)",
      icon: (
        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2M9 12l2 2 4-4" />
        </svg>
      ),
    },
    {
      title: "Bu Hafta Tamamlanan",
      value: data.completedThisWeek,
      sub: "Bu hafta kapatılan görevler",
      accentColor: "var(--badge-emerald-text)",
      bgColor: "var(--badge-emerald-bg)",
      trend: { delta: data.completedThisWeek - data.completedLastWeek, higherIsBetter: true },
      icon: (
        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
        </svg>
      ),
    },
    {
      title: "Geciken İşler",
      value: data.overdueTasks,
      sub: "Son tarihi geçmiş görevler",
      accentColor: "var(--badge-red-text)",
      bgColor: "var(--badge-red-bg)",
      trend: { delta: data.overdueTasks - data.overdueLastWeek, higherIsBetter: false },
      icon: (
        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
        </svg>
      ),
    },
    ...(isAdmin ? [{
      title: "Aktif Kullanıcılar",
      value: data.activeUsers,
      sub: "Devam eden görevi olan kişiler",
      accentColor: "var(--badge-indigo-text)",
      bgColor: "var(--badge-indigo-bg)",
      icon: (
        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z" />
        </svg>
      ),
    }] : []),
  ] : [];

  return (
    <div className="max-w-6xl mx-auto">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 mb-6 sm:mb-8">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold text-gray-800">
            {firstName ? `Merhaba, ${firstName}!` : "Dashboard"}
          </h1>
          <p className="text-sm text-gray-400 mt-1 capitalize">{today}</p>
        </div>
        <button
          onClick={handleDownloadPdf}
          disabled={!data || generatingPdf}
          className="inline-flex items-center gap-2 bg-[#F57C28] hover:bg-[#D96A1A] disabled:opacity-60 text-white font-semibold text-sm px-4 py-2.5 rounded-xl shadow-md shadow-[#F57C28]/30 transition-all hover:-translate-y-0.5 active:translate-y-0 self-start sm:self-auto"
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
          </svg>
          {generatingPdf ? "Hazırlanıyor..." : "PDF Rapor İndir"}
        </button>
      </div>

      {/* Metric Cards */}
      {data ? (
        <div className={`grid grid-cols-2 ${isAdmin ? "lg:grid-cols-4" : "lg:grid-cols-3"} gap-3 sm:gap-4 mb-6`}>
          {metricCards.map((c) => <MetricCard key={c.title} {...c} />)}
        </div>
      ) : (
        <div className={`grid grid-cols-2 ${isAdmin ? "lg:grid-cols-4" : "lg:grid-cols-3"} gap-3 sm:gap-4 mb-6`}>
          {[...Array(isAdmin ? 4 : 3)].map((_, i) => (
            <div key={i} className="bg-white rounded-2xl border border-gray-100 shadow-sm p-4 sm:p-5 h-28 sm:h-32 animate-pulse">
              <div className="h-3 bg-gray-100 rounded w-1/2 mb-4" />
              <div className="h-8 bg-gray-100 rounded w-1/4" />
            </div>
          ))}
        </div>
      )}

      {/* Calendar */}
      <div className="mt-6">
        <DashboardCalendar />
      </div>

      {/* Task Status Breakdown */}
      {data ? (
        <div className="mt-6">
          <TaskStatusBar data={data.tasksByStatus} />
        </div>
      ) : (
        <div className="mt-6 bg-white rounded-2xl border border-gray-100 shadow-sm h-40 animate-pulse" />
      )}

      {/* Chart */}
      {data ? (
        <div className="mt-6">
          <PerformanceChart data={data.weeklyData} />
        </div>
      ) : (
        <div className="mt-6 bg-white rounded-2xl border border-gray-100 shadow-sm h-72 animate-pulse flex items-center justify-center">
          <p className="text-gray-300 text-sm">Yükleniyor...</p>
        </div>
      )}
    </div>
  );
}
