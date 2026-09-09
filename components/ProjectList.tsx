"use client";

import { useState, useMemo } from "react";
import { userDeptToProjectDept } from "@/lib/access";

type ProjectUser = { id: string; name: string; email: string; seniorityLevel: number; title: string };
type Project = {
  id: string;
  name: string;
  department: string;
  status: string;
  startDate?: string | null;
  endDate?: string | null;
  about?: string | null;
  createdAt: string;
  createdBy: { id: string; name: string };
  members: { user: ProjectUser; assignedAt: string }[];
};

type UsersByDept = {
  OUTSOURCE: ProjectUser[];
  BAGIMSIZ_DENETIM: ProjectUser[];
  MUHASEBE: ProjectUser[];
  YMM: ProjectUser[];
};

interface ProjectListProps {
  initialProjects: Project[];
  usersByDept: UsersByDept;
  canCreate: boolean;
  canViewAllProjects: boolean;
  userDepartment: string;
  userId: string;
  userRole: string;
  seniorityLevel: number;
  overseesDepartment: string | null;
}

const DEPT_LABELS: Record<string, string> = {
  OUTSOURCE:        "Outsource",
  BAGIMSIZ_DENETIM: "Bağımsız Denetim",
  MUHASEBE:         "Muhasebe",
  YMM:              "YMM",
};

const DEPT_COLORS: Record<string, string> = {
  OUTSOURCE:        "bg-purple-100 dark:bg-purple-900/30 text-purple-700 dark:text-purple-300",
  BAGIMSIZ_DENETIM: "bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300",
  MUHASEBE:         "bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-300",
  YMM:              "bg-emerald-100 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-300",
};

const STATUS_LABELS: Record<string, string> = {
  ACTIVE:   "Aktif",
  DONE:     "Tamamlandı",
  ARCHIVED: "Arşivlendi",
};

const STATUS_COLORS: Record<string, string> = {
  ACTIVE:   "bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-300",
  DONE:     "bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300",
  ARCHIVED: "bg-orange-100 dark:bg-orange-900/30 text-orange-700 dark:text-orange-300",
};

const ALL_DEPTS = ["OUTSOURCE", "BAGIMSIZ_DENETIM", "MUHASEBE", "YMM"] as const;

function getVisibleDepts(
  canViewAllProjects: boolean,
  userRole: string,
  userDepartment: string,
  seniorityLevel: number,
  overseesDepartment: string | null,
): string[] {
  // Admin ve canViewAllProjects: dört departmanın tamamı
  if (userRole === "ADMIN" || canViewAllProjects) return [...ALL_DEPTS];
  // overseesDepartment (eski sistem — backward compat)
  if (overseesDepartment) return [overseesDepartment];
  // Standart kullanıcı: yalnızca kendi departmanının sekme(si)
  const projectDept = userDeptToProjectDept(userDepartment);
  if (projectDept) return [projectDept];
  return [...ALL_DEPTS];
}

export default function ProjectList({
  initialProjects,
  usersByDept,
  canCreate,
  canViewAllProjects,
  userDepartment,
  userId,
  userRole,
  seniorityLevel,
  overseesDepartment,
}: ProjectListProps) {
  const visibleDepts = getVisibleDepts(canViewAllProjects, userRole, userDepartment, seniorityLevel, overseesDepartment);
  const isAdminOrGlobal = userRole === "ADMIN" || canViewAllProjects;

  const defaultDept = useMemo(() => {
    if (visibleDepts.length === 0) return "BAGIMSIZ_DENETIM";
    // Admin başlangıç sekmesi
    if (isAdminOrGlobal) return "BAGIMSIZ_DENETIM";
    return visibleDepts[0];
  }, [visibleDepts, isAdminOrGlobal]);

  const [projects, setProjects] = useState<Project[]>(initialProjects);
  const [activeDept, setActiveDept] = useState<string>(defaultDept);
  const [statusFilter, setStatusFilter] = useState<"ACTIVE" | "DONE" | "ARCHIVED" | "ALL">("ACTIVE");
  const [search, setSearch] = useState("");
  const [showCreate, setShowCreate] = useState(false);
  const [creating, setCreating] = useState(false);
  const [form, setForm] = useState({
    name: "",
    department: defaultDept,
    startDate: "",
    endDate: "",
    about: "",
    memberIds: [] as string[],
  });
  const [error, setError] = useState("");
  const [loadingProjects, setLoadingProjects] = useState(false);

  // Filtrelenmiş proje listesi
  const filtered = useMemo(() => {
    return projects.filter((p) => {
      if (p.department !== activeDept) return false;
      if (p.status !== statusFilter && statusFilter !== "ALL") return false;
      if (search.trim() && !p.name.toLowerCase().includes(search.trim().toLowerCase())) return false;
      return true;
    });
  }, [projects, activeDept, statusFilter, search]);

  // Departman sekmesi değişince projeleri yeniden yükle
  async function loadProjects(dept: string, status: string) {
    setLoadingProjects(true);
    try {
      const statusParam = status === "ALL" ? "ALL" : status;
      const res = await fetch(`/api/projects?department=${dept}&status=${statusParam}`);
      if (res.ok) {
        const data = await res.json();
        setProjects((prev) => {
          // Mevcut projeleri dept+status ile birleştir
          const otherDeptProjects = prev.filter((p) => p.department !== dept);
          return [...otherDeptProjects, ...data];
        });
      }
    } finally {
      setLoadingProjects(false);
    }
  }

  function handleDeptChange(dept: string) {
    setActiveDept(dept);
    setForm((f) => ({ ...f, department: dept, memberIds: [] }));
    loadProjects(dept, statusFilter);
  }

  function handleStatusChange(status: "ACTIVE" | "DONE" | "ARCHIVED" | "ALL") {
    setStatusFilter(status);
    loadProjects(activeDept, status);
  }

  function openCreate() {
    setForm({
      name: "",
      department: isAdminOrGlobal ? activeDept : (userDeptToProjectDept(userDepartment) ?? activeDept),
      startDate: "",
      endDate: "",
      about: "",
      memberIds: [],
    });
    setError("");
    setShowCreate(true);
  }

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    if (form.endDate && form.startDate && form.endDate < form.startDate) {
      setError("Bitiş tarihi başlangıç tarihinden önce olamaz");
      return;
    }
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
          endDate: form.endDate || null,
          about: form.about || null,
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

  const createFormDeptUsers = (usersByDept[form.department as keyof typeof usersByDept] ?? [])
    .filter((u) => u.id !== userId);

  return (
    <div className="max-w-5xl mx-auto">
      {/* Başlık */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Projeler</h1>
          <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
            Departman bazlı proje yönetimi
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

      {/* Departman Sekmeleri */}
      {visibleDepts.length > 1 && (
        <div className="flex gap-1 mb-4 bg-gray-100 dark:bg-gray-800 rounded-lg p-1 w-fit">
          {visibleDepts.map((dept) => (
            <button
              key={dept}
              onClick={() => handleDeptChange(dept)}
              className={`px-4 py-2 rounded-md text-sm font-medium transition-colors ${
                activeDept === dept
                  ? "bg-white dark:bg-gray-700 text-gray-900 dark:text-white shadow-sm"
                  : "text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200"
              }`}
            >
              {DEPT_LABELS[dept] ?? dept}
            </button>
          ))}
        </div>
      )}

      {/* Arama + Durum Filtresi */}
      <div className="flex flex-wrap items-center gap-3 mb-5">
        <div className="relative flex-1 min-w-[200px]">
          <svg
            className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400"
            fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}
          >
            <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
          </svg>
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Proje ara..."
            className="w-full pl-9 pr-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg text-sm bg-white dark:bg-gray-700 text-gray-900 dark:text-white placeholder-gray-400"
          />
        </div>
        <div className="flex gap-1 bg-gray-100 dark:bg-gray-800 rounded-lg p-1">
          {(["ACTIVE", "DONE", "ARCHIVED", "ALL"] as const).map((s) => (
            <button
              key={s}
              onClick={() => handleStatusChange(s)}
              className={`px-3 py-1.5 rounded-md text-xs font-medium transition-colors ${
                statusFilter === s
                  ? "bg-white dark:bg-gray-700 text-gray-900 dark:text-white shadow-sm"
                  : "text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200"
              }`}
            >
              {s === "ACTIVE" ? "Aktif" : s === "DONE" ? "Tamamlandı" : s === "ARCHIVED" ? "Arşiv" : "Tümü"}
            </button>
          ))}
        </div>
      </div>

      {/* Proje Grid */}
      {loadingProjects ? (
        <div className="text-center py-16 text-gray-400">
          <p className="text-sm">Yükleniyor...</p>
        </div>
      ) : filtered.length === 0 ? (
        <div className="text-center py-16 text-gray-400 dark:text-gray-600">
          <p className="text-lg">
            {search ? "Arama sonucu bulunamadı" : "Bu departmanda proje yok"}
          </p>
          {canCreate && !search && (
            <p className="text-sm mt-2">
              Yeni bir proje oluşturmak için yukarıdaki butonu kullanın
            </p>
          )}
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {filtered.map((project) => {
            const projEndDate = project.endDate ? new Date(project.endDate) : null;
            const isOverdue = projEndDate != null && projEndDate < new Date() && project.status === "ACTIVE";
            return (
              <a
                key={project.id}
                href={`/projeler/${project.id}`}
                className={`block bg-white dark:bg-gray-800 rounded-xl border p-5 hover:border-[#F57C28] hover:shadow-md transition-all ${
                  isOverdue
                    ? "border-red-200 dark:border-red-800"
                    : "border-gray-200 dark:border-gray-700"
                }`}
              >
                {/* Başlık + Badges */}
                <div className="flex items-start justify-between mb-3 gap-2">
                  <h3 className="font-semibold text-gray-900 dark:text-white leading-snug flex-1 min-w-0">
                    {project.name}
                  </h3>
                  <span
                    className={`px-2 py-0.5 rounded-full text-[10px] font-semibold flex-shrink-0 ${STATUS_COLORS[project.status] ?? STATUS_COLORS.ACTIVE}`}
                  >
                    {STATUS_LABELS[project.status] ?? project.status}
                  </span>
                </div>

                {/* Tarihler */}
                {(project.startDate || project.endDate) && (
                  <div className="flex items-center gap-3 text-xs text-gray-400 dark:text-gray-500 mb-3">
                    {project.startDate && (
                      <span>{new Date(project.startDate).toLocaleDateString("tr-TR", { day: "numeric", month: "short", year: "numeric" })}</span>
                    )}
                    {project.startDate && project.endDate && <span>→</span>}
                    {project.endDate && (
                      <span className={isOverdue ? "text-red-500 font-semibold" : ""}>
                        {new Date(project.endDate).toLocaleDateString("tr-TR", { day: "numeric", month: "short", year: "numeric" })}
                        {isOverdue && " ⚠"}
                      </span>
                    )}
                  </div>
                )}

                {/* Üye avatarları */}
                {project.members.length > 0 && (
                  <div className="flex items-center gap-1.5">
                    <div className="flex -space-x-1.5">
                      {project.members.slice(0, 4).map((m) => (
                        <div
                          key={m.user.id}
                          className="w-6 h-6 rounded-full bg-[#F57C28] border-2 border-white dark:border-gray-800 flex items-center justify-center text-[8px] font-bold text-white"
                          title={m.user.name}
                        >
                          {m.user.name.slice(0, 2).toUpperCase()}
                        </div>
                      ))}
                    </div>
                    {project.members.length > 4 && (
                      <span className="text-xs text-gray-400">+{project.members.length - 4} kişi</span>
                    )}
                  </div>
                )}
              </a>
            );
          })}
        </div>
      )}

      {/* Yeni Proje Modal */}
      {showCreate && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white dark:bg-gray-800 rounded-xl shadow-xl w-full max-w-lg max-h-[90vh] overflow-y-auto">
            <div className="px-6 py-4 border-b border-gray-200 dark:border-gray-700">
              <h2 className="text-lg font-semibold text-gray-900 dark:text-white">Yeni Proje</h2>
            </div>
            <form onSubmit={handleCreate} className="p-6 space-y-4">
              {error && (
                <div className="px-4 py-2 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg text-red-700 dark:text-red-400 text-sm">
                  {error}
                </div>
              )}

              {/* Proje Adı */}
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  Proje Adı *
                </label>
                <input
                  value={form.name}
                  onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
                  className="w-full border border-gray-300 dark:border-gray-600 rounded-lg px-3 py-2 text-sm bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                  required
                />
              </div>

              {/* Departman — Admin seçebilir; standart kullanıcı görür */}
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  Departman *
                </label>
                {isAdminOrGlobal ? (
                  <select
                    value={form.department}
                    onChange={(e) => setForm((f) => ({ ...f, department: e.target.value, memberIds: [] }))}
                    className="w-full border border-gray-300 dark:border-gray-600 rounded-lg px-3 py-2 text-sm bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                  >
                    {ALL_DEPTS.map((d) => (
                      <option key={d} value={d}>{DEPT_LABELS[d]}</option>
                    ))}
                  </select>
                ) : (
                  <p className="px-3 py-2 bg-gray-50 dark:bg-gray-700 rounded-lg text-sm text-gray-600 dark:text-gray-300">
                    {DEPT_LABELS[form.department] ?? form.department}
                  </p>
                )}
              </div>

              {/* Tarihler */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                    Başlangıç Tarihi
                  </label>
                  <input
                    type="date"
                    value={form.startDate}
                    onChange={(e) => setForm((f) => ({ ...f, startDate: e.target.value }))}
                    className="w-full border border-gray-300 dark:border-gray-600 rounded-lg px-3 py-2 text-sm bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                    Bitiş Tarihi
                  </label>
                  <input
                    type="date"
                    value={form.endDate}
                    onChange={(e) => setForm((f) => ({ ...f, endDate: e.target.value }))}
                    className="w-full border border-gray-300 dark:border-gray-600 rounded-lg px-3 py-2 text-sm bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                  />
                </div>
              </div>

              {/* Proje Açıklaması */}
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  Proje Açıklaması
                </label>
                <textarea
                  value={form.about}
                  onChange={(e) => setForm((f) => ({ ...f, about: e.target.value }))}
                  rows={3}
                  className="w-full border border-gray-300 dark:border-gray-600 rounded-lg px-3 py-2 text-sm bg-white dark:bg-gray-700 text-gray-900 dark:text-white resize-none"
                  placeholder="Proje hakkında açıklama..."
                />
              </div>

              {/* Üyeler */}
              {createFormDeptUsers.length > 0 && (
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                    Üyeler
                  </label>
                  <div className="max-h-40 overflow-y-auto border border-gray-300 dark:border-gray-600 rounded-lg divide-y divide-gray-100 dark:divide-gray-700">
                    {createFormDeptUsers.map((u) => (
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
