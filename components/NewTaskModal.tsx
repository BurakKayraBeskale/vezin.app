"use client";

import { useState, useEffect, FormEvent } from "react";
import { useSession } from "next-auth/react";
import { userDeptToProjectDept } from "@/lib/access";
import { TaskFull } from "./TaskModal";

interface AssignableUser {
  id: string;
  name: string;
  email: string;
  department: string;
  title: string | null;
  seniorityLevel: number;
}

interface ProjectOption {
  id: string;
  name: string;
  department: string;
  status: string;
}

const DEPT_LABELS: Record<string, string> = {
  OUTSOURCE: "Outsource",
  BAGIMSIZ_DENETIM: "Bağımsız Denetim",
  MUHASEBE: "Muhasebe",
  YMM: "YMM",
};

interface Props {
  /** Proje detay ekranından açılınca: sabit proje, değiştirilemez */
  fixedProjectId?: string;
  fixedProjectName?: string;
  /**
   * Alt görev oluşturma modu — TaskDetail'den açılır. Proje/departman seçimi
   * gösterilmez; backend zaten parent'ın projectId/departmentId'sini miras alır
   * (bkz. app/api/tasks/route.ts). fixedDepartmentId yalnızca atanabilir kişi
   * listesini doğru kapsamda çekmek için kullanılır (kullanıcı dept formatında).
   */
  parentTaskId?: string;
  parentTaskTitle?: string;
  fixedDepartmentId?: string;
  onClose: () => void;
  onCreate?: (task: TaskFull) => void;
}

export default function NewTaskModal({
  fixedProjectId,
  fixedProjectName,
  parentTaskId,
  parentTaskTitle,
  fixedDepartmentId,
  onClose,
  onCreate,
}: Props) {
  const { data: session } = useSession();
  const isAdmin = (session?.user as any)?.role === "ADMIN";
  const ownDepartment = (session?.user as any)?.department as string | undefined;
  const overseesDepartment = (session?.user as any)?.overseesDepartment as string | null | undefined;

  // Form state
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [projectId, setProjectId] = useState(fixedProjectId ?? "");
  const [assignedToId, setAssignedToId] = useState("");
  const [priority, setPriority] = useState("MEDIUM");
  const [dueDate, setDueDate] = useState("");
  const [departmentId, setDepartmentId] = useState("");
  const [isRecurring, setIsRecurring] = useState(false);
  const [recurringType, setRecurringType] = useState("WEEKLY");
  const [recurringDay, setRecurringDay] = useState("1");
  const [nextOccurrence, setNextOccurrence] = useState("");

  // Data state
  const [projects, setProjects] = useState<ProjectOption[]>([]);
  const [assignees, setAssignees] = useState<AssignableUser[]>([]);
  const [projectsLoading, setProjectsLoading] = useState(!fixedProjectId);
  const [assigneesLoading, setAssigneesLoading] = useState(true);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  // Atanan listesi filtrelemesi için proje ID / departman
  const effectiveProjectId = fixedProjectId || projectId || undefined;

  // Proje listesini yükle (sabit proje yoksa, ve alt görev modunda değilsek).
  // ADMIN: departman seçilmeden proje listesi hiç çekilmez (kademeli seçim).
  // Normal kullanıcı: /api/projects zaten getVisibleProjectIds ile üyesi
  // olduğu projelere/departmanına daraltıyor — burada ayrıca kendi departmanı
  // (veya gözetim departmanı varsa o) ile ek bir server-side filtre uygulanır;
  // bu salt savunma amaçlıdır, visWhere zaten daraltıyor, sonucu genişletmez.
  useEffect(() => {
    if (fixedProjectId || parentTaskId) return;

    if (isAdmin) {
      if (!departmentId) {
        setProjects([]);
        setProjectsLoading(false);
        return;
      }
      setProjectsLoading(true);
      fetch(`/api/projects?department=${encodeURIComponent(departmentId)}`)
        .then((r) => (r.ok ? r.json() : []))
        .then((data: any[]) => {
          if (Array.isArray(data)) setProjects(data.filter((p) => p.status === "ACTIVE"));
        })
        .catch(() => {})
        .finally(() => setProjectsLoading(false));
      return;
    }

    setProjectsLoading(true);
    const effectiveDept = overseesDepartment || userDeptToProjectDept(ownDepartment ?? "") || "";
    const qs = effectiveDept ? `?department=${encodeURIComponent(effectiveDept)}` : "";
    fetch(`/api/projects${qs}`)
      .then((r) => (r.ok ? r.json() : []))
      .then((data: any[]) => {
        if (Array.isArray(data)) setProjects(data.filter((p) => p.status === "ACTIVE"));
      })
      .catch(() => {})
      .finally(() => setProjectsLoading(false));
  }, [fixedProjectId, parentTaskId, isAdmin, departmentId, overseesDepartment, ownDepartment]);

  // Atanabilir kullanıcıları yükle — proje/departman değişince yeniden çek
  useEffect(() => {
    setAssigneesLoading(true);
    setAssignedToId("");
    const params = new URLSearchParams();
    if (effectiveProjectId) {
      params.set("projectId", effectiveProjectId);
    } else if (parentTaskId && fixedDepartmentId) {
      // Alt görev, projesiz üst görev — departman parent'tan miras alınır
      // (fixedDepartmentId zaten kullanıcı departman formatında, çeviri gerekmez)
      params.set("departmentId", fixedDepartmentId);
    } else if (departmentId) {
      // Admin'in seçtiği departman — proje departmanı formatında (DEPT_LABELS)
      params.set("projectDept", departmentId);
    } else if (ownDepartment) {
      // Departman seçilmemişse görev, oluşturanın departmanına düşer
      params.set("departmentId", ownDepartment);
    }
    fetch(`/api/users/assignable?${params}`)
      .then((r) => (r.ok ? r.json() : []))
      .then((data: AssignableUser[]) => {
        if (Array.isArray(data)) setAssignees(data);
      })
      .catch(() => {})
      .finally(() => setAssigneesLoading(false));
  }, [effectiveProjectId, departmentId, ownDepartment, parentTaskId, fixedDepartmentId]);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    if (!title.trim()) {
      setError("Başlık zorunlu");
      return;
    }
    if (!assignedToId) {
      setError("Atanan kişi zorunlu");
      return;
    }
    if (!parentTaskId && isAdmin && !projectId && !departmentId) {
      setError("Projesiz görev için departman seçmelisiniz");
      return;
    }

    setLoading(true);
    setError("");

    const payload: Record<string, unknown> = {
      title: title.trim(),
      description: description.trim() || null,
      priority,
      assignedToId,
      dueDate: dueDate || null,
      isRecurring,
      ...(parentTaskId
        ? { parentTaskId }
        : {
            projectId: projectId || null,
            ...(isAdmin && !projectId && departmentId ? { departmentId } : {}),
          }),
    };

    if (isRecurring) {
      payload.recurringType = recurringType;
      payload.recurringDay = recurringDay ? Number(recurringDay) : null;
      payload.nextOccurrence = nextOccurrence || null;
    }

    try {
      const res = await fetch("/api/tasks", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      if (!res.ok) {
        const data = await res.json();
        setError(data.error || "Bir hata oluştu");
        return;
      }
      const created: TaskFull = await res.json();
      onCreate?.(created);
      onClose();
    } catch {
      setError("Sunucu hatası");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="fixed inset-0 bg-black/40 backdrop-blur-sm flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg max-h-[95vh] overflow-y-auto">
        <div className="flex items-center justify-between p-6 border-b border-gray-100">
          <h2 className="text-lg font-bold text-gray-800">{parentTaskId ? "Yeni Alt Görev" : "Yeni Görev"}</h2>
          <button
            type="button"
            onClick={onClose}
            className="p-2 rounded-xl text-gray-400 hover:bg-gray-100 transition-colors"
          >
            <svg
              className="w-5 h-5"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
              strokeWidth={2}
            >
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          {/* Başlık */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1.5">
              Başlık *
            </label>
            <input
              type="text"
              required
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Görev başlığı"
              className="w-full px-3.5 py-2.5 rounded-xl border border-gray-200 text-sm text-gray-800 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-[#F57C28]/30 focus:border-[#F57C28]"
            />
          </div>

          {/* Açıklama */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1.5">Açıklama</label>
            <textarea
              rows={3}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="İsteğe bağlı açıklama"
              className="w-full px-3.5 py-2.5 rounded-xl border border-gray-200 text-sm text-gray-800 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-[#F57C28]/30 focus:border-[#F57C28] resize-none"
            />
          </div>

          {/* Alt görev modu: proje/departman seçimi yok — parent'tan miras alınır */}
          {parentTaskId ? (
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1.5">Üst Görev</label>
              <div className="px-3.5 py-2.5 rounded-xl border border-gray-100 bg-gray-50 text-sm text-gray-600">
                {parentTaskTitle ?? parentTaskId}
              </div>
              <p className="mt-1 text-xs text-gray-400">
                Proje/departman üst görevden otomatik alınır.
              </p>
            </div>
          ) : (
            <>
              {/* Departman — ADMIN için EN ÜSTTE, proje seçiminden önce zorunlu */}
              {isAdmin && !fixedProjectId && (
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1.5">
                    Departman *
                  </label>
                  <select
                    value={departmentId}
                    onChange={(e) => {
                      setDepartmentId(e.target.value);
                      // Departman değişince proje ve atanan seçimleri sıfırlanır
                      // (atanan zaten assignee-fetch effect'inde otomatik sıfırlanıyor)
                      setProjectId("");
                    }}
                    required
                    className="w-full px-3 py-2.5 rounded-xl border border-gray-200 text-sm text-gray-700 bg-white focus:outline-none focus:ring-2 focus:ring-[#F57C28]/30 focus:border-[#F57C28]"
                  >
                    <option value="">— Departman seçin —</option>
                    {Object.entries(DEPT_LABELS).map(([val, label]) => (
                      <option key={val} value={val}>
                        {label}
                      </option>
                    ))}
                  </select>
                </div>
              )}

              {/* Proje */}
              {fixedProjectId ? (
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1.5">Proje</label>
                  <div className="px-3.5 py-2.5 rounded-xl border border-gray-100 bg-gray-50 text-sm text-gray-600">
                    {fixedProjectName ?? fixedProjectId}
                  </div>
                </div>
              ) : (
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1.5">Proje</label>
                  {isAdmin && !departmentId ? (
                    <div className="px-3.5 py-2.5 rounded-xl border border-dashed border-gray-200 bg-gray-50 text-sm text-gray-400 italic">
                      Önce departman seçin
                    </div>
                  ) : projectsLoading ? (
                    <div className="text-sm text-gray-400 py-2.5">Yükleniyor...</div>
                  ) : (
                    <select
                      value={projectId}
                      onChange={(e) => setProjectId(e.target.value)}
                      className="w-full px-3 py-2.5 rounded-xl border border-gray-200 text-sm text-gray-700 bg-white focus:outline-none focus:ring-2 focus:ring-[#F57C28]/30 focus:border-[#F57C28]"
                    >
                      <option value="">— Projesiz —</option>
                      {projects.map((p) => (
                        <option key={p.id} value={p.id}>
                          {p.name}
                        </option>
                      ))}
                    </select>
                  )}
                </div>
              )}
            </>
          )}

          {/* Atanan kişi */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1.5">
              Atanan Kişi *
            </label>
            {assigneesLoading ? (
              <div className="text-sm text-gray-400 py-2.5">Yükleniyor...</div>
            ) : (
              <select
                value={assignedToId}
                onChange={(e) => setAssignedToId(e.target.value)}
                required
                className="w-full px-3 py-2.5 rounded-xl border border-gray-200 text-sm text-gray-700 bg-white focus:outline-none focus:ring-2 focus:ring-[#F57C28]/30 focus:border-[#F57C28]"
              >
                <option value="">— Kişi seçin —</option>
                {assignees.map((u) => (
                  <option key={u.id} value={u.id}>
                    {u.name}
                  </option>
                ))}
              </select>
            )}
          </div>

          {/* Öncelik + Son Tarih */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1.5">Öncelik</label>
              <select
                value={priority}
                onChange={(e) => setPriority(e.target.value)}
                className="w-full px-3 py-2.5 rounded-xl border border-gray-200 text-sm text-gray-700 bg-white focus:outline-none focus:ring-2 focus:ring-[#F57C28]/30 focus:border-[#F57C28]"
              >
                <option value="LOW">Düşük</option>
                <option value="MEDIUM">Orta</option>
                <option value="HIGH">Yüksek</option>
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1.5">
                Son Tarih
              </label>
              <input
                type="date"
                value={dueDate}
                onChange={(e) => setDueDate(e.target.value)}
                className="w-full px-3 py-2.5 rounded-xl border border-gray-200 text-sm text-gray-700 focus:outline-none focus:ring-2 focus:ring-[#F57C28]/30 focus:border-[#F57C28]"
              />
            </div>
          </div>

          {/* Tekrarlayan görev */}
          <div className="rounded-xl border border-gray-100 bg-gray-50 p-3.5">
            <label className="flex items-center gap-2.5 cursor-pointer">
              <input
                type="checkbox"
                checked={isRecurring}
                onChange={(e) => setIsRecurring(e.target.checked)}
                className="w-4 h-4 rounded accent-[#F57C28]"
              />
              <span className="text-sm font-medium text-gray-700">Tekrarlayan görev</span>
            </label>
            {isRecurring && (
              <div className="mt-3 space-y-3">
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-medium text-gray-500 mb-1">
                      Tekrar Türü
                    </label>
                    <select
                      value={recurringType}
                      onChange={(e) => setRecurringType(e.target.value)}
                      className="w-full px-3 py-2 rounded-lg border border-gray-200 text-sm text-gray-700 bg-white focus:outline-none focus:ring-2 focus:ring-[#F57C28]/30 focus:border-[#F57C28]"
                    >
                      <option value="DAILY">Her Gün</option>
                      <option value="WEEKLY">Haftalık</option>
                      <option value="MONTHLY">Aylık</option>
                      <option value="YEARLY">Yıllık</option>
                    </select>
                  </div>
                  {(recurringType === "MONTHLY" || recurringType === "WEEKLY") && (
                    <div>
                      <label className="block text-xs font-medium text-gray-500 mb-1">
                        {recurringType === "MONTHLY"
                          ? "Ayın Günü (1-31)"
                          : "Haftanın Günü (1=Pt)"}
                      </label>
                      <input
                        type="number"
                        min="1"
                        max={recurringType === "MONTHLY" ? 31 : 7}
                        value={recurringDay}
                        onChange={(e) => setRecurringDay(e.target.value)}
                        className="w-full px-3 py-2 rounded-lg border border-gray-200 text-sm text-gray-700 focus:outline-none focus:ring-2 focus:ring-[#F57C28]/30 focus:border-[#F57C28]"
                      />
                    </div>
                  )}
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-500 mb-1">
                    İlk Tekrar Tarihi
                  </label>
                  <input
                    type="date"
                    value={nextOccurrence}
                    onChange={(e) => setNextOccurrence(e.target.value)}
                    className="w-full px-3 py-2 rounded-lg border border-gray-200 text-sm text-gray-700 focus:outline-none focus:ring-2 focus:ring-[#F57C28]/30 focus:border-[#F57C28]"
                  />
                </div>
              </div>
            )}
          </div>

          {error && (
            <div className="bg-red-50 border border-red-200 text-red-600 text-sm rounded-xl px-4 py-2.5">
              {error}
            </div>
          )}

          <div className="flex gap-3 pt-1">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 px-4 py-2.5 rounded-xl border border-gray-200 text-sm font-medium text-gray-600 hover:bg-gray-50 transition-colors"
            >
              İptal
            </button>
            <button
              type="submit"
              disabled={loading}
              className="flex-1 px-4 py-2.5 rounded-xl bg-[#F57C28] hover:bg-[#D96A1A] disabled:opacity-60 text-white text-sm font-semibold transition-colors shadow-md shadow-[#F57C28]/25"
            >
              {loading ? "Oluşturuluyor..." : "Görev Oluştur"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
