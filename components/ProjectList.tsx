"use client";

import { useState } from "react";

type ProjectUser = { id: string; name: string; email: string; seniorityLevel: number; title: string };
type Project = {
  id: string;
  name: string;
  department: string;
  taxNumber?: string | null;
  sector?: string | null;
  startDate?: string | null;
  notes?: string | null;
  about?: string | null;
  createdAt: string;
  createdBy: { id: string; name: string };
  members: { user: ProjectUser; assignedAt: string }[];
  _count: { tasks: number };
};

interface ProjectListProps {
  initialProjects: Project[];
  users: ProjectUser[];
  canCreate: boolean;
  canViewAllProjects: boolean;
  currentDept: string | null;
  userDepartment: string;
}

const DEPT_LABELS: Record<string, string> = {
  BAGIMSIZ_DENETIM: "Bağımsız Denetim",
  VERGI: "Vergi",
};

export default function ProjectList({
  initialProjects,
  users,
  canCreate,
  canViewAllProjects,
  currentDept,
  userDepartment,
}: ProjectListProps) {
  const [projects, setProjects] = useState<Project[]>(initialProjects);
  const [activeDept, setActiveDept] = useState<string>(
    currentDept ?? (canViewAllProjects ? "BAGIMSIZ_DENETIM" : userDepartment === "VERGI" || userDepartment === "YEMINLI_MALI_MUSAVIR" ? "VERGI" : "BAGIMSIZ_DENETIM")
  );
  const [showCreate, setShowCreate] = useState(false);
  const [creating, setCreating] = useState(false);
  const [form, setForm] = useState({
    name: "",
    department: activeDept,
    taxNumber: "",
    sector: "",
    startDate: "",
    notes: "",
    memberIds: [] as string[],
  });
  const [error, setError] = useState("");

  const filtered = projects.filter((p) => p.department === activeDept);

  const visibleDepts = canViewAllProjects
    ? ["BAGIMSIZ_DENETIM", "VERGI"]
    : userDepartment === "VERGI" || userDepartment === "YEMINLI_MALI_MUSAVIR" || userDepartment === "MUHASEBE"
    ? ["VERGI"]
    : ["BAGIMSIZ_DENETIM"];

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    setCreating(true);
    setError("");
    try {
      const res = await fetch("/api/projects", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: form.name,
          department: form.department,
          taxNumber: form.taxNumber || null,
          sector: form.sector || null,
          startDate: form.startDate || null,
          notes: form.notes || null,
          memberIds: form.memberIds,
        }),
      });
      const data = await res.json();
      if (!res.ok) { setError(data.error || "Hata"); return; }
      setProjects((prev) => [data, ...prev]);
      setShowCreate(false);
      setForm({ name: "", department: activeDept, taxNumber: "", sector: "", startDate: "", notes: "", memberIds: [] });
    } finally {
      setCreating(false);
    }
  }

  return (
    <div className="max-w-5xl mx-auto">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Projeler</h1>
          <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
            Birim bazlı proje yönetimi
          </p>
        </div>
        {canCreate && (
          <button
            onClick={() => setShowCreate(true)}
            className="px-4 py-2 bg-[#F57C28] text-white rounded-lg text-sm font-medium hover:bg-[#e06d1f] transition-colors"
          >
            + Yeni Proje
          </button>
        )}
      </div>

      {/* Birim Tabs */}
      {visibleDepts.length > 1 && (
        <div className="flex gap-1 mb-6 bg-gray-100 dark:bg-gray-800 rounded-lg p-1 w-fit">
          {visibleDepts.map((dept) => (
            <button
              key={dept}
              onClick={() => setActiveDept(dept)}
              className={`px-4 py-2 rounded-md text-sm font-medium transition-colors ${
                activeDept === dept
                  ? "bg-white dark:bg-gray-700 text-gray-900 dark:text-white shadow-sm"
                  : "text-gray-500 dark:text-gray-400 hover:text-gray-700"
              }`}
            >
              {DEPT_LABELS[dept] ?? dept}
            </button>
          ))}
        </div>
      )}

      {/* Project Grid */}
      {filtered.length === 0 ? (
        <div className="text-center py-16 text-gray-400 dark:text-gray-600">
          <p className="text-lg">Bu birimde henüz proje yok</p>
          {canCreate && (
            <p className="text-sm mt-2">Yeni bir proje oluşturmak için yukarıdaki butonu kullanın</p>
          )}
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {filtered.map((project) => (
            <a
              key={project.id}
              href={`/projeler/${project.id}`}
              className="block bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-5 hover:border-[#F57C28] hover:shadow-md transition-all"
            >
              <div className="flex items-start justify-between mb-3">
                <div className="flex-1 min-w-0">
                  <h3 className="font-semibold text-gray-900 dark:text-white truncate">{project.name}</h3>
                  {project.sector && (
                    <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">{project.sector}</p>
                  )}
                </div>
                <span className={`ml-2 px-2 py-0.5 rounded-full text-[10px] font-semibold flex-shrink-0 ${
                  project.department === "BAGIMSIZ_DENETIM"
                    ? "bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300"
                    : "bg-emerald-100 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-300"
                }`}>
                  {DEPT_LABELS[project.department] ?? project.department}
                </span>
              </div>
              <div className="flex items-center gap-4 text-sm text-gray-500 dark:text-gray-400">
                <span>{project._count.tasks} görev</span>
                <span>{project.members.length} üye</span>
              </div>
              <div className="mt-3 flex -space-x-1.5">
                {project.members.slice(0, 5).map((m) => (
                  <div
                    key={m.user.id}
                    className="w-6 h-6 rounded-full bg-[#F57C28] border-2 border-white dark:border-gray-800 flex items-center justify-center text-[8px] font-bold text-white"
                    title={m.user.name}
                  >
                    {m.user.name.slice(0, 2).toUpperCase()}
                  </div>
                ))}
                {project.members.length > 5 && (
                  <div className="w-6 h-6 rounded-full bg-gray-200 dark:bg-gray-600 border-2 border-white dark:border-gray-800 flex items-center justify-center text-[8px] font-medium text-gray-600 dark:text-gray-300">
                    +{project.members.length - 5}
                  </div>
                )}
              </div>
            </a>
          ))}
        </div>
      )}

      {/* Create Modal */}
      {showCreate && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white dark:bg-gray-800 rounded-xl shadow-xl w-full max-w-lg">
            <div className="px-6 py-4 border-b border-gray-200 dark:border-gray-700">
              <h2 className="text-lg font-semibold text-gray-900 dark:text-white">Yeni Proje</h2>
            </div>
            <form onSubmit={handleCreate} className="p-6 space-y-4">
              {error && (
                <div className="px-4 py-2 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg text-red-700 dark:text-red-400 text-sm">
                  {error}
                </div>
              )}
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Proje Adı *</label>
                <input
                  value={form.name}
                  onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
                  className="w-full border border-gray-300 dark:border-gray-600 rounded-lg px-3 py-2 text-sm bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                  required
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Birim *</label>
                <select
                  value={form.department}
                  onChange={(e) => setForm((f) => ({ ...f, department: e.target.value }))}
                  className="w-full border border-gray-300 dark:border-gray-600 rounded-lg px-3 py-2 text-sm bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                >
                  {visibleDepts.map((d) => (
                    <option key={d} value={d}>{DEPT_LABELS[d] ?? d}</option>
                  ))}
                </select>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Vergi No</label>
                  <input
                    value={form.taxNumber}
                    onChange={(e) => setForm((f) => ({ ...f, taxNumber: e.target.value }))}
                    className="w-full border border-gray-300 dark:border-gray-600 rounded-lg px-3 py-2 text-sm bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Sektör</label>
                  <input
                    value={form.sector}
                    onChange={(e) => setForm((f) => ({ ...f, sector: e.target.value }))}
                    className="w-full border border-gray-300 dark:border-gray-600 rounded-lg px-3 py-2 text-sm bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                  />
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Başlangıç Tarihi</label>
                <input
                  type="date"
                  value={form.startDate}
                  onChange={(e) => setForm((f) => ({ ...f, startDate: e.target.value }))}
                  className="w-full border border-gray-300 dark:border-gray-600 rounded-lg px-3 py-2 text-sm bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                />
              </div>
              {users.length > 0 && (
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Üyeler</label>
                  <div className="max-h-40 overflow-y-auto border border-gray-300 dark:border-gray-600 rounded-lg divide-y divide-gray-100 dark:divide-gray-700">
                    {users.map((u) => (
                      <label key={u.id} className="flex items-center gap-2 px-3 py-2 hover:bg-gray-50 dark:hover:bg-gray-700/50 cursor-pointer">
                        <input
                          type="checkbox"
                          checked={form.memberIds.includes(u.id)}
                          onChange={(e) => {
                            setForm((f) => ({
                              ...f,
                              memberIds: e.target.checked
                                ? [...f.memberIds, u.id]
                                : f.memberIds.filter((id) => id !== u.id),
                            }));
                          }}
                          className="rounded"
                        />
                        <div>
                          <p className="text-sm font-medium text-gray-900 dark:text-white">{u.name}</p>
                          {u.title && <p className="text-[10px] text-gray-500">{u.title}</p>}
                        </div>
                      </label>
                    ))}
                  </div>
                </div>
              )}
              <div className="flex gap-3 pt-2">
                <button
                  type="submit"
                  disabled={creating}
                  className="flex-1 bg-[#F57C28] text-white rounded-lg py-2 text-sm font-medium hover:bg-[#e06d1f] disabled:opacity-50 transition-colors"
                >
                  {creating ? "Oluşturuluyor..." : "Oluştur"}
                </button>
                <button
                  type="button"
                  onClick={() => { setShowCreate(false); setError(""); }}
                  className="flex-1 bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 rounded-lg py-2 text-sm font-medium hover:bg-gray-200 dark:hover:bg-gray-600 transition-colors"
                >
                  İptal
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
