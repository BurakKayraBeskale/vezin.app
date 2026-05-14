"use client";

import { useState, useMemo, FormEvent, useRef, useEffect } from "react";
import clsx from "clsx";

type Department = "OUTSOURCE" | "BAGIMSIZ_DENETIM" | "MUHASEBE" | "YEMINLI_MALI_MUSAVIR" | "ADMIN";
type RelationType = "SUPERIOR" | "PEER" | "SUBORDINATE";

const DEPARTMENT_LABELS: Record<Department, string> = {
  OUTSOURCE:            "Outsource",
  BAGIMSIZ_DENETIM:     "Bağımsız Denetim",
  MUHASEBE:             "Muhasebe",
  YEMINLI_MALI_MUSAVIR: "YMM",
  ADMIN:                "Yönetim",
};

const DEPARTMENT_COLORS: Record<Department, { bg: string; text: string }> = {
  OUTSOURCE:            { bg: "var(--badge-gray-bg)",    text: "var(--badge-gray-text)" },
  BAGIMSIZ_DENETIM:     { bg: "var(--badge-indigo-bg)",  text: "var(--badge-indigo-text)" },
  MUHASEBE:             { bg: "var(--badge-emerald-bg)", text: "var(--badge-emerald-text)" },
  YEMINLI_MALI_MUSAVIR: { bg: "var(--badge-orange-bg)",  text: "var(--badge-orange-text)" },
  ADMIN:                { bg: "var(--badge-red-bg)",     text: "var(--badge-red-text)" },
};

interface UserRelation { userId: string; relationType: string; }

interface UserRecord {
  id: string; name: string; email: string;
  role: "ADMIN" | "MANAGER" | "EMPLOYEE";
  department: string; createdAt: string;
  taskCount?: number; subordinateIds: string[]; relations: UserRelation[];
}

interface LoginLogRecord {
  id: string; ip: string | null; userAgent: string | null;
  success: boolean; createdAt: string;
}

interface Props { initialUsers: UserRecord[]; currentUserId: string; }

interface UserFormState {
  name: string; email: string; password: string;
  role: "ADMIN" | "MANAGER" | "EMPLOYEE"; department: Department;
}

const EMPTY_FORM: UserFormState = { name: "", email: "", password: "", role: "EMPLOYEE", department: "OUTSOURCE" };

function fmtDate(d: string) {
  return new Date(d).toLocaleDateString("tr-TR", { day: "numeric", month: "short", year: "numeric" });
}
function fmtDateTime(d: string) {
  return new Date(d).toLocaleString("tr-TR", { day: "numeric", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" });
}

function RelationsEditor({
  userId, allUsers, relations, onUpdate,
}: {
  userId: string; allUsers: UserRecord[];
  relations: UserRelation[];
  onUpdate: (newRelations: UserRelation[]) => void;
}) {
  const [open, setOpen] = useState(false);
  const [saving, setSaving] = useState<string | null>(null);
  const ref = useRef<HTMLDivElement>(null);

  const [saved, setSaved] = useState<Record<string, string>>(() => {
    const m: Record<string, string> = {};
    relations.forEach((r) => { m[r.userId] = r.relationType; });
    return m;
  });
  const [pending, setPending] = useState<Record<string, string>>(() => {
    const m: Record<string, string> = {};
    relations.forEach((r) => { m[r.userId] = r.relationType; });
    return m;
  });

  useEffect(() => {
    const m: Record<string, string> = {};
    relations.forEach((r) => { m[r.userId] = r.relationType; });
    setSaved(m); setPending(m);
  }, [relations]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (!open) return;
    function handler(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [open]);

  const candidates = allUsers.filter((u) => u.id !== userId);

  async function saveOne(targetUserId: string) {
    const relationType = pending[targetUserId] ?? "";
    setSaving(targetUserId);
    await fetch(`/api/users/${userId}/relations`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ subordinateId: targetUserId, relationType: relationType || null }),
    });
    setSaving(null);
    const newSaved = { ...saved };
    if (relationType) newSaved[targetUserId] = relationType; else delete newSaved[targetUserId];
    setSaved(newSaved);
    const newRelations: UserRelation[] = Object.entries(newSaved).map(([uid, rt]) => ({ userId: uid, relationType: rt }));
    onUpdate(newRelations);
  }

  const totalRelations = Object.keys(saved).length;

  return (
    <div ref={ref} className="relative">
      <button
        onClick={() => setOpen((v) => !v)}
        className={clsx(
          "text-xs px-2.5 py-1 rounded-lg border transition-colors whitespace-nowrap",
          totalRelations > 0
            ? "border-[#F57C28]/40 bg-[#FFF3E9] text-[#F57C28] font-semibold"
            : "border-gray-200 text-gray-400 hover:border-gray-300 hover:text-gray-500"
        )}
      >
        {totalRelations > 0 ? `${totalRelations} kişi` : "Seç"}
      </button>

      {open && (
        <div className="absolute left-0 top-full mt-1 z-50 bg-white border border-gray-200 rounded-xl shadow-lg w-[280px] max-h-72 overflow-y-auto py-1">
          {candidates.length === 0 ? (
            <p className="px-3 py-2 text-xs text-gray-400">Başka kullanıcı yok</p>
          ) : (
            <>
              <p className="px-3 pt-1.5 pb-1 text-[10px] font-semibold text-gray-400 uppercase tracking-wider">Kişi İlişkisi</p>
              {candidates.map((u) => {
                const currentValue = pending[u.id] ?? "";
                const savedValue = saved[u.id] ?? "";
                const isDirty = currentValue !== savedValue;
                return (
                  <div key={u.id} className="flex items-center gap-2 px-3 py-2 hover:bg-gray-50">
                    <div className="w-6 h-6 rounded-full bg-[#F57C28] flex items-center justify-center text-white text-[9px] font-bold flex-shrink-0">
                      {u.name.split(" ").map((n) => n[0]).join("").slice(0, 2).toUpperCase()}
                    </div>
                    <p className="flex-1 text-xs font-medium text-gray-700 truncate min-w-0">{u.name}</p>
                    <select
                      value={currentValue}
                      onChange={(e) => setPending((p) => ({ ...p, [u.id]: e.target.value }))}
                      className="text-[11px] border border-gray-200 rounded-md px-1.5 py-0.5 text-gray-600 bg-white focus:outline-none focus:ring-1 focus:ring-[#F57C28]/30 flex-shrink-0"
                    >
                      <option value="">Yok</option>
                      <option value="SUPERIOR">Üstü</option>
                      <option value="PEER">Dengi</option>
                      <option value="SUBORDINATE">Altı</option>
                    </select>
                    <button
                      onClick={() => saveOne(u.id)}
                      disabled={!isDirty || saving === u.id}
                      className={clsx(
                        "text-[10px] px-2 py-0.5 rounded-md font-semibold transition-colors flex-shrink-0",
                        isDirty && saving !== u.id ? "bg-[#F57C28] text-white hover:bg-[#D96A1A]" : "bg-gray-100 text-gray-400 cursor-not-allowed"
                      )}
                    >
                      {saving === u.id ? "..." : "Kaydet"}
                    </button>
                  </div>
                );
              })}
            </>
          )}
        </div>
      )}
    </div>
  );
}

export default function UserTable({ initialUsers, currentUserId }: Props) {
  const [users, setUsers] = useState<UserRecord[]>(initialUsers);
  const [search, setSearch] = useState("");
  const [showForm, setShowForm] = useState(false);
  const [editUser, setEditUser] = useState<UserRecord | null>(null);
  const [form, setForm] = useState<UserFormState>(EMPTY_FORM);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [deleting, setDeleting] = useState<string | null>(null);

  // Password reset modal
  const [resetUser, setResetUser] = useState<UserRecord | null>(null);
  const [resetPw, setResetPw] = useState("");
  const [resetLoading, setResetLoading] = useState(false);
  const [resetError, setResetError] = useState("");
  const [resetOk, setResetOk] = useState(false);

  // Login history modal
  const [logsUser, setLogsUser] = useState<UserRecord | null>(null);
  const [loginLogs, setLoginLogs] = useState<LoginLogRecord[]>([]);
  const [logsLoading, setLogsLoading] = useState(false);

  function openResetPw(u: UserRecord) {
    setResetUser(u);
    setResetPw("");
    setResetError("");
    setResetOk(false);
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

  async function openLoginLogs(u: UserRecord) {
    setLogsUser(u);
    setLoginLogs([]);
    setLogsLoading(true);
    try {
      const res = await fetch(`/api/admin/users/${u.id}/login-logs`);
      if (res.ok) setLoginLogs(await res.json());
    } finally { setLogsLoading(false); }
  }

  const filtered = useMemo(() => {
    if (!search.trim()) return users;
    const q = search.toLowerCase();
    return users.filter((u) =>
      u.name.toLowerCase().includes(q) ||
      u.email.toLowerCase().includes(q) ||
      (DEPARTMENT_LABELS[u.department as Department] ?? u.department).toLowerCase().includes(q) ||
      (u.role === "ADMIN" ? "admin" : u.role === "MANAGER" ? "yönetici" : "çalışan").includes(q)
    );
  }, [users, search]);

  function openCreate() {
    setEditUser(null); setForm(EMPTY_FORM); setError(""); setShowForm(true);
  }

  function openEdit(u: UserRecord) {
    setEditUser(u);
    setForm({ name: u.name, email: u.email, password: "", role: u.role, department: (u.department as Department) || "OUTSOURCE" });
    setError(""); setShowForm(true);
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setLoading(true); setError("");
    const payload: Record<string, unknown> = { name: form.name, email: form.email, role: form.role, department: form.department };
    if (form.password) payload.password = form.password;

    try {
      let res: Response;
      if (editUser) {
        res = await fetch(`/api/users/${editUser.id}`, {
          method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload),
        });
      } else {
        if (!form.password) { setError("Şifre zorunlu"); setLoading(false); return; }
        res = await fetch("/api/users", {
          method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload),
        });
      }
      if (!res.ok) { const data = await res.json(); setError(data.error || "Bir hata oluştu"); return; }
      const result = await res.json();
      if (editUser) {
        setUsers((prev) => prev.map((u) => u.id === result.id ? { ...result, taskCount: u.taskCount, subordinateIds: u.subordinateIds, relations: u.relations } : u));
        setSearch("");
      } else {
        setUsers((prev) => [...prev, { ...result, taskCount: 0, subordinateIds: [], relations: [] }]);
      }
      setShowForm(false);
    } catch { setError("Sunucu hatası"); }
    finally { setLoading(false); }
  }

  async function handleDelete(id: string) {
    if (!confirm("Bu kullanıcıyı silmek istediğinizden emin misiniz?")) return;
    setDeleting(id);
    try {
      const res = await fetch(`/api/users/${id}`, { method: "DELETE" });
      if (!res.ok) { const data = await res.json(); alert(data.error || "Silinemedi"); return; }
      setUsers((prev) => prev.filter((u) => u.id !== id));
    } finally { setDeleting(null); }
  }

  return (
    <div className="space-y-4">
      {/* Toolbar */}
      <div className="flex items-center gap-3">
        <div className="relative flex-1 max-w-xs">
          <svg className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
          </svg>
          <input type="text" placeholder="İsim, e-posta veya departman ara..." value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full pl-9 pr-4 py-2.5 rounded-xl border border-gray-200 bg-white text-sm text-gray-700 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-[#F57C28]/30 focus:border-[#F57C28]"
          />
        </div>
        {search && <span className="text-sm text-gray-400">{filtered.length} sonuç</span>}
        <div className="ml-auto">
          <button onClick={openCreate}
            className="flex items-center gap-2 bg-[#F57C28] hover:bg-[#D96A1A] text-white text-sm font-semibold px-4 py-2.5 rounded-xl shadow-md shadow-[#F57C28]/25 transition-colors">
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
            </svg>
            Yeni Kullanıcı
          </button>
        </div>
      </div>

      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[900px]">
            <thead className="bg-gray-50 border-b border-gray-100">
              <tr>
                {["Ad Soyad", "E-posta", "Rol", "Departman", "Bağlı Kişiler", "Görevler", "Kayıt", "İşlemler"].map((h) => (
                  <th key={h} className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide whitespace-nowrap">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {filtered.map((u) => (
                <tr key={u.id} className="hover:bg-gray-50/50 transition-colors">
                  <td className="px-4 py-3.5">
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 rounded-full bg-[#F57C28] flex items-center justify-center text-white text-xs font-bold flex-shrink-0">
                        {u.name.split(" ").map((n) => n[0]).join("").slice(0, 2).toUpperCase()}
                      </div>
                      <span className="text-sm font-medium text-gray-800">{u.name}</span>
                      {u.id === currentUserId && (
                        <span className="text-[10px] bg-[#F57C28]/10 text-[#F57C28] font-semibold px-1.5 py-0.5 rounded-full">Siz</span>
                      )}
                    </div>
                  </td>
                  <td className="px-4 py-3.5 text-sm text-gray-600">{u.email}</td>
                  <td className="px-4 py-3.5">
                    <span className={clsx(
                      "text-[11px] font-semibold px-2 py-0.5 rounded-full",
                      u.role === "ADMIN" ? "bg-purple-50 text-purple-600 border border-purple-200"
                        : u.role === "MANAGER" ? "bg-indigo-50 text-indigo-600 border border-indigo-200"
                        : "bg-gray-100 text-gray-600"
                    )}>
                      {u.role === "ADMIN" ? "Admin" : u.role === "MANAGER" ? "Yönetici" : "Çalışan"}
                    </span>
                  </td>
                  <td className="px-4 py-3.5">
                    <select
                      value={u.department || "OUTSOURCE"}
                      onChange={async (e) => {
                        const department = e.target.value;
                        const res = await fetch(`/api/users/${u.id}`, {
                          method: "PATCH", headers: { "Content-Type": "application/json" },
                          body: JSON.stringify({ department }),
                        });
                        if (res.ok) setUsers((prev) => prev.map((x) => x.id === u.id ? { ...x, department } : x));
                      }}
                      className="text-xs border border-gray-200 rounded-lg px-2 py-1 focus:outline-none focus:ring-1 focus:ring-[#F57C28]/30 text-gray-600 bg-white max-w-[160px]"
                    >
                      {(Object.keys(DEPARTMENT_LABELS) as Department[]).map((d) => (
                        <option key={d} value={d}>{DEPARTMENT_LABELS[d]}</option>
                      ))}
                    </select>
                  </td>
                  <td className="px-4 py-3.5">
                    <RelationsEditor userId={u.id} allUsers={users} relations={u.relations}
                      onUpdate={(newRelations) =>
                        setUsers((prev) => prev.map((x) => x.id === u.id
                          ? { ...x, relations: newRelations, subordinateIds: newRelations.filter((r) => r.relationType === "SUBORDINATE").map((r) => r.userId) }
                          : x
                        ))
                      }
                    />
                  </td>
                  <td className="px-4 py-3.5">
                    {u.taskCount != null ? (
                      <span className={clsx("text-xs font-semibold px-2 py-0.5 rounded-full", u.taskCount > 0 ? "bg-[#F57C28]/10 text-[#F57C28]" : "bg-gray-100 text-gray-400")}>
                        {u.taskCount} görev
                      </span>
                    ) : <span className="text-xs text-gray-400">—</span>}
                  </td>
                  <td className="px-4 py-3.5 text-sm text-gray-500">{fmtDate(u.createdAt)}</td>
                  <td className="px-4 py-3.5">
                    <div className="flex items-center gap-1">
                      <button onClick={() => openEdit(u)} title="Düzenle"
                        className="p-1.5 rounded-lg text-gray-400 hover:text-[#F57C28] hover:bg-orange-50 transition-colors">
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
                          <path strokeLinecap="round" strokeLinejoin="round" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                        </svg>
                      </button>
                      <button onClick={() => openResetPw(u)} title="Şifre Sıfırla"
                        className="p-1.5 rounded-lg text-gray-400 hover:text-indigo-500 hover:bg-indigo-50 transition-colors">
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
                          <path strokeLinecap="round" strokeLinejoin="round" d="M15 7a2 2 0 012 2m4 0a6 6 0 01-7.743 5.743L11 17H9v2H7v2H4a1 1 0 01-1-1v-2.586a1 1 0 01.293-.707l5.964-5.964A6 6 0 1121 9z" />
                        </svg>
                      </button>
                      <button onClick={() => openLoginLogs(u)} title="Giriş Geçmişi"
                        className="p-1.5 rounded-lg text-gray-400 hover:text-emerald-500 hover:bg-emerald-50 transition-colors">
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
                          <path strokeLinecap="round" strokeLinejoin="round" d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
                        </svg>
                      </button>
                      <button onClick={() => handleDelete(u.id)} disabled={deleting === u.id || u.id === currentUserId}
                        title={u.id === currentUserId ? "Kendi hesabınızı silemezsiniz" : "Sil"}
                        className="p-1.5 rounded-lg text-gray-400 hover:text-red-500 hover:bg-red-50 transition-colors disabled:opacity-30 disabled:cursor-not-allowed">
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
                          <path strokeLinecap="round" strokeLinejoin="round" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                        </svg>
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
              {filtered.length === 0 && (
                <tr><td colSpan={8} className="py-12 text-center text-gray-400 text-sm">Kullanıcı bulunamadı</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* User Create/Edit Modal */}
      {showForm && (
        <div className="fixed inset-0 bg-black/40 backdrop-blur-sm flex items-end sm:items-center justify-center z-50 sm:p-4">
          <div className="bg-white w-full sm:max-w-md max-h-[95vh] sm:max-h-[90vh] overflow-y-auto rounded-t-2xl sm:rounded-2xl shadow-2xl">
            <div className="flex items-center justify-between p-6 border-b border-gray-100">
              <h2 className="text-lg font-bold text-gray-800">{editUser ? "Kullanıcıyı Düzenle" : "Yeni Kullanıcı"}</h2>
              <button onClick={() => setShowForm(false)} className="p-2 rounded-xl text-gray-400 hover:bg-gray-100 transition-colors">
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
            <form onSubmit={handleSubmit} className="p-6 space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1.5">Ad Soyad *</label>
                <input required value={form.name} onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
                  placeholder="Ayşe Kaya"
                  className="w-full px-3.5 py-2.5 rounded-xl border border-gray-200 text-sm text-gray-800 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-[#F57C28]/30 focus:border-[#F57C28]" />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1.5">E-posta *</label>
                <input type="email" required value={form.email} onChange={(e) => setForm((f) => ({ ...f, email: e.target.value }))}
                  placeholder="ayse@vezin.com"
                  className="w-full px-3.5 py-2.5 rounded-xl border border-gray-200 text-sm text-gray-800 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-[#F57C28]/30 focus:border-[#F57C28]" />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1.5">
                  Şifre {editUser && <span className="text-gray-400 font-normal">(boş bırakırsanız değişmez)</span>}
                </label>
                <input type="password" value={form.password} onChange={(e) => setForm((f) => ({ ...f, password: e.target.value }))}
                  placeholder={editUser ? "Yeni şifre (isteğe bağlı)" : "Şifre"}
                  className="w-full px-3.5 py-2.5 rounded-xl border border-gray-200 text-sm text-gray-800 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-[#F57C28]/30 focus:border-[#F57C28]" />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1.5">Rol</label>
                <select value={form.role} onChange={(e) => setForm((f) => ({ ...f, role: e.target.value as "ADMIN" | "MANAGER" | "EMPLOYEE" }))}
                  className="w-full px-3 py-2.5 rounded-xl border border-gray-200 text-sm text-gray-700 focus:outline-none focus:ring-2 focus:ring-[#F57C28]/30 focus:border-[#F57C28] bg-white">
                  <option value="EMPLOYEE">Çalışan</option>
                  <option value="MANAGER">Yönetici</option>
                  <option value="ADMIN">Admin</option>
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1.5">Departman</label>
                <select value={form.department} onChange={(e) => setForm((f) => ({ ...f, department: e.target.value as Department }))}
                  className="w-full px-3 py-2.5 rounded-xl border border-gray-200 text-sm text-gray-700 focus:outline-none focus:ring-2 focus:ring-[#F57C28]/30 focus:border-[#F57C28] bg-white">
                  {(Object.keys(DEPARTMENT_LABELS) as Department[]).map((d) => (
                    <option key={d} value={d}>{DEPARTMENT_LABELS[d]}</option>
                  ))}
                </select>
              </div>
              {error && <div className="bg-red-50 border border-red-200 text-red-600 text-sm rounded-xl px-4 py-2.5">{error}</div>}
              <div className="flex gap-3 pt-1">
                <button type="button" onClick={() => setShowForm(false)}
                  className="flex-1 px-4 py-2.5 rounded-xl border border-gray-200 text-sm font-medium text-gray-600 hover:bg-gray-50 transition-colors">İptal</button>
                <button type="submit" disabled={loading}
                  className="flex-1 px-4 py-2.5 rounded-xl bg-[#F57C28] hover:bg-[#D96A1A] disabled:opacity-60 text-white text-sm font-semibold transition-colors shadow-md shadow-[#F57C28]/25">
                  {loading ? "Kaydediliyor..." : editUser ? "Güncelle" : "Oluştur"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Password Reset Modal */}
      {resetUser && (
        <div className="fixed inset-0 bg-black/40 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-sm">
            <div className="flex items-center justify-between p-6 border-b border-gray-100">
              <h2 className="text-base font-bold text-gray-800">Şifre Sıfırla</h2>
              <button onClick={() => setResetUser(null)} className="p-2 rounded-xl text-gray-400 hover:bg-gray-100 transition-colors">
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
            <div className="p-6 space-y-4">
              <div className="flex items-center gap-3 pb-3 border-b border-gray-50">
                <div className="w-9 h-9 rounded-full bg-[#F57C28] flex items-center justify-center text-white text-xs font-bold">
                  {resetUser.name.split(" ").map((n) => n[0]).join("").slice(0, 2).toUpperCase()}
                </div>
                <div>
                  <p className="text-sm font-semibold text-gray-800">{resetUser.name}</p>
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
                    <label className="block text-sm font-medium text-gray-700 mb-1.5">Yeni Şifre</label>
                    <input type="password" value={resetPw} onChange={(e) => setResetPw(e.target.value)}
                      placeholder="En az 6 karakter"
                      className="w-full px-3.5 py-2.5 rounded-xl border border-gray-200 text-sm text-gray-800 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-[#F57C28]/30 focus:border-[#F57C28]" />
                  </div>
                  {resetError && <div className="bg-red-50 border border-red-200 text-red-600 text-sm rounded-xl px-4 py-2.5">{resetError}</div>}
                  <div className="flex gap-3">
                    <button onClick={() => setResetUser(null)}
                      className="flex-1 px-4 py-2.5 rounded-xl border border-gray-200 text-sm font-medium text-gray-600 hover:bg-gray-50 transition-colors">İptal</button>
                    <button onClick={handleResetPw} disabled={resetLoading}
                      className="flex-1 px-4 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-700 disabled:opacity-60 text-white text-sm font-semibold transition-colors">
                      {resetLoading ? "..." : "Kaydet"}
                    </button>
                  </div>
                </>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Login History Modal */}
      {logsUser && (
        <div className="fixed inset-0 bg-black/40 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-xl max-h-[85vh] flex flex-col">
            <div className="flex items-center justify-between p-6 border-b border-gray-100 flex-shrink-0">
              <div>
                <h2 className="text-base font-bold text-gray-800">Giriş Geçmişi</h2>
                <p className="text-xs text-gray-400 mt-0.5">{logsUser.name} · Son 20 giriş</p>
              </div>
              <button onClick={() => setLogsUser(null)} className="p-2 rounded-xl text-gray-400 hover:bg-gray-100 transition-colors">
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
            <div className="flex-1 overflow-y-auto p-6">
              {logsLoading ? (
                <div className="space-y-2">
                  {[...Array(5)].map((_, i) => (
                    <div key={i} className="h-12 bg-gray-100 rounded-xl animate-pulse" />
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
                        <p className="text-xs font-semibold text-gray-700">{fmtDateTime(log.createdAt)}</p>
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
