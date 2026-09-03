"use client";

import { useState } from "react";
import { canDeleteProject } from "@/lib/access";

type ProjectUser = { id: string; name: string; email: string; seniorityLevel: number; title: string };
type Project = {
  id: string;
  name: string;
  department: string;
  startDate?: string | null;
  notes?: string | null;
  createdAt: string;
  createdBy: { id: string; name: string };
  members: { user: ProjectUser; assignedAt: string }[];
  _count: { tasks: number };
};

interface ProjectListProps {
  initialProjects: Project[];
  /** Departman bazlı üye listeleri — server-side filtrelenmiş */
  usersByDept: { BAGIMSIZ_DENETIM: ProjectUser[]; VERGI: ProjectUser[] };
  canCreate: boolean;
  canViewAllProjects: boolean;
  currentDept: string | null;
  userDepartment: string;
  /** Silme yetkisi hesabı için gereken session bilgileri */
  userId: string;
  userRole: string;
  overseesDepartment: string | null;
}

const DEPT_LABELS: Record<string, string> = {
  BAGIMSIZ_DENETIM: "Bağımsız Denetim",
  VERGI: "Vergi",
};

export default function ProjectList({
  initialProjects,
  usersByDept,
  canCreate,
  canViewAllProjects,
  currentDept,
  userDepartment,
  userId,
  userRole,
  overseesDepartment,
}: ProjectListProps) {
  const [projects, setProjects] = useState<Project[]>(initialProjects);
  const [activeDept, setActiveDept] = useState<string>(
    currentDept ??
      (canViewAllProjects
        ? "BAGIMSIZ_DENETIM"
        : userDepartment === "VERGI" || userDepartment === "YEMINLI_MALI_MUSAVIR"
        ? "VERGI"
        : "BAGIMSIZ_DENETIM")
  );
  const [showCreate, setShowCreate] = useState(false);
  const [creating, setCreating] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [form, setForm] = useState({
    name: "",
    department: activeDept,
    startDate: "",
    notes: "",
    memberIds: [] as string[],
  });
  const [error, setError] = useState("");

  const filtered = projects.filter((p) => p.department === activeDept);

  const visibleDepts = canViewAllProjects
    ? ["BAGIMSIZ_DENETIM", "VERGI"]
    : userDepartment === "VERGI" ||
      userDepartment === "YEMINLI_MALI_MUSAVIR" ||
      userDepartment === "MUHASEBE"
    ? ["VERGI"]
    : ["BAGIMSIZ_DENETIM"];

  function openCreate() {
    setForm({
      name: "",
      department: activeDept,
      startDate: "",
      notes: "",
      memberIds: [],
    });
    setError("");
    setShowCreate(true);
  }

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
          startDate: form.startDate || null,
          notes: form.notes || null,
          memberIds: form.memberIds,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || "Hata");
        return;
      }
      setProjects((prev) => [data, ...prev]);
      setShowCreate(false);
    } finally {
      setCreating(false);
    }
  }

  async function handleDelete(project: Project, e: React.MouseEvent) {
    e.preventDefault();
    e.stopPropagation();

    const taskCount = project._count.tasks;
    const confirmMsg =
      taskCount > 0
        ? `"${project.name}" projesi ${taskCount} görev içeriyor. Projeyi ve tüm görevleri silmek istediğinizden emin misiniz?`
        : `"${project.name}" projesini silmek istediğinizden emin misiniz?`;
    if (!window.confirm(confirmMsg)) return;

    setDeletingId(project.id);
    try {
      const url =
        taskCount > 0
          ? `/api/projects/${project.id}?cascade=true`
          : `/api/projects/${project.id}`;
      const res = await fetch(url, { method: "DELETE" });
      if (res.ok) {
        setProjects((prev) => prev.filter((p) => p.id !== project.id));
      } else {
        const data = await res.json();
        alert(data.error || "Silme başarısız");
      }
    } finally {
      setDeletingId(null);
    }
  }

  return (
    <div className="max-w-5xl mx-auto">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">
            Projeler
          </h1>
          <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
            Birim bazlı proje yönetimi
          </p>
        </div>
        {canCreate && (
          <button
            onClick={openCreate}
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
            <p className="text-sm mt-2">
              Yeni bir proje oluşturmak için yukarıdaki butonu kullanın
            </p>
          )}
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {filtered.map((project) => {
            const userCanDelete = canDeleteProject(
              { id: userId, role: userRole, overseesDepartment },
              { createdById: project.createdBy.id, department: project.department }
            );
            return (
              <a
                key={project.id}
                href={`/projeler/${project.id}`}
                className="block bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-5 hover:border-[#F57C28] hover:shadow-md transition-all"
              >
                <div className="flex items-start justify-between mb-3">
                  <div className="flex-1 min-w-0">
                    <h3 className="font-semibold text-gray-900 dark:text-white truncate">
                      {project.name}
                    </h3>
                  </div>
                  <div className="flex items-center gap-1.5 ml-2 flex-shrink-0">
                    <span
                      className={`px-2 py-0.5 rounded-full text-[10px] font-semibold ${
                        project.department === "BAGIMSIZ_DENETIM"
                          ? "bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300"
                          : "bg-emerald-100 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-300"
                      }`}
                    >
                      {DEPT_LABELS[project.department] ?? project.department}
                    </span>
                    {userCanDelete && (
                      <button
                        onClick={(e) => handleDelete(project, e)}
                        disabled={deletingId === project.id}
                        title="Projeyi sil"
                        className="p-1 rounded-md text-gray-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors disabled:opacity-40"
                      >
                        {deletingId === project.id ? (
                          <svg
                            className="w-3.5 h-3.5 animate-spin"
                            fill="none"
                            viewBox="0 0 24 24"
                          >
                            <circle
                              className="opacity-25"
                              cx="12"
                              cy="12"
                              r="10"
                              stroke="currentColor"
                              strokeWidth="4"
                            />
                            <path
                              className="opacity-75"
                              fill="currentColor"
                              d="M4 12a8 8 0 018-8v8H4z"
                            />
                          </svg>
                        ) : (
                          <svg
                            className="w-3.5 h-3.5"
                            fill="none"
                            stroke="currentColor"
                            viewBox="0 0 24 24"
                            strokeWidth={2}
                          >
                            <path
                              strokeLinecap="round"
                              strokeLinejoin="round"
                              d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"
                            />
                          </svg>
                        )}
                      </button>
                    )}
                  </div>
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
            );
          })}
        </div>
      )}

      {/* Create Modal */}
      {showCreate && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white dark:bg-gray-800 rounded-xl shadow-xl w-full max-w-lg max-h-[90vh] overflow-y-auto">
            <div className="px-6 py-4 border-b border-gray-200 dark:border-gray-700">
              <h2 className="text-lg font-semibold text-gray-900 dark:text-white">
                Yeni Proje
              </h2>
            </div>
            <form onSubmit={handleCreate} className="p-6 space-y-4">
              {error && (
                <div className="px-4 py-2 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg text-red-700 dark:text-red-400 text-sm">
                  {error}
                </div>
              )}
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  Proje Adı *
                </label>
                <input
                  value={form.name}
                  onChange={(e) =>
                    setForm((f) => ({ ...f, name: e.target.value }))
                  }
                  className="w-full border border-gray-300 dark:border-gray-600 rounded-lg px-3 py-2 text-sm bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                  required
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  Birim *
                </label>
                <select
                  value={form.department}
                  onChange={(e) =>
                    setForm((f) => ({
                      ...f,
                      department: e.target.value,
                      memberIds: [],
                    }))
                  }
                  className="w-full border border-gray-300 dark:border-gray-600 rounded-lg px-3 py-2 text-sm bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                >
                  {visibleDepts.map((d) => (
                    <option key={d} value={d}>
                      {DEPT_LABELS[d] ?? d}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  Başlangıç Tarihi
                </label>
                <input
                  type="date"
                  value={form.startDate}
                  onChange={(e) =>
                    setForm((f) => ({ ...f, startDate: e.target.value }))
                  }
                  className="w-full border border-gray-300 dark:border-gray-600 rounded-lg px-3 py-2 text-sm bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                />
              </div>
              {((usersByDept[form.department as keyof typeof usersByDept]) ?? [])
                .length > 0 && (
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                    Üyeler
                  </label>
                  <div className="max-h-40 overflow-y-auto border border-gray-300 dark:border-gray-600 rounded-lg divide-y divide-gray-100 dark:divide-gray-700">
                    {(
                      usersByDept[
                        form.department as keyof typeof usersByDept
                      ] ?? []
                    ).map((u) => (
                      <label
                        key={u.id}
                        className="flex items-center gap-2 px-3 py-2 hover:bg-gray-50 dark:hover:bg-gray-700/50 cursor-pointer"
                      >
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
                          <p className="text-sm font-medium text-gray-900 dark:text-white">
                            {u.name}
                          </p>
                          {u.title && (
                            <p className="text-[10px] text-gray-500">{u.title}</p>
                          )}
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
                  onClick={() => {
                    setShowCreate(false);
                    setError("");
                  }}
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
