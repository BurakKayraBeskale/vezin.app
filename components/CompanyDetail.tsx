"use client";

import { useState } from "react";
import Link from "next/link";
import {
  BarChart, Bar, PieChart, Pie, Cell, LineChart, Line,
  XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer,
} from "recharts";

/* ─── Types ─── */
interface AssignmentRow {
  id: string; userId: string; assignedAt: string;
  user: { id: string; name: string; email: string; department: string };
  taskCount: number;
}
interface TaskRow {
  id: string; title: string; status: string; priority: string;
  createdAt: string; updatedAt: string; dueDate: string | null;
  assignedTo: { id: string; name: string } | null;
}
interface Company {
  id: string; name: string; taxNumber: string | null; sector: string | null;
  startDate: string | null; notes: string | null; about: string | null;
  createdAt: string; assignments: AssignmentRow[]; tasks: TaskRow[];
}
interface Metrics {
  totalTasks: number; completedTasks: number; activeEmployees: number;
  totalRotation: number; overdueTasks: number;
}
interface Stats {
  statusDist: { status: string; label: string; count: number; color: string }[];
  monthlyCompleted: { month: string; count: number }[];
  yearlyTasks: { year: number; count: number }[];
}
interface TimelineEvent { type: string; date: string; label: string; extra?: string; }

interface Props {
  company: Company; metrics: Metrics; stats: Stats;
  timeline: TimelineEvent[]; canManage: boolean; role: string;
}

/* ─── Constants ─── */
const DEPT_LABELS: Record<string, string> = {
  OUTSOURCE: "Outsource", BAGIMSIZ_DENETIM: "Bağımsız Denetim",
  MUHASEBE: "Muhasebe", YEMINLI_MALI_MUSAVIR: "YMM", ADMIN: "Yönetim",
};
const STATUS_LABEL: Record<string, string> = {
  TODO: "Yapılacak", IN_PROGRESS: "Devam Ediyor", REVIEW: "İncelemede", DONE: "Tamamlandı",
};
const STATUS_CLASS: Record<string, string> = {
  TODO: "bg-gray-100 text-gray-600",
  IN_PROGRESS: "bg-orange-100 text-orange-600",
  REVIEW: "bg-indigo-100 text-indigo-600",
  DONE: "bg-emerald-100 text-emerald-600",
};
const PRIORITY_CLASS: Record<string, string> = {
  LOW: "bg-blue-50 text-blue-600", MEDIUM: "bg-amber-50 text-amber-600", HIGH: "bg-red-50 text-red-600",
};
const PRIORITY_LABEL: Record<string, string> = { LOW: "Düşük", MEDIUM: "Orta", HIGH: "Yüksek" };
const EMPTY_FORM = { name: "", taxNumber: "", sector: "", startDate: "", notes: "", about: "" };

/* ─── Helpers ─── */
function fmtDate(d: string | null) {
  if (!d) return "—";
  return new Date(d).toLocaleDateString("tr-TR", { day: "numeric", month: "short", year: "numeric" });
}
function fmtDatetime(d: string) {
  return new Date(d).toLocaleString("tr-TR", { day: "numeric", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" });
}
function initials(name: string) {
  return name.split(" ").map((n) => n[0]).join("").toUpperCase().slice(0, 2);
}
function yearsWorking(startDate: string | null): number {
  if (!startDate) return 0;
  return (Date.now() - new Date(startDate).getTime()) / (1000 * 60 * 60 * 24 * 365.25);
}
function isOverdue(task: TaskRow) {
  return task.status !== "DONE" && task.dueDate && new Date(task.dueDate).getTime() < Date.now();
}

/* ─── Sub-components ─── */
function MetricCard({ title, value, sub, color }: { title: string; value: number; sub: string; color: string }) {
  return (
    <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5">
      <p className="text-xs font-semibold text-gray-400 mb-1">{title}</p>
      <p className="text-3xl font-bold" style={{ color }}>{value}</p>
      <p className="text-xs text-gray-400 mt-1">{sub}</p>
    </div>
  );
}

/* ─── Main component ─── */
type Tab = "genel" | "rotasyon" | "gorevler" | "grafikler" | "aktivite";

export default function CompanyDetail({ company, metrics, stats, timeline, canManage, role }: Props) {
  const [activeTab, setActiveTab] = useState<Tab>("genel");
  const [showEdit, setShowEdit] = useState(false);
  const [form, setForm] = useState({ ...EMPTY_FORM });
  const [submitting, setSubmitting] = useState(false);
  const [formError, setFormError] = useState("");
  const [localCompany, setLocalCompany] = useState(company);

  const years = yearsWorking(localCompany.startDate);
  const isFiveYears = years >= 5;

  function openEdit() {
    setForm({
      name: localCompany.name,
      taxNumber: localCompany.taxNumber ?? "",
      sector: localCompany.sector ?? "",
      startDate: localCompany.startDate ? localCompany.startDate.slice(0, 10) : "",
      notes: localCompany.notes ?? "",
      about: localCompany.about ?? "",
    });
    setFormError("");
    setShowEdit(true);
  }

  async function handleEditSave() {
    if (!form.name.trim()) { setFormError("Firma adı zorunlu"); return; }
    setSubmitting(true); setFormError("");
    try {
      const res = await fetch(`/api/companies/${localCompany.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: form.name.trim(),
          taxNumber: form.taxNumber.trim() || null,
          sector: form.sector.trim() || null,
          startDate: form.startDate || null,
          notes: form.notes.trim() || null,
          about: form.about.trim() || null,
        }),
      });
      if (!res.ok) { const d = await res.json(); setFormError(d.error ?? "Hata"); return; }
      const updated = await res.json();
      setLocalCompany((prev) => ({
        ...prev,
        name: updated.name, taxNumber: updated.taxNumber, sector: updated.sector,
        startDate: updated.startDate, notes: updated.notes, about: updated.about,
      }));
      setShowEdit(false);
    } catch { setFormError("Sunucu hatası"); }
    finally { setSubmitting(false); }
  }

  function downloadPdf() {
    import("jspdf").then(({ default: jsPDF }) => {
      import("jspdf-autotable").then(({ default: autoTable }) => {
        const doc = new jsPDF();
        const pageW = doc.internal.pageSize.getWidth();
        doc.setFillColor(245, 124, 40);
        doc.rect(0, 0, pageW, 18, "F");
        doc.setTextColor(255, 255, 255);
        doc.setFontSize(13); doc.setFont("helvetica", "bold");
        doc.text(localCompany.name, 14, 12);
        doc.setFontSize(8); doc.setFont("helvetica", "normal");
        doc.text(new Date().toLocaleDateString("tr-TR"), pageW - 14, 12, { align: "right" });
        let y = 26;
        doc.setTextColor(30, 30, 30); doc.setFontSize(9);
        doc.text(`Vergi No: ${localCompany.taxNumber ?? "—"}   Sektör: ${localCompany.sector ?? "—"}   Başlangıç: ${fmtDate(localCompany.startDate)}`, 14, y);
        y += 10;
        autoTable(doc, {
          startY: y, head: [["Çalışan", "Departman", "Atanma", "Görev"]],
          body: localCompany.assignments.map((a) => [
            a.user.name, DEPT_LABELS[a.user.department] ?? a.user.department,
            fmtDate(a.assignedAt), a.taskCount,
          ]),
          headStyles: { fillColor: [245, 124, 40] }, styles: { fontSize: 9 },
        });
        y = (doc as any).lastAutoTable.finalY + 8;
        autoTable(doc, {
          startY: y, head: [["Görev", "Durum", "Atanan", "Son Tarih"]],
          body: localCompany.tasks.map((t) => [
            t.title.slice(0, 40), STATUS_LABEL[t.status] ?? t.status,
            t.assignedTo?.name ?? "—", fmtDate(t.dueDate),
          ]),
          headStyles: { fillColor: [99, 102, 241] }, styles: { fontSize: 9 },
        });
        doc.save(`${localCompany.name.replace(/\s+/g, "_")}.pdf`);
      });
    });
  }

  function downloadExcel() {
    import("xlsx").then((XLSX) => {
      const wb = XLSX.utils.book_new();
      const info = [
        ["Firma Adı", localCompany.name], ["Vergi No", localCompany.taxNumber ?? ""],
        ["Sektör", localCompany.sector ?? ""], ["Başlangıç", fmtDate(localCompany.startDate)],
        ["Çalışma Süresi", localCompany.startDate ? `${Math.floor(years)} yıl` : "—"],
        [], ["ÇALIŞANLAR"], ["Ad", "Departman", "Atanma", "Görev Sayısı"],
        ...localCompany.assignments.map((a) => [
          a.user.name, DEPT_LABELS[a.user.department] ?? a.user.department, fmtDate(a.assignedAt), a.taskCount,
        ]),
        [], ["GÖREVLER"], ["Başlık", "Durum", "Öncelik", "Atanan", "Son Tarih"],
        ...localCompany.tasks.map((t) => [
          t.title, STATUS_LABEL[t.status] ?? t.status, PRIORITY_LABEL[t.priority] ?? t.priority,
          t.assignedTo?.name ?? "—", fmtDate(t.dueDate),
        ]),
      ];
      XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(info), "Firma");
      XLSX.writeFile(wb, `${localCompany.name.replace(/\s+/g, "_")}.xlsx`);
    });
  }

  const tabs: { key: Tab; label: string }[] = [
    { key: "genel", label: "Genel" },
    { key: "rotasyon", label: `Rotasyon (${localCompany.assignments.length})` },
    { key: "gorevler", label: `Görevler (${localCompany.tasks.length})` },
    { key: "grafikler", label: "Grafikler" },
    { key: "aktivite", label: "Aktivite" },
  ];

  const inputClass = "w-full px-3 py-2.5 rounded-xl border border-gray-200 text-sm text-gray-700 focus:outline-none focus:ring-2 focus:ring-[#F57C28]/30 focus:border-[#F57C28]";

  return (
    <div className="max-w-5xl mx-auto space-y-6">
      {/* Back */}
      <Link href="/companies" className="inline-flex items-center gap-1.5 text-sm text-gray-400 hover:text-gray-600 transition-colors">
        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
        </svg>
        Firmalara Dön
      </Link>

      {/* Header Card */}
      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6">
        <div className="flex flex-col sm:flex-row sm:items-start gap-4">
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-3 flex-wrap">
              <h1 className="text-2xl font-bold text-gray-900">{localCompany.name}</h1>
              {isFiveYears && (
                <span className="inline-flex items-center gap-1 text-xs font-bold px-2.5 py-1 rounded-full bg-amber-100 text-amber-700 border border-amber-200">
                  ⭐ {Math.floor(years)}+ Yıl
                </span>
              )}
            </div>
            <div className="flex flex-wrap gap-x-4 gap-y-1 mt-2 text-sm text-gray-500">
              {localCompany.sector && <span>{localCompany.sector}</span>}
              {localCompany.taxNumber && <span>VKN: {localCompany.taxNumber}</span>}
              {localCompany.startDate && (
                <span>{fmtDate(localCompany.startDate)} · {Math.floor(years)} yıl {Math.floor((years % 1) * 12)} ay</span>
              )}
            </div>
          </div>
          <div className="flex items-center gap-2 flex-wrap flex-shrink-0">
            <button onClick={downloadPdf}
              className="flex items-center gap-1.5 text-sm text-red-500 hover:text-red-600 font-medium px-3 py-2 rounded-xl border border-red-200 hover:bg-red-50 transition-colors">
              <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
              </svg>
              PDF
            </button>
            <button onClick={downloadExcel}
              className="flex items-center gap-1.5 text-sm text-emerald-600 hover:text-emerald-700 font-medium px-3 py-2 rounded-xl border border-emerald-200 hover:bg-emerald-50 transition-colors">
              <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
              </svg>
              Excel
            </button>
            {canManage && (
              <button onClick={openEdit}
                className="flex items-center gap-1.5 text-sm text-gray-600 hover:text-gray-800 font-medium px-3 py-2 rounded-xl border border-gray-200 hover:bg-gray-50 transition-colors">
                <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                </svg>
                Düzenle
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Metrics */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <MetricCard title="Toplam Görev" value={metrics.totalTasks} sub="Bu firmaya bağlı" color="#F57C28" />
        <MetricCard title="Tamamlanan" value={metrics.completedTasks} sub="Status DONE" color="#10B981" />
        <MetricCard title="Aktif Çalışan" value={metrics.activeEmployees} sub="Şu an atanmış" color="#6366F1" />
        <MetricCard title="Toplam Rotasyon" value={metrics.totalRotation} sub="Kaç kişi çalıştı" color="#F59E0B" />
      </div>

      {/* Tabs */}
      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
        <div className="flex border-b border-gray-100 overflow-x-auto">
          {tabs.map((t) => (
            <button key={t.key} onClick={() => setActiveTab(t.key)}
              className={`px-5 py-3.5 text-sm font-medium whitespace-nowrap border-b-2 transition-colors -mb-px ${
                activeTab === t.key
                  ? "border-[#F57C28] text-[#F57C28]"
                  : "border-transparent text-gray-400 hover:text-gray-600"
              }`}>
              {t.label}
            </button>
          ))}
        </div>

        <div className="p-6">
          {/* GENEL */}
          {activeTab === "genel" && (
            <div className="space-y-6">
              {localCompany.about ? (
                <div>
                  <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-3">Firma Hakkında</p>
                  <p className="text-sm text-gray-700 leading-relaxed whitespace-pre-wrap">{localCompany.about}</p>
                </div>
              ) : (
                <p className="text-sm text-gray-400 py-8 text-center">
                  Hakkında bilgisi henüz girilmemiş.
                  {canManage && (
                    <button onClick={openEdit} className="ml-1 text-[#F57C28] hover:underline">Düzenle</button>
                  )}
                </p>
              )}
              {localCompany.notes && (
                <div>
                  <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-2">Notlar</p>
                  <p className="text-sm text-gray-600 bg-gray-50 rounded-xl p-4 whitespace-pre-wrap">{localCompany.notes}</p>
                </div>
              )}
            </div>
          )}

          {/* ROTASYON */}
          {activeTab === "rotasyon" && (
            <div>
              {localCompany.assignments.length === 0 ? (
                <p className="text-sm text-gray-400 py-10 text-center">Henüz çalışan atanmamış.</p>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full min-w-[600px] text-sm">
                    <thead>
                      <tr className="border-b border-gray-100">
                        {["Çalışan", "Departman", "Atanma Tarihi", "Görev Sayısı", "Durum"].map((h) => (
                          <th key={h} className="pb-3 text-left text-xs font-semibold text-gray-400 uppercase tracking-wide pr-4">{h}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-50">
                      {localCompany.assignments.map((a) => (
                        <tr key={a.id} className="hover:bg-gray-50/50">
                          <td className="py-3 pr-4">
                            <div className="flex items-center gap-2.5">
                              <div className="w-7 h-7 rounded-full bg-[#F57C28] flex items-center justify-center text-white text-[10px] font-bold flex-shrink-0">
                                {initials(a.user.name)}
                              </div>
                              <div>
                                <p className="font-medium text-gray-800">{a.user.name}</p>
                                <p className="text-xs text-gray-400">{a.user.email}</p>
                              </div>
                            </div>
                          </td>
                          <td className="py-3 pr-4 text-gray-600">{DEPT_LABELS[a.user.department] ?? a.user.department}</td>
                          <td className="py-3 pr-4 text-gray-500">{fmtDate(a.assignedAt)}</td>
                          <td className="py-3 pr-4">
                            <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${a.taskCount > 0 ? "bg-[#F57C28]/10 text-[#F57C28]" : "bg-gray-100 text-gray-400"}`}>
                              {a.taskCount} görev
                            </span>
                          </td>
                          <td className="py-3">
                            <span className="text-xs font-semibold px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-600">Aktif</span>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          )}

          {/* GÖREVLER */}
          {activeTab === "gorevler" && (
            <div className="space-y-6">
              {(["IN_PROGRESS", "REVIEW", "TODO", "DONE"] as const).map((status) => {
                const group = localCompany.tasks.filter((t) => t.status === status);
                if (group.length === 0) return null;
                return (
                  <div key={status}>
                    <div className="flex items-center gap-2 mb-3">
                      <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${STATUS_CLASS[status]}`}>
                        {STATUS_LABEL[status]}
                      </span>
                      <span className="text-xs text-gray-400">{group.length} görev</span>
                    </div>
                    <div className="overflow-x-auto">
                      <table className="w-full min-w-[560px] text-sm">
                        <thead>
                          <tr className="border-b border-gray-100">
                            {["Görev Adı", "Öncelik", "Atanan", "Oluşturulma", "Son Tarih"].map((h) => (
                              <th key={h} className="pb-2 text-left text-xs font-semibold text-gray-400 uppercase tracking-wide pr-4">{h}</th>
                            ))}
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-50">
                          {group.map((t) => (
                            <tr key={t.id} className="hover:bg-gray-50/50">
                              <td className="py-2.5 pr-4">
                                <span className="font-medium text-gray-800">{t.title}</span>
                                {isOverdue(t) && (
                                  <span className="ml-2 text-[10px] font-bold px-1.5 py-0.5 rounded-full bg-red-100 text-red-600">Gecikmiş</span>
                                )}
                              </td>
                              <td className="py-2.5 pr-4">
                                <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${PRIORITY_CLASS[t.priority]}`}>
                                  {PRIORITY_LABEL[t.priority] ?? t.priority}
                                </span>
                              </td>
                              <td className="py-2.5 pr-4 text-gray-500">{t.assignedTo?.name ?? "—"}</td>
                              <td className="py-2.5 pr-4 text-gray-400">{fmtDate(t.createdAt)}</td>
                              <td className={`py-2.5 text-sm ${isOverdue(t) ? "text-red-500 font-medium" : "text-gray-400"}`}>
                                {fmtDate(t.dueDate)}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                );
              })}
              {localCompany.tasks.length === 0 && (
                <p className="text-sm text-gray-400 py-10 text-center">Bu firmaya bağlı görev yok.</p>
              )}
            </div>
          )}

          {/* GRAFİKLER */}
          {activeTab === "grafikler" && (
            <div className="space-y-8">
              {/* Bar: Monthly completed */}
              <div>
                <p className="text-sm font-semibold text-gray-700 mb-4">Aylara Göre Tamamlanan Görev (Son 12 Ay)</p>
                <ResponsiveContainer width="100%" height={240}>
                  <BarChart data={stats.monthlyCompleted} margin={{ top: 4, right: 16, left: 0, bottom: 4 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#F3F4F6" />
                    <XAxis dataKey="month" tick={{ fontSize: 10 }} interval="preserveStartEnd" />
                    <YAxis allowDecimals={false} tick={{ fontSize: 10 }} />
                    <Tooltip />
                    <Bar dataKey="count" name="Tamamlanan" fill="#F57C28" radius={[4, 4, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                {/* Pie: Status distribution */}
                <div>
                  <p className="text-sm font-semibold text-gray-700 mb-4">Görev Durum Dağılımı</p>
                  <ResponsiveContainer width="100%" height={220}>
                    <PieChart>
                      <Pie data={stats.statusDist.filter((d) => d.count > 0)} dataKey="count"
                        nameKey="label" cx="50%" cy="50%" outerRadius={75} label={({ label, percent }) =>
                          percent > 0 ? `${label} ${(percent * 100).toFixed(0)}%` : ""
                        } labelLine={false}>
                        {stats.statusDist.map((entry) => (
                          <Cell key={entry.status} fill={entry.color} />
                        ))}
                      </Pie>
                      <Tooltip formatter={(val, name) => [`${val} görev`, name]} />
                      <Legend />
                    </PieChart>
                  </ResponsiveContainer>
                </div>

                {/* Line: Yearly tasks */}
                <div>
                  <p className="text-sm font-semibold text-gray-700 mb-4">Yıllara Göre İş Yoğunluğu</p>
                  {stats.yearlyTasks.length > 0 ? (
                    <ResponsiveContainer width="100%" height={220}>
                      <LineChart data={stats.yearlyTasks} margin={{ top: 4, right: 16, left: 0, bottom: 4 }}>
                        <CartesianGrid strokeDasharray="3 3" stroke="#F3F4F6" />
                        <XAxis dataKey="year" tick={{ fontSize: 11 }} />
                        <YAxis allowDecimals={false} tick={{ fontSize: 10 }} />
                        <Tooltip />
                        <Line type="monotone" dataKey="count" name="Görev Sayısı"
                          stroke="#F57C28" strokeWidth={2.5} dot={{ fill: "#F57C28", r: 4 }} />
                      </LineChart>
                    </ResponsiveContainer>
                  ) : (
                    <div className="h-[220px] flex items-center justify-center">
                      <p className="text-sm text-gray-400">Veri yok</p>
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}

          {/* AKTİVİTE */}
          {activeTab === "aktivite" && (
            <div className="relative">
              {timeline.length === 0 ? (
                <p className="text-sm text-gray-400 py-10 text-center">Aktivite bulunamadı.</p>
              ) : (
                <div className="space-y-0">
                  {timeline.map((event, i) => {
                    const isLast = i === timeline.length - 1;
                    let icon = "•";
                    let iconBg = "bg-gray-200";
                    let textColor = "text-gray-600";

                    if (event.type === "company_created") { icon = "🏢"; iconBg = "bg-orange-100"; }
                    else if (event.type === "assignment") { icon = "👤"; iconBg = "bg-indigo-100"; }
                    else if (event.type === "task_created") { icon = "📋"; iconBg = "bg-blue-100"; }
                    else if (event.type === "task_completed") { icon = "✅"; iconBg = "bg-emerald-100"; textColor = "text-emerald-700"; }

                    return (
                      <div key={i} className="flex gap-3 relative">
                        {/* Line */}
                        {!isLast && (
                          <div className="absolute left-[15px] top-8 w-0.5 bg-gray-100" style={{ height: "calc(100% - 8px)" }} />
                        )}
                        {/* Icon */}
                        <div className={`w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0 z-10 text-sm ${iconBg}`}>
                          {icon}
                        </div>
                        {/* Content */}
                        <div className="flex-1 pb-4">
                          <p className={`text-sm font-medium ${textColor}`}>
                            {event.type === "task_completed" ? `Tamamlandı: "${event.label}"` :
                              event.type === "task_created" ? `Görev oluşturuldu: "${event.label}"` :
                              event.label}
                          </p>
                          <div className="flex items-center gap-2 mt-0.5">
                            <p className="text-xs text-gray-400">{fmtDatetime(event.date)}</p>
                            {event.extra && (
                              <span className="text-xs text-gray-400">
                                · {event.type === "assignment" ? (DEPT_LABELS[event.extra] ?? event.extra) : event.extra}
                              </span>
                            )}
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Edit Modal */}
      {showEdit && (
        <div className="fixed inset-0 bg-black/40 backdrop-blur-sm flex items-end sm:items-center justify-center z-50 sm:p-4">
          <div className="bg-white w-full sm:max-w-lg rounded-t-2xl sm:rounded-2xl shadow-2xl flex flex-col max-h-[90vh]">
            <div className="flex items-center justify-between p-5 border-b border-gray-100 flex-shrink-0">
              <h2 className="text-base font-bold text-gray-900">Firma Düzenle</h2>
              <button onClick={() => setShowEdit(false)} className="p-2 rounded-xl text-gray-400 hover:bg-gray-100 transition-colors">
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
            <div className="overflow-y-auto p-5 space-y-4">
              <div>
                <label className="block text-xs font-semibold text-gray-500 mb-1.5 uppercase tracking-wide">Firma Adı *</label>
                <input type="text" value={form.name} onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))} className={inputClass} />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-gray-500 mb-1.5 uppercase tracking-wide">Vergi No</label>
                  <input type="text" value={form.taxNumber} onChange={(e) => setForm((f) => ({ ...f, taxNumber: e.target.value }))} className={inputClass} />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-gray-500 mb-1.5 uppercase tracking-wide">Sektör</label>
                  <input type="text" value={form.sector} onChange={(e) => setForm((f) => ({ ...f, sector: e.target.value }))} className={inputClass} />
                </div>
              </div>
              <div>
                <label className="block text-xs font-semibold text-gray-500 mb-1.5 uppercase tracking-wide">Başlangıç Tarihi</label>
                <input type="date" value={form.startDate} onChange={(e) => setForm((f) => ({ ...f, startDate: e.target.value }))} className={inputClass} />
              </div>
              <div>
                <label className="block text-xs font-semibold text-gray-500 mb-1.5 uppercase tracking-wide">Notlar</label>
                <textarea value={form.notes} onChange={(e) => setForm((f) => ({ ...f, notes: e.target.value }))} rows={3}
                  className={`${inputClass} resize-none`} />
              </div>
              <div>
                <label className="block text-xs font-semibold text-gray-500 mb-1.5 uppercase tracking-wide">Firma Hakkında</label>
                <textarea value={form.about} onChange={(e) => setForm((f) => ({ ...f, about: e.target.value }))}
                  style={{ minHeight: "150px" }} className={`${inputClass} resize-y`}
                  placeholder="Firma hakkında detaylı bilgi girin..." />
              </div>
              {formError && <p className="text-sm text-red-500">{formError}</p>}
            </div>
            <div className="p-5 border-t border-gray-100 flex gap-2 flex-shrink-0">
              <button onClick={() => setShowEdit(false)}
                className="flex-1 px-4 py-2.5 rounded-xl border border-gray-200 text-sm text-gray-600 hover:bg-gray-50 transition-colors font-medium">
                İptal
              </button>
              <button onClick={handleEditSave} disabled={submitting}
                className="flex-1 px-4 py-2.5 rounded-xl bg-[#F57C28] hover:bg-[#D96A1A] disabled:opacity-60 text-white text-sm font-semibold transition-colors shadow-md shadow-[#F57C28]/25">
                {submitting ? "Kaydediliyor..." : "Güncelle"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
