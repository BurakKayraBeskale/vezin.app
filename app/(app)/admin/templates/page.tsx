"use client";

import { useEffect, useState, FormEvent } from "react";
import { useSession } from "next-auth/react";
import { useRouter } from "next/navigation";
import clsx from "clsx";

interface Template {
  id: string;
  title: string;
  description: string | null;
  priority: string;
  estimatedDays: number | null;
  department: string | null;
  createdBy: { id: string; name: string };
  createdAt: string;
}

const PRIORITY_LABELS: Record<string, { label: string; cls: string }> = {
  HIGH:   { label: "Yüksek", cls: "bg-red-50 text-red-600 border border-red-200" },
  MEDIUM: { label: "Orta",   cls: "bg-orange-50 text-orange-500 border border-orange-200" },
  LOW:    { label: "Düşük",  cls: "bg-gray-100 text-gray-500" },
};

const DEPT_LABELS: Record<string, string> = {
  OUTSOURCE: "Outsource",
  BAGIMSIZ_DENETIM: "Bağımsız Denetim",
  MUHASEBE: "Muhasebe",
  YEMINLI_MALI_MUSAVIR: "YMM",
  ADMIN: "Yönetim",
};

interface FormState {
  title: string;
  description: string;
  priority: string;
  estimatedDays: string;
  department: string;
}

const EMPTY: FormState = { title: "", description: "", priority: "MEDIUM", estimatedDays: "", department: "" };

export default function TemplatesPage() {
  const { data: session, status } = useSession();
  const router = useRouter();
  const [templates, setTemplates] = useState<Template[]>([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [editing, setEditing] = useState<Template | null>(null);
  const [form, setForm] = useState<FormState>(EMPTY);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [deleting, setDeleting] = useState<string | null>(null);

  useEffect(() => {
    if (status === "loading") return;
    const role = (session?.user as any)?.role;
    if (role !== "ADMIN" && role !== "MANAGER") { router.replace("/"); return; }
    fetch("/api/templates")
      .then((r) => r.json())
      .then((d) => { setTemplates(d); setLoading(false); });
  }, [session, status]);

  function openCreate() {
    setEditing(null);
    setForm(EMPTY);
    setError("");
    setShowModal(true);
  }

  function openEdit(t: Template) {
    setEditing(t);
    setForm({
      title: t.title,
      description: t.description ?? "",
      priority: t.priority,
      estimatedDays: t.estimatedDays?.toString() ?? "",
      department: t.department ?? "",
    });
    setError("");
    setShowModal(true);
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    if (!form.title.trim()) { setError("Başlık zorunlu"); return; }
    setSaving(true);
    setError("");
    const payload = {
      title: form.title,
      description: form.description || null,
      priority: form.priority,
      estimatedDays: form.estimatedDays ? Number(form.estimatedDays) : null,
      department: form.department || null,
    };
    try {
      let res: Response;
      if (editing) {
        res = await fetch(`/api/templates/${editing.id}`, {
          method: "PATCH", headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        });
      } else {
        res = await fetch("/api/templates", {
          method: "POST", headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        });
      }
      if (!res.ok) { const d = await res.json(); setError(d.error || "Hata"); return; }
      const result = await res.json();
      if (editing) {
        setTemplates((prev) => prev.map((t) => t.id === result.id ? result : t));
      } else {
        setTemplates((prev) => [result, ...prev]);
      }
      setShowModal(false);
    } catch { setError("Sunucu hatası"); }
    finally { setSaving(false); }
  }

  async function handleDelete(id: string) {
    if (!confirm("Bu şablonu silmek istediğinizden emin misiniz?")) return;
    setDeleting(id);
    try {
      await fetch(`/api/templates/${id}`, { method: "DELETE" });
      setTemplates((prev) => prev.filter((t) => t.id !== id));
    } finally { setDeleting(null); }
  }

  function fmtDate(d: string) {
    return new Date(d).toLocaleDateString("tr-TR", { day: "numeric", month: "short", year: "numeric" });
  }

  return (
    <div className="max-w-5xl mx-auto">
      <div className="flex items-center justify-between mb-6 gap-3 flex-wrap">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold text-gray-800">Görev Şablonları</h1>
          <p className="text-sm text-gray-400 mt-1">{templates.length} şablon · Tekrar eden görevler için hızlı oluşturma</p>
        </div>
        <button onClick={openCreate}
          className="flex items-center gap-2 bg-[#F57C28] hover:bg-[#D96A1A] text-white text-sm font-semibold px-4 py-2.5 rounded-xl shadow-md shadow-[#F57C28]/25 transition-colors">
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
          </svg>
          Yeni Şablon
        </button>
      </div>

      {loading ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {[...Array(6)].map((_, i) => (
            <div key={i} className="bg-white rounded-2xl border border-gray-100 shadow-sm h-40 animate-pulse" />
          ))}
        </div>
      ) : templates.length === 0 ? (
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm py-20 text-center">
          <div className="w-12 h-12 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-3">
            <svg className="w-6 h-6 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M8 7v8a2 2 0 002 2h6M8 7V5a2 2 0 012-2h4.586a1 1 0 01.707.293l4.414 4.414a1 1 0 01.293.707V15a2 2 0 01-2 2h-2M8 7H6a2 2 0 00-2 2v10a2 2 0 002 2h8a2 2 0 002-2v-2" />
            </svg>
          </div>
          <p className="text-gray-400 text-sm">Henüz şablon yok</p>
          <button onClick={openCreate} className="mt-3 text-sm text-[#F57C28] hover:underline font-medium">
            İlk şablonu oluştur
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {templates.map((t) => {
            const p = PRIORITY_LABELS[t.priority] ?? PRIORITY_LABELS.MEDIUM;
            return (
              <div key={t.id} className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5 flex flex-col gap-3 hover:shadow-md transition-shadow">
                <div className="flex items-start justify-between gap-2">
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-bold text-gray-800 leading-snug">{t.title}</p>
                    {t.description && (
                      <p className="text-xs text-gray-400 mt-1 line-clamp-2">{t.description}</p>
                    )}
                  </div>
                  <span className={clsx("text-[10px] font-semibold px-1.5 py-0.5 rounded-full whitespace-nowrap flex-shrink-0", p.cls)}>
                    {p.label}
                  </span>
                </div>
                <div className="flex items-center gap-2 flex-wrap">
                  {t.estimatedDays && (
                    <span className="text-[10px] bg-indigo-50 text-indigo-600 font-semibold px-2 py-0.5 rounded-full">
                      ~{t.estimatedDays} gün
                    </span>
                  )}
                  {t.department && (
                    <span className="text-[10px] bg-gray-100 text-gray-500 font-semibold px-2 py-0.5 rounded-full">
                      {DEPT_LABELS[t.department] ?? t.department}
                    </span>
                  )}
                </div>
                <div className="flex items-center justify-between mt-auto pt-2 border-t border-gray-50">
                  <p className="text-[10px] text-gray-400">{t.createdBy.name} · {fmtDate(t.createdAt)}</p>
                  <div className="flex items-center gap-1">
                    <button onClick={() => openEdit(t)}
                      className="p-1.5 rounded-lg text-gray-400 hover:text-[#F57C28] hover:bg-orange-50 transition-colors">
                      <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                      </svg>
                    </button>
                    <button onClick={() => handleDelete(t.id)} disabled={deleting === t.id}
                      className="p-1.5 rounded-lg text-gray-400 hover:text-red-500 hover:bg-red-50 transition-colors disabled:opacity-50">
                      <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                      </svg>
                    </button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {showModal && (
        <div className="fixed inset-0 bg-black/40 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg">
            <div className="flex items-center justify-between p-6 border-b border-gray-100">
              <h2 className="text-lg font-bold text-gray-800">{editing ? "Şablonu Düzenle" : "Yeni Şablon"}</h2>
              <button onClick={() => setShowModal(false)} className="p-2 rounded-xl text-gray-400 hover:bg-gray-100 transition-colors">
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
            <form onSubmit={handleSubmit} className="p-6 space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1.5">Başlık *</label>
                <input required value={form.title} onChange={(e) => setForm((f) => ({ ...f, title: e.target.value }))}
                  placeholder="Şablon başlığı"
                  className="w-full px-3.5 py-2.5 rounded-xl border border-gray-200 text-sm text-gray-800 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-[#F57C28]/30 focus:border-[#F57C28]" />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1.5">Açıklama</label>
                <textarea rows={2} value={form.description} onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))}
                  placeholder="Görev detayları..."
                  className="w-full px-3.5 py-2.5 rounded-xl border border-gray-200 text-sm text-gray-800 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-[#F57C28]/30 focus:border-[#F57C28] resize-none" />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1.5">Öncelik</label>
                  <select value={form.priority} onChange={(e) => setForm((f) => ({ ...f, priority: e.target.value }))}
                    className="w-full px-3 py-2.5 rounded-xl border border-gray-200 text-sm text-gray-700 focus:outline-none focus:ring-2 focus:ring-[#F57C28]/30 focus:border-[#F57C28] bg-white">
                    <option value="HIGH">Yüksek</option>
                    <option value="MEDIUM">Orta</option>
                    <option value="LOW">Düşük</option>
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1.5">Tahmini Gün</label>
                  <input type="number" min="1" value={form.estimatedDays}
                    onChange={(e) => setForm((f) => ({ ...f, estimatedDays: e.target.value }))}
                    placeholder="Örn: 3"
                    className="w-full px-3 py-2.5 rounded-xl border border-gray-200 text-sm text-gray-700 focus:outline-none focus:ring-2 focus:ring-[#F57C28]/30 focus:border-[#F57C28]" />
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1.5">Departman</label>
                <select value={form.department} onChange={(e) => setForm((f) => ({ ...f, department: e.target.value }))}
                  className="w-full px-3 py-2.5 rounded-xl border border-gray-200 text-sm text-gray-700 focus:outline-none focus:ring-2 focus:ring-[#F57C28]/30 focus:border-[#F57C28] bg-white">
                  <option value="">— Tüm Departmanlar —</option>
                  {Object.entries(DEPT_LABELS).map(([v, l]) => <option key={v} value={v}>{l}</option>)}
                </select>
              </div>
              {error && (
                <div className="bg-red-50 border border-red-200 text-red-600 text-sm rounded-xl px-4 py-2.5">{error}</div>
              )}
              <div className="flex gap-3 pt-1">
                <button type="button" onClick={() => setShowModal(false)}
                  className="flex-1 px-4 py-2.5 rounded-xl border border-gray-200 text-sm font-medium text-gray-600 hover:bg-gray-50 transition-colors">
                  İptal
                </button>
                <button type="submit" disabled={saving}
                  className="flex-1 px-4 py-2.5 rounded-xl bg-[#F57C28] hover:bg-[#D96A1A] disabled:opacity-60 text-white text-sm font-semibold transition-colors shadow-md shadow-[#F57C28]/25">
                  {saving ? "Kaydediliyor..." : editing ? "Güncelle" : "Oluştur"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
