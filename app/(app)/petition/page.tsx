"use client";

import { useEffect, useState } from "react";
import { useSession } from "next-auth/react";
import clsx from "clsx";

type Category = "SUGGESTION" | "COMPLAINT" | "PETITION" | "SITE_SUGGESTION";

interface Petition {
  id: string;
  category: Category;
  message: string;
  isAnonymous: boolean;
  isRead: boolean;
  createdAt: string;
  user?: { id: string; name: string } | null;
}

const CATEGORY_LABELS: Record<Category, string> = {
  SUGGESTION: "Öneri",
  COMPLAINT: "Şikayet",
  PETITION: "Dilekçe",
  SITE_SUGGESTION: "Site Önerisi",
};

const CATEGORY_COLORS: Record<Category, { bg: string; text: string; border: string }> = {
  SUGGESTION:      { bg: "var(--badge-indigo-bg)",   text: "var(--badge-indigo-text)",   border: "var(--badge-indigo-border)" },
  COMPLAINT:       { bg: "var(--badge-red-bg)",      text: "var(--badge-red-text)",      border: "var(--badge-red-border)" },
  PETITION:        { bg: "var(--badge-orange-bg)",   text: "var(--badge-orange-text)",   border: "var(--badge-orange-border)" },
  SITE_SUGGESTION: { bg: "var(--badge-emerald-bg)",  text: "var(--badge-emerald-text)",  border: "var(--badge-emerald-border)" },
};

function CategoryBadge({ category }: { category: Category }) {
  const c = CATEGORY_COLORS[category];
  return (
    <span
      className="inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-semibold border"
      style={{ backgroundColor: c.bg, color: c.text, borderColor: c.border }}
    >
      {CATEGORY_LABELS[category]}
    </span>
  );
}

function timeAgo(dateStr: string) {
  const diff = Date.now() - new Date(dateStr).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return "Az önce";
  if (mins < 60) return `${mins} dk önce`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs} sa önce`;
  return new Date(dateStr).toLocaleDateString("tr-TR");
}

export default function PetitionPage() {
  const { data: session } = useSession();
  const isAdmin = session?.user.role === "ADMIN";

  const [petitions, setPetitions] = useState<Petition[]>([]);
  const [loading, setLoading] = useState(true);

  // Form state
  const [category, setCategory] = useState<Category>("SUGGESTION");
  const [message, setMessage] = useState("");
  const [isAnonymous, setIsAnonymous] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [success, setSuccess] = useState(false);
  const [deleting, setDeleting] = useState<string | null>(null);

  // Admin filter
  const [filterCategory, setFilterCategory] = useState<Category | "ALL">("ALL");
  const [filterRead, setFilterRead] = useState<"ALL" | "UNREAD" | "READ">("ALL");

  useEffect(() => {
    fetch("/api/petitions")
      .then((r) => r.json())
      .then((data) => {
        setPetitions(data);
        setLoading(false);
      });
  }, []);

  // Admin: sayfa yüklenince tüm dilekçeleri okundu işaretle
  useEffect(() => {
    if (!isAdmin || loading) return;
    fetch("/api/petitions/read-all", { method: "PATCH" }).then(() => {
      setPetitions((prev) => prev.map((p) => ({ ...p, isRead: true })));
    });
  }, [isAdmin, loading]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!message.trim()) return;
    setSubmitting(true);
    const res = await fetch("/api/petitions", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ category, message, isAnonymous }),
    });
    if (res.ok) {
      const created = await res.json();
      if (!isAnonymous) setPetitions((p) => [created, ...p]);
      setMessage("");
      setIsAnonymous(false);
      setSuccess(true);
      setTimeout(() => setSuccess(false), 3500);
    }
    setSubmitting(false);
  }

  async function markRead(id: string) {
    await fetch(`/api/petitions/${id}`, { method: "PATCH" });
    setPetitions((p) => p.map((x) => x.id === id ? { ...x, isRead: true } : x));
  }

  async function handleDelete(id: string) {
    if (!confirm("Bu dilekçeyi silmek istediğinizden emin misiniz?")) return;
    setDeleting(id);
    await fetch(`/api/petitions/${id}`, { method: "DELETE" });
    setPetitions((p) => p.filter((x) => x.id !== id));
    setDeleting(null);
  }

  const filtered = petitions.filter((p) => {
    if (filterCategory !== "ALL" && p.category !== filterCategory) return false;
    if (filterRead === "UNREAD" && p.isRead) return false;
    if (filterRead === "READ" && !p.isRead) return false;
    return true;
  });

  const unreadCount = petitions.filter((p) => !p.isRead).length;

  return (
    <div className="max-w-4xl mx-auto">
      {/* Header */}
      <div className="mb-6 sm:mb-8">
        <h1 className="text-xl sm:text-2xl font-bold text-gray-800">Öneri & Dilekçe Kutusu</h1>
        <p className="text-sm text-gray-400 mt-1">
          {isAdmin
            ? `${petitions.length} iletim · ${unreadCount} okunmamış`
            : "Önerinizi, şikayetinizi veya dilekçenizi iletin"}
        </p>
      </div>

      {/* Employee: submit form */}
      {!isAdmin && (
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6 mb-6">
          <h2 className="text-sm font-bold text-gray-700 mb-4">Yeni İletim</h2>
          <form onSubmit={handleSubmit} className="space-y-4">
            {/* Category */}
            <div>
              <label className="block text-xs font-semibold text-gray-500 mb-2">Kategori</label>
              <div className="flex flex-wrap gap-2">
                {(["SUGGESTION", "COMPLAINT", "PETITION", "SITE_SUGGESTION"] as Category[]).map((c) => (
                  <button
                    key={c}
                    type="button"
                    onClick={() => setCategory(c)}
                    className={clsx(
                      "px-4 py-1.5 rounded-lg text-xs font-semibold border transition-all",
                      category === c
                        ? "border-[#F57C28] bg-[#FFF3E9] text-[#F57C28]"
                        : "border-gray-200 bg-white text-gray-500 hover:border-gray-300"
                    )}
                  >
                    {CATEGORY_LABELS[c]}
                  </button>
                ))}
              </div>
            </div>

            {/* Message */}
            <div>
              <label className="block text-xs font-semibold text-gray-500 mb-1.5">Mesajınız</label>
              <textarea
                value={message}
                onChange={(e) => setMessage(e.target.value)}
                rows={4}
                placeholder="Mesajınızı buraya yazın..."
                className="w-full px-3 py-2.5 text-sm border border-gray-200 rounded-xl resize-none focus:outline-none focus:ring-2 focus:ring-[#F57C28]/30 focus:border-[#F57C28] transition-all"
                required
              />
            </div>

            {/* Anonymous toggle */}
            <div className="flex items-center justify-between">
              <label className="flex items-center gap-2.5 cursor-pointer select-none">
                <div
                  onClick={() => setIsAnonymous((v) => !v)}
                  className={clsx(
                    "w-9 h-5 rounded-full transition-colors relative cursor-pointer",
                    isAnonymous ? "bg-[#F57C28]" : "bg-gray-200"
                  )}
                >
                  <span
                    className={clsx(
                      "absolute top-0.5 w-4 h-4 bg-white rounded-full shadow transition-transform",
                      isAnonymous ? "translate-x-4" : "translate-x-0.5"
                    )}
                  />
                </div>
                <span className="text-xs text-gray-600">
                  Anonim gönder
                  <span className="text-gray-400 ml-1">(adınız gizlenir)</span>
                </span>
              </label>

              <button
                type="submit"
                disabled={submitting || !message.trim()}
                className="inline-flex items-center gap-2 bg-[#F57C28] hover:bg-[#D96A1A] disabled:opacity-50 text-white font-semibold text-sm px-5 py-2 rounded-xl shadow-md shadow-[#F57C28]/25 transition-all hover:-translate-y-0.5 active:translate-y-0"
              >
                {submitting ? "Gönderiliyor..." : "Gönder"}
              </button>
            </div>

            {success && (
              <div className="flex items-center gap-2 text-emerald-600 bg-emerald-50 border border-emerald-200 rounded-xl px-4 py-2.5 text-sm font-medium">
                <svg className="w-4 h-4 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                İletiminiz başarıyla gönderildi.
              </div>
            )}
          </form>
        </div>
      )}

      {/* List */}
      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm">
        <div className="px-6 py-4 border-b border-gray-100 flex items-center justify-between flex-wrap gap-3">
          <h2 className="text-sm font-bold text-gray-700">
            {isAdmin ? "Gelen Kutucuk" : "Geçmiş İletimlerim"}
          </h2>

          {isAdmin && (
            <div className="flex items-center gap-2">
              {/* Category filter */}
              <select
                value={filterCategory}
                onChange={(e) => setFilterCategory(e.target.value as Category | "ALL")}
                className="text-xs border border-gray-200 rounded-lg px-2 py-1.5 focus:outline-none focus:ring-1 focus:ring-[#F57C28]/30 text-gray-600"
              >
                <option value="ALL">Tüm Kategoriler</option>
                <option value="SUGGESTION">Öneri</option>
                <option value="COMPLAINT">Şikayet</option>
                <option value="PETITION">Dilekçe</option>
                <option value="SITE_SUGGESTION">Site Önerisi</option>
              </select>
              {/* Read filter */}
              <select
                value={filterRead}
                onChange={(e) => setFilterRead(e.target.value as "ALL" | "UNREAD" | "READ")}
                className="text-xs border border-gray-200 rounded-lg px-2 py-1.5 focus:outline-none focus:ring-1 focus:ring-[#F57C28]/30 text-gray-600"
              >
                <option value="ALL">Tümü</option>
                <option value="UNREAD">Okunmamış</option>
                <option value="READ">Okunmuş</option>
              </select>
            </div>
          )}
        </div>

        {loading ? (
          <div className="divide-y divide-gray-50">
            {[...Array(3)].map((_, i) => (
              <div key={i} className="px-6 py-4 animate-pulse flex gap-3">
                <div className="h-5 w-16 bg-gray-100 rounded-full" />
                <div className="flex-1 h-4 bg-gray-100 rounded" />
              </div>
            ))}
          </div>
        ) : filtered.length === 0 ? (
          <div className="px-6 py-12 text-center text-sm text-gray-400">
            {isAdmin ? "Henüz iletim yok." : "Henüz iletim göndermediniz."}
          </div>
        ) : (
          <ul className="divide-y divide-gray-50">
            {filtered.map((p) => (
              <li
                key={p.id}
                className={clsx(
                  "px-6 py-4 transition-colors",
                  isAdmin && !p.isRead && "bg-orange-50/40"
                )}
              >
                <div className="flex items-start gap-3">
                  {/* Unread dot */}
                  <div className="pt-1.5 flex-shrink-0">
                    {isAdmin && !p.isRead ? (
                      <span className="w-2 h-2 rounded-full bg-[#F57C28] block" />
                    ) : (
                      <span className="w-2 h-2 rounded-full bg-transparent block" />
                    )}
                  </div>

                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1.5 flex-wrap">
                      <CategoryBadge category={p.category} />
                      {isAdmin && (
                        <span className="text-xs text-gray-400">
                          {p.isAnonymous ? "Anonim" : p.user?.name ?? "Bilinmeyen"}
                        </span>
                      )}
                      <span className="text-xs text-gray-300 ml-auto flex-shrink-0">
                        {timeAgo(p.createdAt)}
                      </span>
                    </div>
                    <p className="text-sm text-gray-700 leading-relaxed whitespace-pre-wrap">{p.message}</p>
                  </div>

                  {isAdmin && (
                    <div className="flex items-center gap-1 flex-shrink-0 mt-1">
                      {!p.isRead && (
                        <button
                          onClick={() => markRead(p.id)}
                          className="text-[11px] font-semibold text-gray-400 hover:text-[#F57C28] transition-colors"
                          title="Okundu işaretle"
                        >
                          Okundu
                        </button>
                      )}
                      <button
                        onClick={() => handleDelete(p.id)}
                        disabled={deleting === p.id}
                        className="p-1 rounded-lg text-gray-300 hover:text-red-500 hover:bg-red-50 transition-colors disabled:opacity-40"
                        title="Sil"
                      >
                        <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
                          <path strokeLinecap="round" strokeLinejoin="round" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                        </svg>
                      </button>
                    </div>
                  )}
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
