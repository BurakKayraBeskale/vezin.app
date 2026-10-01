"use client";

import { useEffect, useState } from "react";
import { useSession } from "next-auth/react";
import clsx from "clsx";

// Feedback (URL /petition ve tablo adı Petition olarak korunuyor).
// Form tek bir metin kutusundan oluşur; kategori/anonimlik kaldırıldı.
interface Petition {
  id: string;
  message: string;
  isAnonymous: boolean;
  isRead: boolean;
  createdAt: string;
  user?: { id: string; name: string } | null;
}

// Eski anonim kayıtlar "Anonim" olarak görünmeye devam eder.
function senderName(p: Petition) {
  if (p.isAnonymous) return "Anonim";
  return p.user?.name ?? "Bilinmeyen";
}

function formatDate(dateStr: string) {
  return new Date(dateStr).toLocaleString("tr-TR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export default function PetitionPage() {
  const { data: session } = useSession();
  const isAdmin = session?.user.role === "ADMIN";

  const [petitions, setPetitions] = useState<Petition[]>([]);
  const [loading, setLoading] = useState(true);

  // Form state
  const [message, setMessage] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [success, setSuccess] = useState(false);
  const [deleting, setDeleting] = useState<string | null>(null);

  // Admin filter
  const [filterRead, setFilterRead] = useState<"ALL" | "UNREAD" | "READ">("ALL");

  useEffect(() => {
    fetch("/api/petitions")
      .then((r) => r.json())
      .then((data) => {
        setPetitions(data);
        setLoading(false);
      });
  }, []);

  // Admin: sayfa yüklenince tüm feedback'leri okundu işaretle
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
      body: JSON.stringify({ message }),
    });
    if (res.ok) {
      const created = await res.json();
      setPetitions((p) => [created, ...p]);
      setMessage("");
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
    if (!confirm("Bu feedback'i silmek istediğinizden emin misiniz?")) return;
    setDeleting(id);
    await fetch(`/api/petitions/${id}`, { method: "DELETE" });
    setPetitions((p) => p.filter((x) => x.id !== id));
    setDeleting(null);
  }

  const filtered = petitions.filter((p) => {
    if (filterRead === "UNREAD" && p.isRead) return false;
    if (filterRead === "READ" && !p.isRead) return false;
    return true;
  });

  const unreadCount = petitions.filter((p) => !p.isRead).length;

  return (
    <div className="max-w-4xl mx-auto">
      {/* Header */}
      <div className="mb-6 sm:mb-8">
        <h1 className="text-xl sm:text-2xl font-bold text-gray-800">Feedback</h1>
        <p className="text-sm text-gray-400 mt-1">
          {isAdmin
            ? `${petitions.length} feedback · ${unreadCount} okunmamış`
            : "Görüş ve önerilerinizi iletin"}
        </p>
      </div>

      {/* Employee: submit form */}
      {!isAdmin && (
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6 mb-6">
          <h2 className="text-sm font-bold text-gray-700 mb-4">Yeni Feedback</h2>
          <form onSubmit={handleSubmit} className="space-y-4">
            <textarea
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              rows={5}
              placeholder="Feedback'inizi buraya yazın..."
              aria-label="Feedback"
              className="w-full px-3 py-2.5 text-sm border border-gray-200 rounded-xl resize-none focus:outline-none focus:ring-2 focus:ring-[#F57C28]/30 focus:border-[#F57C28] transition-all"
              required
            />

            <div className="flex justify-end">
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
                Feedback&apos;iniz gönderildi.
              </div>
            )}
          </form>
        </div>
      )}

      {/* List */}
      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm">
        <div className="px-6 py-4 border-b border-gray-100 flex items-center justify-between flex-wrap gap-3">
          <h2 className="text-sm font-bold text-gray-700">
            {isAdmin ? "Gelen Feedback'ler" : "Gönderdiğim Feedback'ler"}
          </h2>

          {isAdmin && (
            <select
              value={filterRead}
              onChange={(e) => setFilterRead(e.target.value as "ALL" | "UNREAD" | "READ")}
              className="text-xs border border-gray-200 rounded-lg px-2 py-1.5 focus:outline-none focus:ring-1 focus:ring-[#F57C28]/30 text-gray-600"
            >
              <option value="ALL">Tümü</option>
              <option value="UNREAD">Okunmamış</option>
              <option value="READ">Okunmuş</option>
            </select>
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
            {isAdmin ? "Henüz feedback yok." : "Henüz feedback göndermediniz."}
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
                      <span className="text-xs font-semibold text-gray-600">{senderName(p)}</span>
                      <span className="text-xs text-gray-300 ml-auto flex-shrink-0">
                        {formatDate(p.createdAt)}
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
