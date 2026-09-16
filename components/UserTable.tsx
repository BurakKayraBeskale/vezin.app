"use client";

import { useState, useMemo, useEffect, FormEvent } from "react";
import { useSearchParams } from "next/navigation";
import clsx from "clsx";
import { TITLES, DEPARTMENTS, DEPARTMENT_LABELS, type DeptKey } from "@/lib/hierarchy";
import { TITLE_TO_SENIORITY } from "@/lib/access";

type UserRole = "ADMIN" | "EMPLOYEE";
type UserStatus = "ACTIVE" | "INACTIVE" | "DELETED";

interface UserRecord {
  id: string;
  name: string;
  email: string;
  role: UserRole;
  department: string;
  title: string;
  seniorityLevel: number;
  status: string;
  createdAt: string;
}

interface LoginLogRecord {
  id: string;
  ip: string | null;
  userAgent: string | null;
  success: boolean;
  createdAt: string;
}

interface Props {
  initialUsers: UserRecord[];
  currentUserId: string;
}

interface UserFormState {
  name: string;
  email: string;
  password: string;
  role: UserRole;
  department: DeptKey;
  title: string;
}

const EMPTY_FORM: UserFormState = {
  name: "",
  email: "",
  password: "",
  role: "EMPLOYEE",
  department: "OUTSOURCE",
  title: "",
};

const DEPT_COLORS: Record<string, { bg: string; text: string }> = {
  OUTSOURCE:            { bg: "var(--badge-gray-bg)",    text: "var(--badge-gray-text)" },
  BAGIMSIZ_DENETIM:     { bg: "var(--badge-indigo-bg)",  text: "var(--badge-indigo-text)" },
  MUHASEBE:             { bg: "var(--badge-emerald-bg)", text: "var(--badge-emerald-text)" },
  YEMINLI_MALI_MUSAVIR: { bg: "var(--badge-orange-bg)",  text: "var(--badge-orange-text)" },
  ADMIN:                { bg: "var(--badge-red-bg)",     text: "var(--badge-red-text)" },
};

const STATUS_CONFIG: Record<string, { label: string; cls: string }> = {
  ACTIVE:   { label: "Aktif",    cls: "bg-emerald-50 text-emerald-600 border border-emerald-200" },
  INACTIVE: { label: "Pasif",    cls: "bg-amber-50 text-amber-600 border border-amber-200" },
  DELETED:  { label: "Silinmiş", cls: "bg-red-50 text-red-500 border border-red-200" },
};

function fmtDate(d: string) {
  return new Date(d).toLocaleDateString("tr-TR", { day: "numeric", month: "short", year: "numeric" });
}
function fmtDateTime(d: string) {
  return new Date(d).toLocaleString("tr-TR", { day: "numeric", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" });
}

function deptLabel(dept: string): string {
  return DEPARTMENT_LABELS[dept as DeptKey] ?? dept;
}

type FilterStatus = "ACTIVE" | "INACTIVE" | "DELETED" | "ALL";

/** ?status= URL parametresini durum filtresine çevirir (dashboard "Aktif Kullanıcılar" kartından gelir). */
function parseStatusParam(searchParams: URLSearchParams): FilterStatus {
  const s = searchParams.get("status")?.toLowerCase();
  if (s === "active") return "ACTIVE";
  if (s === "inactive") return "INACTIVE";
  if (s === "deleted") return "DELETED";
  if (s === "all") return "ALL";
  return "ACTIVE";
}

export default function UserTable({ initialUsers, currentUserId }: Props) {
  const searchParams = useSearchParams();
  const [users, setUsers] = useState<UserRecord[]>(initialUsers);
  const [search, setSearch] = useState("");
  const [filterDept, setFilterDept] = useState("ALL");
  const [filterTitle, setFilterTitle] = useState("ALL");
  const [filterStatus, setFilterStatus] = useState<FilterStatus>(() => parseStatusParam(searchParams));

  useEffect(() => {
    setFilterStatus(parseStatusParam(searchParams));
  }, [searchParams]);

  const [showForm, setShowForm] = useState(false);
  const [editUser, setEditUser] = useState<UserRecord | null>(null);
  const [form, setForm] = useState<UserFormState>(EMPTY_FORM);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [actionLoading, setActionLoading] = useState<string | null>(null);

  // Password reset
  const [resetUser, setResetUser] = useState<UserRecord | null>(null);
  const [resetPw, setResetPw] = useState("");
  const [resetLoading, setResetLoading] = useState(false);
  const [resetError, setResetError] = useState("");
  const [resetOk, setResetOk] = useState(false);

  // Login history
  const [logsUser, setLogsUser] = useState<UserRecord | null>(null);
  const [loginLogs, setLoginLogs] = useState<LoginLogRecord[]>([]);
  const [logsLoading, setLogsLoading] = useState(false);

  const filtered = useMemo(() => {
    let list = users;
    if (filterStatus !== "ALL") list = list.filter((u) => u.status === filterStatus);
    if (filterDept !== "ALL") list = list.filter((u) => u.department === filterDept);
    if (filterTitle !== "ALL") list = list.filter((u) => u.title === filterTitle);
    if (search.trim()) {
      const q = search.toLowerCase();
      list = list.filter((u) => u.name.toLowerCase().includes(q) || u.email.toLowerCase().includes(q));
    }
    return list;
  }, [users, search, filterDept, filterTitle, filterStatus]);

  function openCreate() {
    setEditUser(null);
    setForm(EMPTY_FORM);
    setError("");
    setShowForm(true);
  }

  function openEdit(u: UserRecord) {
    setEditUser(u);
    setForm({
      name: u.name,
      email: u.email,
      password: "",
      role: u.role,
      department: (DEPARTMENTS as readonly string[]).includes(u.department) ? u.department as DeptKey : "OUTSOURCE",
      title: u.title,
    });
    setError("");
    setShowForm(true);
  }

  function openResetPw(u: UserRecord) {
    setResetUser(u);
    setResetPw("");
    setResetError("");
    setResetOk(false);
  }

  async function openLoginLogs(u: UserRecord) {
    setLogsUser(u);
    setLoginLogs([]);
    setLogsLoading(true);
    try {
      const res = await fetch(`/api/admin/users/${u.id}/login-logs`);
      if (res.ok) setLoginLogs(await res.json());
    } finally {
      setLogsLoading(false);
    }
  }

  async function handleResetPw() {
    if (!resetUser || !resetPw) { setResetError("Şifre girin"); return; }
    if (resetPw.length < 6) { setResetError("En az 6 karakter"); return; }
    setResetLoading(true);
    setResetError("");
    try {
      const res = await fetch(`/api/admin/users/${resetUser.id}/reset-password`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ password: resetPw }),
      });
      if (!res.ok) { const d = await res.json(); setResetError(d.error || "Hata"); return; }
      setResetOk(true);
    } catch { setResetError("Sunucu hatası"); }
    finally { setResetLoading(false); }
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError("");

    const payload: Record<string, unknown> = {
      name: form.name,
      email: form.email,
      role: form.role,
      title: form.role === "ADMIN" ? "Partner" : form.title,
    };
    if (form.role !== "ADMIN") payload.department = form.department;
    if (form.password) payload.password = form.password;

    try {
      let res: Response;
      if (editUser) {
        res = await fetch(`/api/users/${editUser.id}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        });
      } else {
        if (!form.password) { setError("Şifre zorunlu"); setLoading(false); return; }
        res = await fetch("/api/users", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        });
      }
      if (!res.ok) { const data = await res.json(); setError(data.error || "Bir hata oluştu"); return; }
      const result = await res.json();
      if (editUser) {
        setUsers((prev) => prev.map((u) => u.id === result.id ? result : u));
      } else {
        setUsers((prev) => [...prev, result]);
      }
      setShowForm(false);
    } catch { setError("Sunucu hatası"); }
    finally { setLoading(false); }
  }

  async function setStatus(u: UserRecord, status: UserStatus) {
    if (!confirm(`"${u.name}" kullanıcısını ${status === "INACTIVE" ? "pasife almak" : status === "ACTIVE" ? "aktifleştirmek" : "silmek"} istediğinizden emin misiniz?`)) return;
    setActionLoading(u.id);
    try {
      const res = await fetch(`/api/users/${u.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status }),
      });
      if (!res.ok) { const d = await res.json(); alert(d.error || "İşlem başarısız"); return; }
      const updated = await res.json();
      setUsers((prev) => prev.map((x) => x.id === updated.id ? updated : x));
    } finally { setActionLoading(null); }
  }

  async function handleDelete(u: UserRecord) {
    if (!confirm(`"${u.name}" kullanıcısını silmek istediğinizden emin misiniz? Geçmiş verileri varsa pasif olarak işaretlenir.`)) return;
    setActionLoading(u.id);
    try {
      const res = await fetch(`/api/users/${u.id}`, { method: "DELETE" });
      if (!res.ok) { const d = await res.json(); alert(d.error || "Silinemedi"); return; }
      const result = await res.json();
      if (result.soft) {
        // Soft delete: status=DELETED olarak güncellendi, listede kalsın
        setUsers((prev) => prev.map((x) => x.id === u.id ? { ...x, status: "DELETED", canBeAssignedTasks: false } as UserRecord : x));
      } else {
        // Hard delete: tamamen kaldır
        setUsers((prev) => prev.filter((x) => x.id !== u.id));
      }
    } finally { setActionLoading(null); }
  }

  return (
    <div className="space-y-4">
      {/* Filtre çubuğu */}
      <div className="flex flex-wrap items-center gap-3">
        {/* Arama */}
        <div className="relative flex-1 min-w-[180px] max-w-xs">
          <svg className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
          </svg>
          <input
            type="text"
            placeholder="İsim veya e-posta..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full pl-9 pr-4 py-2.5 rounded-xl border border-gray-200 dark:border-gray-600 bg-white dark:bg-gray-800 text-sm text-gray-700 dark:text-gray-200 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-[#F57C28]/30 focus:border-[#F57C28]"
          />
        </div>

        {/* Durum filtresi */}
        <select
          value={filterStatus}
          onChange={(e) => setFilterStatus(e.target.value as typeof filterStatus)}
          className="text-sm border border-gray-200 dark:border-gray-600 rounded-xl px-3 py-2.5 bg-white dark:bg-gray-800 text-gray-700 dark:text-gray-200 focus:outline-none focus:ring-2 focus:ring-[#F57C28]/30"
        >
          <option value="ACTIVE">Aktif</option>
          <option value="INACTIVE">Pasif</option>
          <option value="DELETED">Silinmiş</option>
          <option value="ALL">Tümü</option>
        </select>

        {/* Departman filtresi */}
        <select
          value={filterDept}
          onChange={(e) => setFilterDept(e.target.value)}
          className="text-sm border border-gray-200 dark:border-gray-600 rounded-xl px-3 py-2.5 bg-white dark:bg-gray-800 text-gray-700 dark:text-gray-200 focus:outline-none focus:ring-2 focus:ring-[#F57C28]/30"
        >
          <option value="ALL">Tüm Departmanlar</option>
          {DEPARTMENTS.map((d) => (
            <option key={d} value={d}>{DEPARTMENT_LABELS[d]}</option>
          ))}
        </select>

        {/* Ünvan filtresi */}
        <select
          value={filterTitle}
          onChange={(e) => setFilterTitle(e.target.value)}
          className="text-sm border border-gray-200 dark:border-gray-600 rounded-xl px-3 py-2.5 bg-white dark:bg-gray-800 text-gray-700 dark:text-gray-200 focus:outline-none focus:ring-2 focus:ring-[#F57C28]/30"
        >
          <option value="ALL">Tüm Ünvanlar</option>
          {TITLES.map((t) => (
            <option key={t.key} value={t.key}>{t.key}</option>
          ))}
        </select>

        {search && <span className="text-sm text-gray-400">{filtered.length} sonuç</span>}

        <div className="ml-auto">
          <button
            onClick={openCreate}
            className="flex items-center gap-2 bg-[#F57C28] hover:bg-[#D96A1A] text-white text-sm font-semibold px-4 py-2.5 rounded-xl shadow-md shadow-[#F57C28]/25 transition-colors"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
            </svg>
            Yeni Kullanıcı
          </button>
        </div>
      </div>

      {/* Tablo */}
      <div className="bg-white dark:bg-gray-800 rounded-2xl border border-gray-100 dark:border-gray-700 shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[860px]">
            <thead className="bg-gray-50 dark:bg-gray-700/50 border-b border-gray-100 dark:border-gray-700">
              <tr>
                {["Ad Soyad", "E-posta", "Ünvan", "Departman", "Sistem Yetkisi", "Kayıt", "İşlemler"].map((h) => (
                  <th key={h} className="px-4 py-3 text-left text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide whitespace-nowrap">
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50 dark:divide-gray-700">
              {filtered.map((u) => {
                const statusCfg = STATUS_CONFIG[u.status] ?? STATUS_CONFIG.ACTIVE;
                const deptColors = DEPT_COLORS[u.department] ?? DEPT_COLORS.OUTSOURCE;
                const isDeleted = u.status === "DELETED";
                const isInactive = u.status === "INACTIVE";

                return (
                  <tr key={u.id} className={clsx("transition-colors", isDeleted ? "opacity-50" : "hover:bg-gray-50/50 dark:hover:bg-gray-700/30")}>
                    {/* Ad Soyad */}
                    <td className="px-4 py-3.5">
                      <div className="flex items-center gap-3">
                        <div className={clsx("w-8 h-8 rounded-full flex items-center justify-center text-white text-xs font-bold flex-shrink-0", isDeleted ? "bg-gray-400" : "bg-[#F57C28]")}>
                          {u.name.split(" ").map((n) => n[0]).join("").slice(0, 2).toUpperCase()}
                        </div>
                        <div>
                          <div className="flex items-center gap-1.5">
                            <span className="text-sm font-medium text-gray-800 dark:text-gray-100">{u.name}</span>
                            {u.id === currentUserId && (
                              <span className="text-[10px] bg-[#F57C28]/10 text-[#F57C28] font-semibold px-1.5 py-0.5 rounded-full">Siz</span>
                            )}
                          </div>
                          <span className={clsx("text-[10px] font-semibold px-1.5 py-0.5 rounded-full", statusCfg.cls)}>
                            {statusCfg.label}
                          </span>
                        </div>
                      </div>
                    </td>

                    {/* E-posta */}
                    <td className="px-4 py-3.5 text-sm text-gray-600 dark:text-gray-400">{u.email}</td>

                    {/* Ünvan */}
                    <td className="px-4 py-3.5">
                      {u.title ? (
                        <span className="text-xs text-gray-700 dark:text-gray-300">{u.title}</span>
                      ) : (
                        <span className="text-xs text-amber-500 italic">Ünvan atanmalı</span>
                      )}
                    </td>

                    {/* Departman */}
                    <td className="px-4 py-3.5">
                      <span
                        className="text-[11px] font-semibold px-2 py-0.5 rounded-full"
                        style={{ backgroundColor: deptColors.bg, color: deptColors.text }}
                      >
                        {u.department === "ADMIN" ? "Tüm Sistem" : deptLabel(u.department)}
                      </span>
                    </td>

                    {/* Sistem Yetkisi */}
                    <td className="px-4 py-3.5">
                      <span className={clsx(
                        "text-[11px] font-semibold px-2 py-0.5 rounded-full",
                        u.role === "ADMIN"
                          ? "bg-purple-50 text-purple-600 border border-purple-200"
                          : "bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-400"
                      )}>
                        {u.role === "ADMIN" ? "Admin" : "Standart"}
                      </span>
                    </td>

                    {/* Kayıt tarihi */}
                    <td className="px-4 py-3.5 text-sm text-gray-500 dark:text-gray-400 whitespace-nowrap">
                      {fmtDate(u.createdAt)}
                    </td>

                    {/* İşlemler */}
                    <td className="px-4 py-3.5">
                      <div className="flex items-center gap-1">
                        {/* Düzenle */}
                        <button
                          onClick={() => openEdit(u)}
                          title="Düzenle"
                          disabled={isDeleted}
                          className="p-1.5 rounded-lg text-gray-400 hover:text-[#F57C28] hover:bg-orange-50 dark:hover:bg-orange-900/20 transition-colors disabled:opacity-30 disabled:cursor-not-allowed"
                        >
                          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
                            <path strokeLinecap="round" strokeLinejoin="round" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                          </svg>
                        </button>

                        {/* Şifre sıfırla */}
                        <button
                          onClick={() => openResetPw(u)}
                          title="Şifre Sıfırla"
                          disabled={isDeleted}
                          className="p-1.5 rounded-lg text-gray-400 hover:text-indigo-500 hover:bg-indigo-50 dark:hover:bg-indigo-900/20 transition-colors disabled:opacity-30 disabled:cursor-not-allowed"
                        >
                          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
                            <path strokeLinecap="round" strokeLinejoin="round" d="M15 7a2 2 0 012 2m4 0a6 6 0 01-7.743 5.743L11 17H9v2H7v2H4a1 1 0 01-1-1v-2.586a1 1 0 01.293-.707l5.964-5.964A6 6 0 1121 9z" />
                          </svg>
                        </button>

                        {/* Giriş geçmişi */}
                        <button
                          onClick={() => openLoginLogs(u)}
                          title="Giriş Geçmişi"
                          className="p-1.5 rounded-lg text-gray-400 hover:text-emerald-500 hover:bg-emerald-50 dark:hover:bg-emerald-900/20 transition-colors"
                        >
                          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
                            <path strokeLinecap="round" strokeLinejoin="round" d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
                          </svg>
                        </button>

                        {/* Pasife Al / Aktifleştir */}
                        {!isDeleted && u.id !== currentUserId && (
                          u.status === "ACTIVE" ? (
                            <button
                              onClick={() => setStatus(u, "INACTIVE")}
                              disabled={actionLoading === u.id}
                              title="Pasife Al"
                              className="p-1.5 rounded-lg text-gray-400 hover:text-amber-500 hover:bg-amber-50 dark:hover:bg-amber-900/20 transition-colors disabled:opacity-30"
                            >
                              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
                                <path strokeLinecap="round" strokeLinejoin="round" d="M18.364 18.364A9 9 0 005.636 5.636m12.728 12.728A9 9 0 015.636 5.636m12.728 12.728L5.636 5.636" />
                              </svg>
                            </button>
                          ) : (
                            <button
                              onClick={() => setStatus(u, "ACTIVE")}
                              disabled={actionLoading === u.id}
                              title="Aktifleştir"
                              className="p-1.5 rounded-lg text-gray-400 hover:text-emerald-500 hover:bg-emerald-50 dark:hover:bg-emerald-900/20 transition-colors disabled:opacity-30"
                            >
                              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
                                <path strokeLinecap="round" strokeLinejoin="round" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                              </svg>
                            </button>
                          )
                        )}

                        {/* Sil */}
                        {!isDeleted && (
                          <button
                            onClick={() => handleDelete(u)}
                            disabled={actionLoading === u.id || u.id === currentUserId}
                            title={u.id === currentUserId ? "Kendi hesabınızı silemezsiniz" : "Sil"}
                            className="p-1.5 rounded-lg text-gray-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors disabled:opacity-30 disabled:cursor-not-allowed"
                          >
                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
                              <path strokeLinecap="round" strokeLinejoin="round" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                            </svg>
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                );
              })}
              {filtered.length === 0 && (
                <tr>
                  <td colSpan={7} className="py-12 text-center text-gray-400 text-sm">Kullanıcı bulunamadı</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* ── Kullanıcı Oluştur/Düzenle Modal ──────────────────────────────────── */}
      {showForm && (
        <div className="fixed inset-0 bg-black/40 backdrop-blur-sm flex items-end sm:items-center justify-center z-50 sm:p-4">
          <div className="bg-white dark:bg-gray-900 w-full sm:max-w-md max-h-[95vh] sm:max-h-[90vh] overflow-y-auto rounded-t-2xl sm:rounded-2xl shadow-2xl">
            <div className="flex items-center justify-between p-6 border-b border-gray-100 dark:border-gray-700">
              <h2 className="text-lg font-bold text-gray-800 dark:text-gray-100">
                {editUser ? "Kullanıcıyı Düzenle" : "Yeni Kullanıcı"}
              </h2>
              <button onClick={() => setShowForm(false)} className="p-2 rounded-xl text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors">
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
            <form onSubmit={handleSubmit} className="p-6 space-y-4">
              {/* Ad Soyad */}
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5">Ad Soyad *</label>
                <input
                  required
                  value={form.name}
                  onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
                  placeholder="Ayşe Kaya"
                  className="w-full px-3.5 py-2.5 rounded-xl border border-gray-200 dark:border-gray-600 text-sm text-gray-800 dark:text-gray-100 placeholder-gray-400 bg-white dark:bg-gray-800 focus:outline-none focus:ring-2 focus:ring-[#F57C28]/30 focus:border-[#F57C28]"
                />
              </div>

              {/* E-posta */}
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5">E-posta *</label>
                <input
                  type="email"
                  required
                  value={form.email}
                  onChange={(e) => setForm((f) => ({ ...f, email: e.target.value }))}
                  placeholder="ayse@vezin.com"
                  className="w-full px-3.5 py-2.5 rounded-xl border border-gray-200 dark:border-gray-600 text-sm text-gray-800 dark:text-gray-100 placeholder-gray-400 bg-white dark:bg-gray-800 focus:outline-none focus:ring-2 focus:ring-[#F57C28]/30 focus:border-[#F57C28]"
                />
              </div>

              {/* Şifre */}
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5">
                  Şifre {editUser && <span className="text-gray-400 font-normal">(boş bırakırsanız değişmez)</span>}
                </label>
                <input
                  type="password"
                  value={form.password}
                  onChange={(e) => setForm((f) => ({ ...f, password: e.target.value }))}
                  placeholder={editUser ? "Yeni şifre (isteğe bağlı)" : "Şifre"}
                  className="w-full px-3.5 py-2.5 rounded-xl border border-gray-200 dark:border-gray-600 text-sm text-gray-800 dark:text-gray-100 placeholder-gray-400 bg-white dark:bg-gray-800 focus:outline-none focus:ring-2 focus:ring-[#F57C28]/30 focus:border-[#F57C28]"
                />
              </div>

              {/* Sistem Yetkisi */}
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">Sistem Yetkisi</label>
                <div className="flex gap-3">
                  {(["EMPLOYEE", "ADMIN"] as UserRole[]).map((r) => (
                    <button
                      key={r}
                      type="button"
                      onClick={() => setForm((f) => ({ ...f, role: r, title: r === "ADMIN" ? "Partner" : f.title }))}
                      className={clsx(
                        "flex-1 py-2 rounded-xl text-sm font-semibold border transition-colors",
                        form.role === r
                          ? r === "ADMIN"
                            ? "bg-purple-600 text-white border-purple-600"
                            : "bg-[#F57C28] text-white border-[#F57C28]"
                          : "bg-white dark:bg-gray-800 text-gray-600 dark:text-gray-400 border-gray-200 dark:border-gray-600 hover:border-gray-300"
                      )}
                    >
                      {r === "ADMIN" ? "Admin" : "Standart Kullanıcı"}
                    </button>
                  ))}
                </div>
              </div>

              {/* Departman — Admin için devre dışı */}
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5">
                  Departman {form.role === "ADMIN" && <span className="text-gray-400 font-normal">(admin için uygulanmaz)</span>}
                </label>
                <select
                  value={form.role === "ADMIN" ? "" : form.department}
                  disabled={form.role === "ADMIN"}
                  onChange={(e) => setForm((f) => ({ ...f, department: e.target.value as DeptKey }))}
                  className="w-full px-3 py-2.5 rounded-xl border border-gray-200 dark:border-gray-600 text-sm text-gray-700 dark:text-gray-200 bg-white dark:bg-gray-800 focus:outline-none focus:ring-2 focus:ring-[#F57C28]/30 focus:border-[#F57C28] disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {form.role === "ADMIN" ? (
                    <option value="">—</option>
                  ) : (
                    DEPARTMENTS.map((d) => (
                      <option key={d} value={d}>{DEPARTMENT_LABELS[d]}</option>
                    ))
                  )}
                </select>
              </div>

              {/* Ünvan — Admin için Partner zorla */}
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5">
                  Ünvan {form.role === "ADMIN" && <span className="text-gray-400 font-normal">(Partner)</span>}
                </label>
                <select
                  value={form.role === "ADMIN" ? "Partner" : form.title}
                  disabled={form.role === "ADMIN"}
                  onChange={(e) => setForm((f) => ({ ...f, title: e.target.value }))}
                  className="w-full px-3 py-2.5 rounded-xl border border-gray-200 dark:border-gray-600 text-sm text-gray-700 dark:text-gray-200 bg-white dark:bg-gray-800 focus:outline-none focus:ring-2 focus:ring-[#F57C28]/30 focus:border-[#F57C28] disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {form.role === "ADMIN" ? (
                    <option value="Partner">Partner</option>
                  ) : (
                    <>
                      <option value="">— Seçiniz —</option>
                      {TITLES.map((t) => (
                        <option key={t.key} value={t.key}>{t.key} (Seviye {t.level})</option>
                      ))}
                    </>
                  )}
                </select>
              </div>

              {error && (
                <div className="bg-red-50 border border-red-200 text-red-600 text-sm rounded-xl px-4 py-2.5">{error}</div>
              )}

              <div className="flex gap-3 pt-1">
                <button
                  type="button"
                  onClick={() => setShowForm(false)}
                  className="flex-1 px-4 py-2.5 rounded-xl border border-gray-200 dark:border-gray-600 text-sm font-medium text-gray-600 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors"
                >
                  İptal
                </button>
                <button
                  type="submit"
                  disabled={loading}
                  className="flex-1 px-4 py-2.5 rounded-xl bg-[#F57C28] hover:bg-[#D96A1A] disabled:opacity-60 text-white text-sm font-semibold transition-colors shadow-md shadow-[#F57C28]/25"
                >
                  {loading ? "Kaydediliyor..." : editUser ? "Güncelle" : "Oluştur"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ── Şifre Sıfırla Modal ──────────────────────────────────────────────── */}
      {resetUser && (
        <div className="fixed inset-0 bg-black/40 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-white dark:bg-gray-900 rounded-2xl shadow-2xl w-full max-w-sm">
            <div className="flex items-center justify-between p-6 border-b border-gray-100 dark:border-gray-700">
              <h2 className="text-base font-bold text-gray-800 dark:text-gray-100">Şifre Sıfırla</h2>
              <button onClick={() => setResetUser(null)} className="p-2 rounded-xl text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors">
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
            <div className="p-6 space-y-4">
              <div className="flex items-center gap-3 pb-3 border-b border-gray-50 dark:border-gray-700">
                <div className="w-9 h-9 rounded-full bg-[#F57C28] flex items-center justify-center text-white text-xs font-bold">
                  {resetUser.name.split(" ").map((n) => n[0]).join("").slice(0, 2).toUpperCase()}
                </div>
                <div>
                  <p className="text-sm font-semibold text-gray-800 dark:text-gray-100">{resetUser.name}</p>
                  <p className="text-xs text-gray-400">{resetUser.email}</p>
                </div>
              </div>
              {resetOk ? (
                <div className="bg-emerald-50 border border-emerald-200 text-emerald-700 text-sm rounded-xl px-4 py-3 text-center">
                  Şifre başarıyla güncellendi!
                </div>
              ) : (
                <>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5">Yeni Şifre</label>
                    <input
                      type="password"
                      value={resetPw}
                      onChange={(e) => setResetPw(e.target.value)}
                      placeholder="En az 6 karakter"
                      className="w-full px-3.5 py-2.5 rounded-xl border border-gray-200 dark:border-gray-600 text-sm text-gray-800 dark:text-gray-100 placeholder-gray-400 bg-white dark:bg-gray-800 focus:outline-none focus:ring-2 focus:ring-[#F57C28]/30 focus:border-[#F57C28]"
                    />
                  </div>
                  {resetError && (
                    <div className="bg-red-50 border border-red-200 text-red-600 text-sm rounded-xl px-4 py-2.5">{resetError}</div>
                  )}
                  <div className="flex gap-3">
                    <button
                      onClick={() => setResetUser(null)}
                      className="flex-1 px-4 py-2.5 rounded-xl border border-gray-200 dark:border-gray-600 text-sm font-medium text-gray-600 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors"
                    >
                      İptal
                    </button>
                    <button
                      onClick={handleResetPw}
                      disabled={resetLoading}
                      className="flex-1 px-4 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-700 disabled:opacity-60 text-white text-sm font-semibold transition-colors"
                    >
                      {resetLoading ? "..." : "Kaydet"}
                    </button>
                  </div>
                </>
              )}
            </div>
          </div>
        </div>
      )}

      {/* ── Giriş Geçmişi Modal ──────────────────────────────────────────────── */}
      {logsUser && (
        <div className="fixed inset-0 bg-black/40 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-white dark:bg-gray-900 rounded-2xl shadow-2xl w-full max-w-xl max-h-[85vh] flex flex-col">
            <div className="flex items-center justify-between p-6 border-b border-gray-100 dark:border-gray-700 flex-shrink-0">
              <div>
                <h2 className="text-base font-bold text-gray-800 dark:text-gray-100">Giriş Geçmişi</h2>
                <p className="text-xs text-gray-400 mt-0.5">{logsUser.name} · Son 20 giriş</p>
              </div>
              <button onClick={() => setLogsUser(null)} className="p-2 rounded-xl text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors">
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
            <div className="flex-1 overflow-y-auto p-6">
              {logsLoading ? (
                <div className="space-y-2">
                  {[...Array(5)].map((_, i) => (
                    <div key={i} className="h-12 bg-gray-100 dark:bg-gray-800 rounded-xl animate-pulse" />
                  ))}
                </div>
              ) : loginLogs.length === 0 ? (
                <p className="text-sm text-gray-400 text-center py-10">Giriş kaydı bulunamadı</p>
              ) : (
                <div className="space-y-2">
                  {loginLogs.map((log) => (
                    <div key={log.id} className={clsx(
                      "flex items-center gap-3 p-3 rounded-xl border",
                      log.success ? "bg-emerald-50 border-emerald-100" : "bg-red-50 border-red-100"
                    )}>
                      <div className={clsx(
                        "w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold flex-shrink-0",
                        log.success ? "bg-emerald-100 text-emerald-600" : "bg-red-100 text-red-500"
                      )}>
                        {log.success ? "✓" : "✗"}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-xs font-semibold text-gray-700 dark:text-gray-300">{fmtDateTime(log.createdAt)}</p>
                        <p className="text-[10px] text-gray-400 truncate">
                          IP: {log.ip ?? "—"} · {log.userAgent?.slice(0, 50) ?? "—"}
                        </p>
                      </div>
                      <span className={clsx(
                        "text-[10px] font-bold px-2 py-0.5 rounded-full flex-shrink-0",
                        log.success ? "bg-emerald-100 text-emerald-600" : "bg-red-100 text-red-500"
                      )}>
                        {log.success ? "Başarılı" : "Başarısız"}
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
