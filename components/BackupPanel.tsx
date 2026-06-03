"use client";

import { useState } from "react";
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";

interface SummaryData {
  totalTasks:     number;
  completedTasks: number;
  completionRate: number;
  leaveDays:      number;
  activeUsers:    number;
  totalMeetings:  number;
  topDept:        string;
  topPerformer:   string;
}

const QUICK_OPTIONS = [
  { label: "Son 1 Hafta", days: 7  },
  { label: "Son 1 Ay",    days: 30 },
  { label: "Son 3 Ay",    days: 90 },
  { label: "Son 1 Yıl",   days: 365 },
];

function today(): string {
  return new Date().toISOString().split("T")[0];
}
function daysAgo(n: number): string {
  const d = new Date();
  d.setDate(d.getDate() - n);
  return d.toISOString().split("T")[0];
}

function SummaryCard({
  label, value, sub, icon, accent,
}: {
  label: string; value: string | number; sub?: string;
  icon: React.ReactNode; accent: string;
}) {
  return (
    <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5 flex items-start gap-4">
      <div className={`w-11 h-11 rounded-xl flex items-center justify-center flex-shrink-0 ${accent}`}>
        {icon}
      </div>
      <div className="min-w-0">
        <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide truncate">{label}</p>
        <p className="text-2xl font-bold text-gray-800 mt-0.5 leading-none">{value}</p>
        {sub && <p className="text-xs text-gray-400 mt-1">{sub}</p>}
      </div>
    </div>
  );
}

export default function BackupPanel() {
  const [startDate, setStartDate]   = useState("");
  const [endDate, setEndDate]       = useState(today());
  const [activeQuick, setActiveQuick] = useState<number | "all" | null>(null);
  const [loading, setLoading]         = useState(false);
  const [downloading, setDownloading] = useState(false);
  const [pdfLoading, setPdfLoading]   = useState(false);
  const [summary, setSummary]         = useState<SummaryData | null>(null);
  const [error, setError]             = useState<string | null>(null);

  function applyQuick(days: number) {
    setStartDate(daysAgo(days));
    setEndDate(today());
    setActiveQuick(days);
    setSummary(null);
    setError(null);
  }

  function applyAll() {
    setStartDate("");
    setEndDate("");
    setActiveQuick("all");
    setSummary(null);
    setError(null);
  }

  function buildQS(extra?: Record<string, string>) {
    const p = new URLSearchParams();
    if (startDate) p.set("startDate", startDate);
    if (endDate)   p.set("endDate",   endDate);
    if (extra) Object.entries(extra).forEach(([k, v]) => p.set(k, v));
    return p.toString();
  }

  async function handleGenerateReport() {
    setLoading(true);
    setError(null);
    setSummary(null);
    try {
      const qs  = buildQS({ format: "summary" });
      const res = await fetch(`/api/admin/backup${qs ? `?${qs}` : "?format=summary"}`);
      if (!res.ok) {
        const d = await res.json().catch(() => ({}));
        throw new Error(d.error || "Rapor alınamadı");
      }
      setSummary(await res.json());
    } catch (e: any) {
      setError(e.message || "Hata oluştu");
    } finally {
      setLoading(false);
    }
  }

  async function handlePdfDownload() {
    setPdfLoading(true);
    setError(null);
    try {
      const qs  = buildQS({ format: "pdf-data" });
      const res = await fetch(`/api/admin/backup${qs ? `?${qs}` : "?format=pdf-data"}`);
      if (!res.ok) {
        const d = await res.json().catch(() => ({}));
        throw new Error(d.error || "PDF verisi alınamadı");
      }
      const data = await res.json();

      const doc = new jsPDF({ orientation: "landscape", unit: "mm", format: "a4" });
      const pageW = doc.internal.pageSize.getWidth();

      // ── Renk sabitleri ──────────────────────────────────
      const NAVY   = [0,   51,  102] as [number, number, number];
      const WHITE  = [255, 255, 255] as [number, number, number];
      const LGRAY  = [247, 247, 247] as [number, number, number];
      const ORANGE = [245, 124,  40] as [number, number, number];

      function addSection(title: string) {
        if (doc.getCurrentPageInfo().pageNumber > 1 || (doc as any).lastAutoTable?.finalY > 40) {
          // şekli kontrol et
        }
        doc.setFillColor(...NAVY);
        doc.rect(10, (doc as any).lastAutoTable?.finalY ? (doc as any).lastAutoTable.finalY + 8 : 28, pageW - 20, 7, "F");
        doc.setTextColor(...WHITE);
        doc.setFontSize(9);
        doc.setFont("helvetica", "bold");
        doc.text(title, 13, ((doc as any).lastAutoTable?.finalY ? (doc as any).lastAutoTable.finalY + 8 : 28) + 5);
        doc.setTextColor(0, 0, 0);
      }

      // ── KAPAK ──────────────────────────────────────────
      doc.setFillColor(...NAVY);
      doc.rect(0, 0, pageW, 22, "F");
      doc.setTextColor(...WHITE);
      doc.setFontSize(16);
      doc.setFont("helvetica", "bold");
      doc.text("VEZIN - YONETiM RAPORU", pageW / 2, 13, { align: "center" });
      doc.setFontSize(9);
      doc.setFont("helvetica", "normal");
      doc.text(`Donem: ${data.period}`, pageW / 2, 19, { align: "center" });
      doc.setTextColor(0, 0, 0);

      // ── ÖZET KARTLAR ─────────────────────────────────
      const s = data.summary;
      const cards = [
        ["Toplam Gorev",      s.totalTasks],
        ["Tamamlanan",        s.completedTasks],
        ["Tamamlama Orani",   `%${s.completionRate}`],
        ["Devam Eden",        s.inProgress],
        ["incelemede",        s.review],
        ["Geciken",           s.overdue],
        ["izin Gunu",         s.leaveDays],
        ["Toplanti",          s.totalMeetings],
      ];
      const cardW = (pageW - 20) / cards.length;
      let cx = 10;
      const cardY = 25;
      doc.setFontSize(8);
      for (const [lbl, val] of cards) {
        doc.setFillColor(...LGRAY);
        doc.roundedRect(cx, cardY, cardW - 2, 14, 1, 1, "F");
        doc.setFont("helvetica", "bold");
        doc.setFontSize(11);
        doc.setTextColor(...NAVY);
        doc.text(String(val), cx + (cardW - 2) / 2, cardY + 8, { align: "center" });
        doc.setFont("helvetica", "normal");
        doc.setFontSize(6.5);
        doc.setTextColor(100, 100, 100);
        doc.text(String(lbl), cx + (cardW - 2) / 2, cardY + 12, { align: "center" });
        cx += cardW;
      }
      doc.setTextColor(0, 0, 0);

      // helper for next section Y
      function nextY() {
        return (doc as any).lastAutoTable?.finalY ? (doc as any).lastAutoTable.finalY + 10 : 42;
      }

      // ── GÖREV ÖZETİ ──────────────────────────────────
      const tasksY = 42;
      doc.setFillColor(...NAVY);
      doc.rect(10, tasksY, pageW - 20, 7, "F");
      doc.setTextColor(...WHITE);
      doc.setFontSize(9);
      doc.setFont("helvetica", "bold");
      doc.text("GOREV OZETi", 13, tasksY + 5);
      doc.setTextColor(0, 0, 0);

      autoTable(doc, {
        startY: tasksY + 8,
        margin: { left: 10, right: 10 },
        head: [["Gorev Adi", "Dept.", "Atanan", "Oncelik", "Durum", "Olusturuldu", "Tamamlandi"]],
        body: data.tasks.map((t: any) => [t.title, t.dept, t.assignees, t.priority, t.status, t.createdAt, t.completedAt]),
        headStyles:    { fillColor: NAVY, textColor: WHITE, fontStyle: "bold", fontSize: 7.5 },
        bodyStyles:    { fontSize: 7 },
        alternateRowStyles: { fillColor: LGRAY },
        columnStyles:  { 0: { cellWidth: 70 }, 1: { cellWidth: 28 }, 2: { cellWidth: 40 } },
        tableWidth:    "wrap",
      });

      // ── ÇALIŞAN PERFORMANSI ───────────────────────────
      doc.addPage();
      const empY = 10;
      doc.setFillColor(...NAVY);
      doc.rect(10, empY, pageW - 20, 7, "F");
      doc.setTextColor(...WHITE);
      doc.setFontSize(9);
      doc.setFont("helvetica", "bold");
      doc.text("CALiSAN PERFORMANSI", 13, empY + 5);
      doc.setTextColor(0, 0, 0);

      autoTable(doc, {
        startY: empY + 8,
        margin: { left: 10, right: 10 },
        head: [["Calisan", "Dept.", "Toplam Gorev", "Tamamlanan", "Tamamlama %", "Ort. Sure (gun)", "Geciken"]],
        body: data.employees.map((e: any) => [
          e.name, e.dept, e.total, e.completed, `%${e.rate}`,
          e.avgDays != null ? e.avgDays : "—", e.overdue,
        ]),
        headStyles:         { fillColor: NAVY, textColor: WHITE, fontStyle: "bold", fontSize: 7.5 },
        bodyStyles:         { fontSize: 7 },
        alternateRowStyles: { fillColor: LGRAY },
        tableWidth:         "wrap",
      });

      // ── İZİN KAYITLARI ───────────────────────────────
      const leaveY = nextY();
      doc.setFillColor(...NAVY);
      doc.rect(10, leaveY, pageW - 20, 7, "F");
      doc.setTextColor(...WHITE);
      doc.setFontSize(9);
      doc.setFont("helvetica", "bold");
      doc.text("iZiN KAYITLARI", 13, leaveY + 5);
      doc.setTextColor(0, 0, 0);

      autoTable(doc, {
        startY: leaveY + 8,
        margin: { left: 10, right: 10 },
        head: [["Calisan", "Dept.", "Tur", "Baslangic", "Bitis", "Gun", "Durum"]],
        body: data.leaves.map((l: any) => [l.name, l.dept, l.type, l.start, l.end, l.days, l.status]),
        headStyles:         { fillColor: NAVY, textColor: WHITE, fontStyle: "bold", fontSize: 7.5 },
        bodyStyles:         { fontSize: 7 },
        alternateRowStyles: { fillColor: LGRAY },
        tableWidth:         "wrap",
      });

      // ── DEPARTMAN ÖZETİ ───────────────────────────────
      doc.addPage();
      const deptY = 10;
      doc.setFillColor(...NAVY);
      doc.rect(10, deptY, pageW - 20, 7, "F");
      doc.setTextColor(...WHITE);
      doc.setFontSize(9);
      doc.setFont("helvetica", "bold");
      doc.text("DEPARTMAN OZETi", 13, deptY + 5);
      doc.setTextColor(0, 0, 0);

      autoTable(doc, {
        startY: deptY + 8,
        margin: { left: 10, right: 10 },
        head: [["Departman", "Toplam", "Tamamlanan", "Devam Eden", "Geciken", "Tamamlama %"]],
        body: data.deptStats.map((d: any) => [d.dept, d.total, d.done, d.active, d.overdue, `%${d.rate}`]),
        headStyles:         { fillColor: NAVY, textColor: WHITE, fontStyle: "bold", fontSize: 7.5 },
        bodyStyles:         { fontSize: 7 },
        alternateRowStyles: { fillColor: LGRAY },
        tableWidth:         "wrap",
      });

      // ── TOPLANTI KAYITLARI ────────────────────────────
      const meetY = nextY();
      doc.setFillColor(...NAVY);
      doc.rect(10, meetY, pageW - 20, 7, "F");
      doc.setTextColor(...WHITE);
      doc.setFontSize(9);
      doc.setFont("helvetica", "bold");
      doc.text("TOPLANTI KAYITLARI", 13, meetY + 5);
      doc.setTextColor(0, 0, 0);

      autoTable(doc, {
        startY: meetY + 8,
        margin: { left: 10, right: 10 },
        head: [["Baslik", "Dept.", "Tarih", "Sure (dk)", "Olusturan"]],
        body: data.meetings.map((m: any) => [m.title, m.dept, m.date, m.duration, m.createdBy]),
        headStyles:         { fillColor: NAVY, textColor: WHITE, fontStyle: "bold", fontSize: 7.5 },
        bodyStyles:         { fontSize: 7 },
        alternateRowStyles: { fillColor: LGRAY },
        tableWidth:         "wrap",
      });

      // ── Sayfa numaraları ──────────────────────────────
      const totalPages = (doc as any).internal.getNumberOfPages();
      for (let i = 1; i <= totalPages; i++) {
        doc.setPage(i);
        doc.setFontSize(7);
        doc.setTextColor(150, 150, 150);
        doc.text(`Sayfa ${i} / ${totalPages}`, pageW - 15, doc.internal.pageSize.getHeight() - 5, { align: "right" });
        doc.text(`Vezin Yönetim - ${new Date().toLocaleDateString("tr-TR")}`, 12, doc.internal.pageSize.getHeight() - 5);
      }

      doc.save(`vezin-rapor-${today()}.pdf`);
    } catch (e: any) {
      setError(e.message || "PDF oluşturulamadı");
    } finally {
      setPdfLoading(false);
    }
  }

  async function handleDownload() {
    setDownloading(true);
    setError(null);
    try {
      const qs  = buildQS();
      const res = await fetch(`/api/admin/backup${qs ? `?${qs}` : ""}`);
      if (!res.ok) {
        const d = await res.json().catch(() => ({}));
        throw new Error(d.error || "Excel oluşturulamadı");
      }
      const blob = await res.blob();
      const url  = URL.createObjectURL(blob);
      const a    = document.createElement("a");
      a.href     = url;
      a.download = `vezin-rapor-${today()}.xlsx`;
      a.click();
      URL.revokeObjectURL(url);
    } catch (e: any) {
      setError(e.message || "İndirme hatası");
    } finally {
      setDownloading(false);
    }
  }

  return (
    <div className="space-y-6 max-w-4xl">
      {/* ── Tarih Seçici ────────────────────────────────── */}
      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6 space-y-5">
        <h2 className="text-sm font-semibold text-gray-700">Tarih Aralığı Seçin</h2>

        {/* Hızlı butonlar */}
        <div className="flex flex-wrap gap-2">
          {QUICK_OPTIONS.map(({ label, days }) => (
            <button
              key={days}
              onClick={() => applyQuick(days)}
              className={`px-3.5 py-1.5 rounded-lg text-xs font-semibold transition-colors ${
                activeQuick === days
                  ? "bg-[#F57C28] text-white shadow-sm shadow-[#F57C28]/30"
                  : "bg-gray-100 text-gray-600 hover:bg-gray-200"
              }`}
            >
              {label}
            </button>
          ))}
          <button
            onClick={applyAll}
            className={`px-3.5 py-1.5 rounded-lg text-xs font-semibold transition-colors ${
              activeQuick === "all"
                ? "bg-[#F57C28] text-white shadow-sm shadow-[#F57C28]/30"
                : "bg-gray-100 text-gray-600 hover:bg-gray-200"
            }`}
          >
            Tümü
          </button>
        </div>

        {/* Manuel tarih */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label className="block text-xs font-medium text-gray-500 mb-1.5">Başlangıç Tarihi</label>
            <input
              type="date"
              value={startDate}
              max={endDate || today()}
              onChange={(e) => { setStartDate(e.target.value); setActiveQuick(null); setSummary(null); }}
              className="w-full px-3 py-2.5 rounded-xl border border-gray-200 text-sm text-gray-700 focus:outline-none focus:ring-2 focus:ring-[#F57C28]/30 focus:border-[#F57C28]"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-500 mb-1.5">Bitiş Tarihi</label>
            <input
              type="date"
              value={endDate}
              min={startDate}
              max={today()}
              onChange={(e) => { setEndDate(e.target.value); setActiveQuick(null); setSummary(null); }}
              className="w-full px-3 py-2.5 rounded-xl border border-gray-200 text-sm text-gray-700 focus:outline-none focus:ring-2 focus:ring-[#F57C28]/30 focus:border-[#F57C28]"
            />
          </div>
        </div>

        <button
          onClick={handleGenerateReport}
          disabled={loading}
          className="w-full py-3 rounded-xl bg-[#F57C28] hover:bg-[#e06b1a] disabled:opacity-60 text-white text-sm font-semibold transition-colors shadow-md shadow-[#F57C28]/25 flex items-center justify-center gap-2"
        >
          {loading ? (
            <>
              <svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v4l3-3-3-3v4a8 8 0 00-8 8h4l-3 3-3-3h4z" />
              </svg>
              Hesaplanıyor...
            </>
          ) : (
            <>
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
              </svg>
              Rapor Oluştur
            </>
          )}
        </button>

        {error && (
          <div className="flex items-start gap-2 bg-red-50 border border-red-200 text-red-700 text-sm rounded-xl px-4 py-3">
            <svg className="w-4 h-4 flex-shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126zM12 15.75h.007v.008H12v-.008z" />
            </svg>
            {error}
          </div>
        )}
      </div>

      {/* ── Özet Kartlar ────────────────────────────────── */}
      {summary && (
        <>
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            <SummaryCard
              label="Toplam Görev"
              value={summary.totalTasks}
              icon={
                <svg className="w-5 h-5 text-[#F57C28]" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
                </svg>
              }
              accent="bg-[#F57C28]/10"
            />
            <SummaryCard
              label="Tamamlanan"
              value={summary.completedTasks}
              sub={`Tamamlama oranı %${summary.completionRate}`}
              icon={
                <svg className="w-5 h-5 text-emerald-600" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
              }
              accent="bg-emerald-100"
            />
            <SummaryCard
              label="Kullanılan İzin"
              value={`${summary.leaveDays} gün`}
              icon={
                <svg className="w-5 h-5 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                </svg>
              }
              accent="bg-blue-100"
            />
            <SummaryCard
              label="Aktif Kullanıcı"
              value={summary.activeUsers}
              sub={`Toplam ${summary.totalMeetings} toplantı`}
              icon={
                <svg className="w-5 h-5 text-violet-600" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
                </svg>
              }
              accent="bg-violet-100"
            />
          </div>

          {/* Öne çıkanlar */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5">
              <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-1">En Aktif Departman</p>
              <p className="text-base font-bold text-gray-800">{summary.topDept}</p>
            </div>
            <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5">
              <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-1">En Çok Görev Tamamlayan</p>
              <p className="text-base font-bold text-gray-800">{summary.topPerformer}</p>
            </div>
          </div>

          {/* İndirme */}
          <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6">
            <div className="flex items-start justify-between gap-4 flex-wrap">
              <div>
                <h3 className="text-sm font-semibold text-gray-800">Raporu İndir</h3>
                <p className="text-xs text-gray-400 mt-1">
                  6 bölüm: Özet · Görev Özeti · Çalışan Performansı · İzin Kayıtları · Departman Özeti · Toplantı Kayıtları
                </p>
              </div>
              <div className="flex items-center gap-2 flex-shrink-0">
                {/* Excel */}
                <button
                  onClick={handleDownload}
                  disabled={downloading || pdfLoading}
                  className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-emerald-500 hover:bg-emerald-600 disabled:opacity-60 text-white text-sm font-semibold transition-colors shadow-md shadow-emerald-500/25"
                >
                  {downloading ? (
                    <>
                      <svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v4l3-3-3-3v4a8 8 0 00-8 8h4l-3 3-3-3h4z" />
                      </svg>
                      İndiriliyor...
                    </>
                  ) : (
                    <>
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M3 16.5v2.25A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75V16.5M16.5 12L12 16.5m0 0L7.5 12m4.5 4.5V3" />
                      </svg>
                      Excel İndir
                    </>
                  )}
                </button>

                {/* PDF */}
                <button
                  onClick={handlePdfDownload}
                  disabled={downloading || pdfLoading}
                  className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-red-500 hover:bg-red-600 disabled:opacity-60 text-white text-sm font-semibold transition-colors shadow-md shadow-red-500/25"
                >
                  {pdfLoading ? (
                    <>
                      <svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v4l3-3-3-3v4a8 8 0 00-8 8h4l-3 3-3-3h4z" />
                      </svg>
                      Oluşturuluyor...
                    </>
                  ) : (
                    <>
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 14.25v-2.625a3.375 3.375 0 00-3.375-3.375h-1.5A1.125 1.125 0 0113.5 7.125v-1.5a3.375 3.375 0 00-3.375-3.375H8.25m2.25 0H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 00-9-9z" />
                      </svg>
                      PDF İndir
                    </>
                  )}
                </button>
              </div>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
