"use client";

import { useState } from "react";

interface User {
  id: string;
  name: string;
  email: string;
}

interface Assignment {
  id: string;
  userId: string;
  assignedAt: string;
  user: User;
}

interface Company {
  id: string;
  name: string;
  taxNumber: string | null;
  sector: string | null;
  startDate: string | null;
  notes: string | null;
  createdAt: string;
  assignments: Assignment[];
}

interface Props {
  initialCompanies: Company[];
  users: User[];
  canManage: boolean;
  role: string;
}

function initials(name: string) {
  return name.split(" ").map((n) => n[0]).join("").toUpperCase().slice(0, 2);
}

function yearsWorking(startDate: string | null): number {
  if (!startDate) return 0;
  return (Date.now() - new Date(startDate).getTime()) / (1000 * 60 * 60 * 24 * 365.25);
}

function formatDate(d: string | null): string {
  if (!d) return "—";
  return new Date(d).toLocaleDateString("tr-TR", { day: "numeric", month: "short", year: "numeric" });
}

const EMPTY_FORM = { name: "", taxNumber: "", sector: "", startDate: "", notes: "" };

export default function CompanyList({ initialCompanies, users, canManage, role }: Props) {
  const [companies, setCompanies] = useState<Company[]>(initialCompanies);
  const [search, setSearch] = useState("");
  const [showForm, setShowForm] = useState(false);
  const [editingCompany, setEditingCompany] = useState<Company | null>(null);
  const [form, setForm] = useState(EMPTY_FORM);
  const [submitting, setSubmitting] = useState(false);
  const [formError, setFormError] = useState("");

  // Assign modal
  const [assigningCompany, setAssigningCompany] = useState<Company | null>(null);
  const [assignLoading, setAssignLoading] = useState<string | null>(null);

  // Delete confirm
  const [deletingId, setDeletingId] = useState<string | null>(null);

  // Toast
  const [toast, setToast] = useState("");

  function showToast(msg: string) {
    setToast(msg);
    setTimeout(() => setToast(""), 2500);
  }

  function openCreate() {
    setEditingCompany(null);
    setForm(EMPTY_FORM);
    setFormError("");
    setShowForm(true);
  }

  function openEdit(c: Company) {
    setEditingCompany(c);
    setForm({
      name: c.name,
      taxNumber: c.taxNumber ?? "",
      sector: c.sector ?? "",
      startDate: c.startDate ? c.startDate.slice(0, 10) : "",
      notes: c.notes ?? "",
    });
    setFormError("");
    setShowForm(true);
  }

  async function handleSubmit() {
    if (!form.name.trim()) { setFormError("Firma adı zorunlu"); return; }
    setSubmitting(true);
    setFormError("");
    try {
      const payload = {
        name: form.name.trim(),
        taxNumber: form.taxNumber.trim() || null,
        sector: form.sector.trim() || null,
        startDate: form.startDate || null,
        notes: form.notes.trim() || null,
      };
      let res: Response;
      if (editingCompany) {
        res = await fetch(`/api/companies/${editingCompany.id}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        });
      } else {
        res = await fetch("/api/companies", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        });
      }
      if (!res.ok) {
        const err = await res.json();
        setFormError(err.error ?? "Hata oluştu");
        return;
      }
      const updated: Company = await res.json();
      if (editingCompany) {
        setCompanies((prev) => prev.map((c) => c.id === updated.id ? updated : c));
        showToast("Firma güncellendi");
      } else {
        setCompanies((prev) => [...prev, updated].sort((a, b) => a.name.localeCompare(b.name, "tr")));
        showToast("Firma eklendi");
      }
      setShowForm(false);
    } catch {
      setFormError("Bir hata oluştu");
    } finally {
      setSubmitting(false);
    }
  }

  async function handleDelete(id: string) {
    try {
      await fetch(`/api/companies/${id}`, { method: "DELETE" });
      setCompanies((prev) => prev.filter((c) => c.id !== id));
      setDeletingId(null);
      showToast("Firma silindi");
    } catch {
      showToast("Silinemedi");
    }
  }

  async function toggleAssign(companyId: string, userId: string, isAssigned: boolean) {
    setAssignLoading(userId);
    try {
      const res = await fetch(`/api/companies/${companyId}/assign`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userId, remove: isAssigned }),
      });
      if (!res.ok) { showToast("İşlem başarısız"); return; }
      const updated: Company = await res.json();
      setCompanies((prev) => prev.map((c) => c.id === updated.id ? updated : c));
      if (assigningCompany?.id === updated.id) setAssigningCompany(updated);
    } catch {
      showToast("Hata oluştu");
    } finally {
      setAssignLoading(null);
    }
  }

  function downloadPdf(company: Company) {
    // Dynamic import for jsPDF
    import("jspdf").then(({ default: jsPDF }) => {
      import("jspdf-autotable").then(({ default: autoTable }) => {
        const doc = new jsPDF();
        doc.setFontSize(16);
        doc.setFont("helvetica", "bold");
        doc.text(company.name, 14, 20);
        doc.setFontSize(10);
        doc.setFont("helvetica", "normal");
        doc.setTextColor(120);
        doc.text(`Vergi No: ${company.taxNumber ?? "—"}`, 14, 30);
        doc.text(`Sektör: ${company.sector ?? "—"}`, 14, 36);
        doc.text(`Başlangıç Tarihi: ${formatDate(company.startDate)}`, 14, 42);
        if (company.notes) {
          doc.text(`Notlar: ${company.notes}`, 14, 48);
        }
        doc.setTextColor(0);

        autoTable(doc, {
          startY: company.notes ? 56 : 50,
          head: [["Atanan Kullanıcı", "E-posta", "Atanma Tarihi"]],
          body: company.assignments.map((a) => [
            a.user.name,
            a.user.email,
            formatDate(a.assignedAt),
          ]),
          headStyles: { fillColor: [245, 124, 40] },
          styles: { fontSize: 9 },
        });

        doc.save(`${company.name.replace(/\s+/g, "_")}.pdf`);
      });
    });
  }

  function downloadExcel(company: Company) {
    import("xlsx").then((XLSX) => {
      const info = [
        ["Firma Adı", company.name],
        ["Vergi No", company.taxNumber ?? ""],
        ["Sektör", company.sector ?? ""],
        ["Başlangıç Tarihi", formatDate(company.startDate)],
        ["Notlar", company.notes ?? ""],
        [],
        ["Atanan Kullanıcılar"],
        ["Ad Soyad", "E-posta", "Atanma Tarihi"],
        ...company.assignments.map((a) => [a.user.name, a.user.email, formatDate(a.assignedAt)]),
      ];
      const ws = XLSX.utils.aoa_to_sheet(info);
      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, ws, "Firma");
      XLSX.writeFile(wb, `${company.name.replace(/\s+/g, "_")}.xlsx`);
    });
  }

  const filtered = companies.filter(
    (c) =>
      c.name.toLowerCase().includes(search.toLowerCase()) ||
      (c.sector ?? "").toLowerCase().includes(search.toLowerCase()) ||
      (c.taxNumber ?? "").includes(search)
  );

  return (
    <div className="max-w-6xl mx-auto">
      {/* Page header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-6">
        <div>
          <h1 className="text-xl font-bold text-gray-900 dark:text-white">Firmalar</h1>
          <p className="text-sm text-gray-500 dark:text-gray-400 mt-0.5">
            {companies.length} firma kayıtlı
          </p>
        </div>
        <div className="flex items-center gap-2">
          <input
            type="search"
            placeholder="Firma ara..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="px-3 py-2 rounded-xl border border-gray-200 dark:border-gray-700 text-sm bg-white dark:bg-gray-800 text-gray-700 dark:text-gray-200 focus:outline-none focus:ring-2 focus:ring-[#F57C28]/30 focus:border-[#F57C28] w-48"
          />
          {canManage && (
            <button
              onClick={openCreate}
              className="flex items-center gap-2 bg-[#F57C28] hover:bg-[#D96A1A] text-white text-sm font-semibold px-4 py-2 rounded-xl transition-colors shadow-md shadow-[#F57C28]/25 whitespace-nowrap"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
              </svg>
              Firma Ekle
            </button>
          )}
        </div>
      </div>

      {/* Company grid */}
      {filtered.length === 0 ? (
        <div className="py-20 text-center">
          <p className="text-gray-400 text-sm">
            {search ? "Arama sonucu bulunamadı" : "Henüz firma eklenmemiş"}
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {filtered.map((company) => {
            const years = yearsWorking(company.startDate);
            const isFiveYears = years >= 5;
            return (
              <div
                key={company.id}
                className="bg-white dark:bg-gray-800 rounded-2xl border border-gray-200 dark:border-gray-700 shadow-sm hover:shadow-md transition-shadow p-4 flex flex-col gap-3"
              >
                {/* Card header */}
                <div className="flex items-start justify-between gap-2">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <h2 className="text-sm font-bold text-gray-900 dark:text-white truncate">
                        {company.name}
                      </h2>
                      {isFiveYears && (
                        <span className="inline-flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-full bg-amber-100 text-amber-700 border border-amber-200 flex-shrink-0">
                          ⭐ 5+ Yıl
                        </span>
                      )}
                    </div>
                    {company.sector && (
                      <p className="text-xs text-gray-400 mt-0.5">{company.sector}</p>
                    )}
                  </div>
                </div>

                {/* Info rows */}
                <div className="space-y-1 text-xs text-gray-500 dark:text-gray-400">
                  {company.taxNumber && (
                    <div className="flex items-center gap-1.5">
                      <svg className="w-3 h-3 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                      </svg>
                      <span>VKN: {company.taxNumber}</span>
                    </div>
                  )}
                  {company.startDate && (
                    <div className="flex items-center gap-1.5">
                      <svg className="w-3 h-3 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                      </svg>
                      <span>{formatDate(company.startDate)} · {Math.floor(years)} yıldır</span>
                    </div>
                  )}
                </div>

                {/* Assignees */}
                <div>
                  <p className="text-[10px] font-semibold text-gray-400 uppercase tracking-wide mb-1.5">Atanan Kişiler</p>
                  {company.assignments.length === 0 ? (
                    <p className="text-xs text-gray-300 dark:text-gray-600">Kimse atanmamış</p>
                  ) : (
                    <div className="flex items-center">
                      {company.assignments.slice(0, 4).map((a, i) => (
                        <div
                          key={a.userId}
                          title={a.user.name}
                          style={{ marginLeft: i === 0 ? 0 : -6 }}
                          className="w-6 h-6 rounded-full bg-[#F57C28] border-2 border-white dark:border-gray-800 flex items-center justify-center text-white text-[8px] font-bold flex-shrink-0 z-0"
                        >
                          {initials(a.user.name)}
                        </div>
                      ))}
                      {company.assignments.length > 4 && (
                        <div
                          style={{ marginLeft: -6 }}
                          className="w-6 h-6 rounded-full bg-gray-200 dark:bg-gray-600 border-2 border-white dark:border-gray-800 flex items-center justify-center text-gray-600 dark:text-gray-300 text-[8px] font-bold flex-shrink-0"
                        >
                          +{company.assignments.length - 4}
                        </div>
                      )}
                    </div>
                  )}
                </div>

                {/* Notes */}
                {company.notes && (
                  <p className="text-xs text-gray-400 italic line-clamp-2 border-t border-gray-100 dark:border-gray-700 pt-2">
                    {company.notes}
                  </p>
                )}

                {/* Actions */}
                <div className="flex items-center gap-1.5 pt-1 border-t border-gray-100 dark:border-gray-700 flex-wrap">
                  <button
                    onClick={() => downloadPdf(company)}
                    className="flex items-center gap-1 text-xs text-red-500 hover:text-red-600 font-medium px-2 py-1 rounded-lg hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors"
                    title="PDF İndir"
                  >
                    <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                    </svg>
                    PDF
                  </button>
                  <button
                    onClick={() => downloadExcel(company)}
                    className="flex items-center gap-1 text-xs text-emerald-600 hover:text-emerald-700 font-medium px-2 py-1 rounded-lg hover:bg-emerald-50 dark:hover:bg-emerald-900/20 transition-colors"
                    title="Excel İndir"
                  >
                    <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                    </svg>
                    Excel
                  </button>
                  {canManage && (
                    <>
                      <button
                        onClick={() => setAssigningCompany(company)}
                        className="flex items-center gap-1 text-xs text-indigo-500 hover:text-indigo-600 font-medium px-2 py-1 rounded-lg hover:bg-indigo-50 dark:hover:bg-indigo-900/20 transition-colors"
                      >
                        <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
                          <path strokeLinecap="round" strokeLinejoin="round" d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                        </svg>
                        Ata
                      </button>
                      <button
                        onClick={() => openEdit(company)}
                        className="flex items-center gap-1 text-xs text-gray-500 hover:text-gray-700 font-medium px-2 py-1 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
                      >
                        <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
                          <path strokeLinecap="round" strokeLinejoin="round" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                        </svg>
                        Düzenle
                      </button>
                      {role === "ADMIN" && (
                        <button
                          onClick={() => setDeletingId(company.id)}
                          className="flex items-center gap-1 text-xs text-red-400 hover:text-red-500 font-medium px-2 py-1 rounded-lg hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors ml-auto"
                        >
                          <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
                            <path strokeLinecap="round" strokeLinejoin="round" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                          </svg>
                          Sil
                        </button>
                      )}
                    </>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Create/Edit Modal */}
      {showForm && (
        <div className="fixed inset-0 bg-black/40 backdrop-blur-sm flex items-end sm:items-center justify-center z-50 sm:p-4">
          <div className="bg-white dark:bg-gray-900 w-full sm:max-w-lg rounded-t-2xl sm:rounded-2xl shadow-2xl flex flex-col max-h-[90vh]">
            <div className="flex items-center justify-between p-5 border-b border-gray-100 dark:border-gray-800 flex-shrink-0">
              <h2 className="text-base font-bold text-gray-900 dark:text-white">
                {editingCompany ? "Firma Düzenle" : "Yeni Firma"}
              </h2>
              <button
                onClick={() => setShowForm(false)}
                className="p-2 rounded-xl text-gray-400 hover:text-gray-600 hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
            <div className="overflow-y-auto p-5 space-y-4">
              <div>
                <label className="block text-xs font-semibold text-gray-500 mb-1.5 uppercase tracking-wide">
                  Firma Adı <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  value={form.name}
                  onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
                  placeholder="Firma adı"
                  className="w-full px-3 py-2.5 rounded-xl border border-gray-200 dark:border-gray-700 text-sm text-gray-700 dark:text-gray-200 bg-white dark:bg-gray-800 focus:outline-none focus:ring-2 focus:ring-[#F57C28]/30 focus:border-[#F57C28]"
                />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-gray-500 mb-1.5 uppercase tracking-wide">Vergi No</label>
                  <input
                    type="text"
                    value={form.taxNumber}
                    onChange={(e) => setForm((f) => ({ ...f, taxNumber: e.target.value }))}
                    placeholder="1234567890"
                    className="w-full px-3 py-2.5 rounded-xl border border-gray-200 dark:border-gray-700 text-sm text-gray-700 dark:text-gray-200 bg-white dark:bg-gray-800 focus:outline-none focus:ring-2 focus:ring-[#F57C28]/30 focus:border-[#F57C28]"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-gray-500 mb-1.5 uppercase tracking-wide">Sektör</label>
                  <input
                    type="text"
                    value={form.sector}
                    onChange={(e) => setForm((f) => ({ ...f, sector: e.target.value }))}
                    placeholder="Örn: İnşaat"
                    className="w-full px-3 py-2.5 rounded-xl border border-gray-200 dark:border-gray-700 text-sm text-gray-700 dark:text-gray-200 bg-white dark:bg-gray-800 focus:outline-none focus:ring-2 focus:ring-[#F57C28]/30 focus:border-[#F57C28]"
                  />
                </div>
              </div>
              <div>
                <label className="block text-xs font-semibold text-gray-500 mb-1.5 uppercase tracking-wide">Çalışma Başlangıç Tarihi</label>
                <input
                  type="date"
                  value={form.startDate}
                  onChange={(e) => setForm((f) => ({ ...f, startDate: e.target.value }))}
                  className="w-full px-3 py-2.5 rounded-xl border border-gray-200 dark:border-gray-700 text-sm text-gray-700 dark:text-gray-200 bg-white dark:bg-gray-800 focus:outline-none focus:ring-2 focus:ring-[#F57C28]/30 focus:border-[#F57C28]"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-gray-500 mb-1.5 uppercase tracking-wide">Notlar</label>
                <textarea
                  value={form.notes}
                  onChange={(e) => setForm((f) => ({ ...f, notes: e.target.value }))}
                  placeholder="Firma hakkında notlar..."
                  rows={3}
                  className="w-full px-3 py-2.5 rounded-xl border border-gray-200 dark:border-gray-700 text-sm text-gray-700 dark:text-gray-200 bg-white dark:bg-gray-800 focus:outline-none focus:ring-2 focus:ring-[#F57C28]/30 focus:border-[#F57C28] resize-none"
                />
              </div>
              {formError && (
                <p className="text-sm text-red-500 font-medium">{formError}</p>
              )}
            </div>
            <div className="p-5 border-t border-gray-100 dark:border-gray-800 flex gap-2 flex-shrink-0">
              <button
                onClick={() => setShowForm(false)}
                className="flex-1 px-4 py-2.5 rounded-xl border border-gray-200 dark:border-gray-700 text-sm text-gray-600 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors font-medium"
              >
                İptal
              </button>
              <button
                onClick={handleSubmit}
                disabled={submitting}
                className="flex-1 px-4 py-2.5 rounded-xl bg-[#F57C28] hover:bg-[#D96A1A] disabled:opacity-60 text-white text-sm font-semibold transition-colors shadow-md shadow-[#F57C28]/25"
              >
                {submitting ? "Kaydediliyor..." : editingCompany ? "Güncelle" : "Ekle"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Assign Modal */}
      {assigningCompany && (
        <div className="fixed inset-0 bg-black/40 backdrop-blur-sm flex items-end sm:items-center justify-center z-50 sm:p-4">
          <div className="bg-white dark:bg-gray-900 w-full sm:max-w-md rounded-t-2xl sm:rounded-2xl shadow-2xl flex flex-col max-h-[80vh]">
            <div className="flex items-center justify-between p-5 border-b border-gray-100 dark:border-gray-800 flex-shrink-0">
              <div>
                <h2 className="text-base font-bold text-gray-900 dark:text-white">Kullanıcı Ata</h2>
                <p className="text-xs text-gray-400 mt-0.5">{assigningCompany.name}</p>
              </div>
              <button
                onClick={() => setAssigningCompany(null)}
                className="p-2 rounded-xl text-gray-400 hover:text-gray-600 hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
            <div className="overflow-y-auto p-3 flex-1">
              {users.length === 0 && (
                <p className="text-sm text-gray-400 text-center py-6">Atanabilecek kullanıcı yok</p>
              )}
              {users.map((u) => {
                const isAssigned = assigningCompany.assignments.some((a) => a.userId === u.id);
                return (
                  <label
                    key={u.id}
                    className="flex items-center gap-3 px-3 py-2.5 rounded-xl hover:bg-gray-50 dark:hover:bg-gray-800 cursor-pointer transition-colors"
                  >
                    <input
                      type="checkbox"
                      checked={isAssigned}
                      disabled={assignLoading === u.id}
                      onChange={() => toggleAssign(assigningCompany.id, u.id, isAssigned)}
                      className="w-4 h-4 rounded accent-[#F57C28]"
                    />
                    <div className="w-7 h-7 rounded-full bg-[#F57C28] flex items-center justify-center text-white text-[10px] font-bold flex-shrink-0">
                      {initials(u.name)}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-gray-700 dark:text-gray-200">{u.name}</p>
                      <p className="text-xs text-gray-400 truncate">{u.email}</p>
                    </div>
                    {assignLoading === u.id && (
                      <div className="w-4 h-4 border-2 border-[#F57C28] border-t-transparent rounded-full animate-spin flex-shrink-0" />
                    )}
                  </label>
                );
              })}
            </div>
          </div>
        </div>
      )}

      {/* Delete confirm */}
      {deletingId && (
        <div className="fixed inset-0 bg-black/40 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-white dark:bg-gray-900 w-full max-w-sm rounded-2xl shadow-2xl p-6">
            <h3 className="text-base font-bold text-gray-900 dark:text-white mb-2">Firmayı Sil</h3>
            <p className="text-sm text-gray-500 dark:text-gray-400 mb-5">
              Bu firmayı silmek istediğinizden emin misiniz? Bu işlem geri alınamaz.
            </p>
            <div className="flex gap-2">
              <button
                onClick={() => setDeletingId(null)}
                className="flex-1 px-4 py-2.5 rounded-xl border border-gray-200 dark:border-gray-700 text-sm text-gray-600 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors font-medium"
              >
                İptal
              </button>
              <button
                onClick={() => handleDelete(deletingId)}
                className="flex-1 px-4 py-2.5 rounded-xl bg-red-500 hover:bg-red-600 text-white text-sm font-semibold transition-colors"
              >
                Sil
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Toast */}
      {toast && (
        <div className="fixed bottom-6 left-1/2 -translate-x-1/2 bg-gray-800 text-white text-xs font-medium px-4 py-2 rounded-full shadow-lg whitespace-nowrap z-50">
          {toast}
        </div>
      )}
    </div>
  );
}
