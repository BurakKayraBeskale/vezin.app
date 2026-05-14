"use client";

import { useEffect, useState, FormEvent } from "react";
import { useSession } from "next-auth/react";
import clsx from "clsx";

interface ProfileData {
  user: { id: string; name: string; email: string; role: string; department: string; createdAt: string };
  stats: { todo: number; inProgress: number; review: number; done: number; overdue: number };
  leaveBalance: { totalDays: number; usedDays: number; remainingDays: number; year: number } | null;
}

const DEPT_LABELS: Record<string, string> = {
  OUTSOURCE:            "Outsource",
  BAGIMSIZ_DENETIM:     "Bağımsız Denetim",
  MUHASEBE:             "Muhasebe",
  YEMINLI_MALI_MUSAVIR: "YMM",
  ADMIN:                "Yönetim",
};

function StatCard({ label, value, color }: { label: string; value: number; color: string }) {
  return (
    <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-4 text-center">
      <p className="text-2xl font-bold" style={{ color }}>{value}</p>
      <p className="text-xs text-gray-500 mt-1">{label}</p>
    </div>
  );
}

export default function ProfilePage() {
  const { data: session, update: updateSession } = useSession();
  const [profileData, setProfileData] = useState<ProfileData | null>(null);
  const [loading, setLoading] = useState(true);

  // Edit info form
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [infoSaving, setInfoSaving] = useState(false);
  const [infoMsg, setInfoMsg] = useState<{ type: "ok" | "err"; text: string } | null>(null);

  // Password form
  const [currentPw, setCurrentPw] = useState("");
  const [newPw, setNewPw] = useState("");
  const [confirmPw, setConfirmPw] = useState("");
  const [pwSaving, setPwSaving] = useState(false);
  const [pwMsg, setPwMsg] = useState<{ type: "ok" | "err"; text: string } | null>(null);

  useEffect(() => {
    fetch("/api/profile")
      .then((r) => r.json())
      .then((d: ProfileData) => {
        setProfileData(d);
        setName(d.user.name);
        setEmail(d.user.email);
        setLoading(false);
      });
  }, []);

  async function handleInfoSave(e: FormEvent) {
    e.preventDefault();
    setInfoSaving(true);
    setInfoMsg(null);
    const res = await fetch("/api/profile", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: name.trim(), email: email.trim() }),
    });
    const data = await res.json();
    if (!res.ok) {
      setInfoMsg({ type: "err", text: data.error ?? "Bir hata oluştu" });
    } else {
      setProfileData((prev) => prev ? { ...prev, user: { ...prev.user, ...data } } : prev);
      setInfoMsg({ type: "ok", text: "Bilgiler güncellendi" });
      // Update NextAuth session name
      await updateSession({ name: data.name });
    }
    setInfoSaving(false);
  }

  async function handlePwSave(e: FormEvent) {
    e.preventDefault();
    if (newPw !== confirmPw) { setPwMsg({ type: "err", text: "Yeni şifreler eşleşmiyor" }); return; }
    if (newPw.length < 6) { setPwMsg({ type: "err", text: "Şifre en az 6 karakter olmalı" }); return; }
    setPwSaving(true);
    setPwMsg(null);
    const res = await fetch("/api/profile", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ currentPassword: currentPw, newPassword: newPw }),
    });
    const data = await res.json();
    if (!res.ok) {
      setPwMsg({ type: "err", text: data.error ?? "Bir hata oluştu" });
    } else {
      setPwMsg({ type: "ok", text: "Şifre değiştirildi" });
      setCurrentPw(""); setNewPw(""); setConfirmPw("");
    }
    setPwSaving(false);
  }

  if (loading) {
    return (
      <div className="max-w-2xl mx-auto space-y-4">
        {[...Array(3)].map((_, i) => (
          <div key={i} className="bg-white rounded-2xl border border-gray-100 shadow-sm h-40 animate-pulse" />
        ))}
      </div>
    );
  }

  if (!profileData) return null;
  const { user, stats, leaveBalance } = profileData;

  const inputClass = "w-full px-3.5 py-2.5 rounded-xl border border-gray-200 text-sm text-gray-800 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-[#F57C28]/30 focus:border-[#F57C28]";

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-xl sm:text-2xl font-bold text-gray-800">Profilim</h1>
        <p className="text-sm text-gray-400 mt-1">
          {DEPT_LABELS[user.department] ?? user.department} · {user.role === "ADMIN" ? "Admin" : "Çalışan"}
        </p>
      </div>

      {/* Görev istatistikleri */}
      <div>
        <h2 className="text-sm font-bold text-gray-700 mb-3">Görev Durumu</h2>
        <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
          <StatCard label="Yapılacak"    value={stats.todo}       color="var(--badge-gray-text)" />
          <StatCard label="Devam Eden"   value={stats.inProgress} color="#F57C28" />
          <StatCard label="İncelemede"   value={stats.review}     color="var(--badge-indigo-text)" />
          <StatCard label="Tamamlanan"   value={stats.done}       color="var(--badge-emerald-text)" />
          <StatCard label="Geciken"      value={stats.overdue}    color="var(--badge-red-text)" />
        </div>
      </div>

      {/* İzin bakiyesi */}
      {leaveBalance && (
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6">
          <h2 className="text-sm font-bold text-gray-700 mb-4">
            {leaveBalance.year} Yılı İzin Bakiyesi
          </h2>
          <div className="grid grid-cols-3 gap-4">
            {[
              { label: "Toplam Hak",  value: leaveBalance.totalDays,     color: "var(--badge-indigo-text)" },
              { label: "Kullanılan",  value: leaveBalance.usedDays,      color: "#F57C28" },
              { label: "Kalan",       value: leaveBalance.remainingDays, color: "var(--badge-emerald-text)" },
            ].map((c) => (
              <div key={c.label} className="text-center">
                <p className="text-3xl font-bold" style={{ color: c.color }}>{c.value}</p>
                <p className="text-xs text-gray-500 mt-1">{c.label}</p>
              </div>
            ))}
          </div>
          <div className="mt-4 h-2 rounded-full bg-gray-100 overflow-hidden">
            <div
              className="h-full rounded-full bg-[#F57C28] transition-all"
              style={{ width: `${Math.min((leaveBalance.usedDays / leaveBalance.totalDays) * 100, 100)}%` }}
            />
          </div>
        </div>
      )}

      {/* Bilgi düzenleme */}
      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6">
        <h2 className="text-sm font-bold text-gray-700 mb-4">Kişisel Bilgiler</h2>
        <form onSubmit={handleInfoSave} className="space-y-4">
          <div>
            <label className="block text-xs font-semibold text-gray-500 mb-1.5">Ad Soyad</label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              required
              className={inputClass}
            />
          </div>
          <div>
            <label className="block text-xs font-semibold text-gray-500 mb-1.5">E-posta</label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              className={inputClass}
            />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold text-gray-500 mb-1.5">Departman</label>
              <div className="px-3.5 py-2.5 rounded-xl border border-gray-100 bg-gray-50 text-sm text-gray-600 select-none">
                {DEPT_LABELS[user.department] ?? user.department}
              </div>
            </div>
            <div>
              <label className="block text-xs font-semibold text-gray-500 mb-1.5">Rol</label>
              <div className="px-3.5 py-2.5 rounded-xl border border-gray-100 bg-gray-50 text-sm text-gray-600 select-none">
                {user.role === "ADMIN" ? "Admin" : user.role === "MANAGER" ? "Yönetici" : "Çalışan"}
              </div>
            </div>
          </div>
          {infoMsg && (
            <p className={clsx("text-sm rounded-xl px-4 py-2.5", infoMsg.type === "ok" ? "bg-emerald-50 text-emerald-600" : "bg-red-50 text-red-600")}>
              {infoMsg.text}
            </p>
          )}
          <div className="flex justify-end">
            <button
              type="submit"
              disabled={infoSaving}
              className="inline-flex items-center gap-2 bg-[#F57C28] hover:bg-[#D96A1A] disabled:opacity-50 text-white font-semibold text-sm px-5 py-2 rounded-xl shadow-md shadow-[#F57C28]/25 transition-all"
            >
              {infoSaving ? "Kaydediliyor..." : "Kaydet"}
            </button>
          </div>
        </form>
      </div>

      {/* Şifre değiştirme */}
      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6">
        <h2 className="text-sm font-bold text-gray-700 mb-4">Şifre Değiştir</h2>
        <form onSubmit={handlePwSave} className="space-y-4">
          <div>
            <label className="block text-xs font-semibold text-gray-500 mb-1.5">Mevcut Şifre</label>
            <input
              type="password"
              value={currentPw}
              onChange={(e) => setCurrentPw(e.target.value)}
              required
              placeholder="••••••••"
              className={inputClass}
            />
          </div>
          <div>
            <label className="block text-xs font-semibold text-gray-500 mb-1.5">Yeni Şifre</label>
            <input
              type="password"
              value={newPw}
              onChange={(e) => setNewPw(e.target.value)}
              required
              placeholder="En az 6 karakter"
              className={inputClass}
            />
          </div>
          <div>
            <label className="block text-xs font-semibold text-gray-500 mb-1.5">Yeni Şifre (Tekrar)</label>
            <input
              type="password"
              value={confirmPw}
              onChange={(e) => setConfirmPw(e.target.value)}
              required
              placeholder="••••••••"
              className={inputClass}
            />
          </div>
          {pwMsg && (
            <p className={clsx("text-sm rounded-xl px-4 py-2.5", pwMsg.type === "ok" ? "bg-emerald-50 text-emerald-600" : "bg-red-50 text-red-600")}>
              {pwMsg.text}
            </p>
          )}
          <div className="flex justify-end">
            <button
              type="submit"
              disabled={pwSaving || !currentPw || !newPw || !confirmPw}
              className="inline-flex items-center gap-2 bg-[#F57C28] hover:bg-[#D96A1A] disabled:opacity-50 text-white font-semibold text-sm px-5 py-2 rounded-xl shadow-md shadow-[#F57C28]/25 transition-all"
            >
              {pwSaving ? "Değiştiriliyor..." : "Şifreyi Değiştir"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
