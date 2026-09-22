"use client";

/**
 * TEK ortak Task Form — Yeni Görev VE Görevi Düzenle bu bileşeni kullanır.
 *
 * mode = "create" → POST /api/tasks
 * mode = "edit"   → PATCH /api/tasks/[id] (yalnızca bu task kaydını etkiler;
 *                   tekrarlayan görev serisinin şablonu RecurringSeriesPanel/
 *                   RecurringSeriesEditModal üzerinden ayrıca yönetilir)
 *
 * Ortak: alan tanımları (lib/task-fields.ts), atanabilir kişi listesi
 * (/api/users/assignable → lib/task-assignment.ts getEligibleAssignees),
 * departman/proje doğrulaması, öncelik değerleri, son tarih validasyonu.
 *
 * Farklı olan yalnızca: başlangıç değerleri, edit yetkisi (canManageTask zaten
 * çağıran tarafta kontrol edilir — bu bileşen yalnızca hangi alanların
 * DÜZENLENEBİLİR olduğuna karar verir: Departman her zaman salt okunur, Proje
 * yalnızca canMoveTaskToProject(user) olan ve kök (üst görevi olmayan) görevde
 * düzenlenebilir), yeniden atama yan etkileri (backend'de PATCH /api/tasks/[id]
 * hallediyor: status→Yapılacak, reviewOwner→işlemi yapan, assignmentLevelSnapshot),
 * ve immutable alanlar (Departman salt okunur; alt görevde Proje salt okunur).
 */

import { useState, useEffect, useRef, FormEvent } from "react";
import { useSession } from "next-auth/react";
import { userDeptToProjectDept, projectDeptToUserDept } from "@/lib/access";
import { canMoveTaskToProject } from "@/lib/task-permissions";
import { PRIORITY_OPTIONS, DEFAULT_PRIORITY, PROJECT_DEPT_LABELS, USER_DEPT_LABELS } from "@/lib/task-fields";
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

interface Props {
  mode: "create" | "edit";
  /** mode="edit" için zorunlu — düzenlenecek görev. */
  task?: TaskFull | null;
  /** Proje detay ekranından açılınca (yalnızca create): sabit proje, değiştirilemez. */
  fixedProjectId?: string;
  fixedProjectName?: string;
  /** Alt görev oluşturma modu (yalnızca create) — TaskDetail'den açılır. */
  parentTaskId?: string;
  parentTaskTitle?: string;
  fixedDepartmentId?: string;
  onClose: () => void;
  onCreate?: (task: TaskFull) => void;
  onUpdate?: (task: TaskFull) => void;
}

export default function TaskForm({
  mode,
  task,
  fixedProjectId,
  fixedProjectName,
  parentTaskId,
  parentTaskTitle,
  fixedDepartmentId,
  onClose,
  onCreate,
  onUpdate,
}: Props) {
  const isEdit = mode === "edit";
  const { data: session } = useSession();
  const currentUser = session?.user as any;
  const isAdmin = currentUser?.role === "ADMIN";
  const ownDepartment = currentUser?.department as string | undefined;
  const overseesDepartment = currentUser?.overseesDepartment as string | null | undefined;
  const canViewAllProjects = !!currentUser?.canViewAllProjects;
  const seniorityLevel = (currentUser?.seniorityLevel as number) ?? 0;

  // Alt görev mi (üst görevi var mı)? Alt görevin projesi tek başına değiştirilemez.
  const isSubtask = isEdit && !!task?.parent;

  // Düzenleyen kullanıcı bu görevi başka bir projeye taşıyabilir mi?
  const canMoveProject =
    isEdit &&
    !isSubtask &&
    currentUser &&
    canMoveTaskToProject({
      id: currentUser.id,
      role: currentUser.role,
      seniorityLevel,
      canViewAllProjects,
      overseesDepartment,
      department: ownDepartment,
    });

  // Görevin (değişmeyen) departmanı — proje dışıysa departmentId, projeliyse project.department'tan türetilir.
  const baseUserDept: string | null = isEdit && task
    ? (task.project ? projectDeptToUserDept(task.project.department) : task.departmentId ?? null)
    : null;
  const baseProjectDept: string | null = isEdit && task
    ? (task.project ? task.project.department : userDeptToProjectDept(task.departmentId ?? ""))
    : null;

  // Form state
  const [title, setTitle] = useState(task?.title ?? "");
  const [description, setDescription] = useState(task?.description ?? "");
  const [projectId, setProjectId] = useState(task?.projectId ?? fixedProjectId ?? "");
  const [assignedToId, setAssignedToId] = useState(task?.assignedToId ?? "");
  const [priority, setPriority] = useState<string>(task?.priority ?? DEFAULT_PRIORITY);
  const [dueDate, setDueDate] = useState(task?.dueDate ? task.dueDate.slice(0, 10) : "");
  const [departmentId, setDepartmentId] = useState(""); // yalnızca create + ADMIN, projesiz görev
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

  const isFirstAssigneeFetch = useRef(true);

  // Atanan listesi filtrelemesi için proje ID / departman
  const effectiveProjectId = isEdit ? (projectId || undefined) : (fixedProjectId || projectId || undefined);

  // ── Proje listesini yükle ────────────────────────────────────────────────
  useEffect(() => {
    if (fixedProjectId || parentTaskId) return;

    if (isEdit) {
      // Düzenlemede departman SABİTTİR — proje listesi daima görevin kendi
      // departmanıyla sınırlıdır (alt görevde veya taşıma yetkisi yoksa hiç
      // çekilmez, çünkü seçici zaten salt okunur gösterilir).
      if (isSubtask || !canMoveProject || !baseProjectDept) {
        setProjectsLoading(false);
        return;
      }
      setProjectsLoading(true);
      fetch(`/api/projects?department=${encodeURIComponent(baseProjectDept)}`)
        .then((r) => (r.ok ? r.json() : []))
        .then((data: any[]) => {
          if (Array.isArray(data)) setProjects(data.filter((p) => p.status === "ACTIVE"));
        })
        .catch(() => {})
        .finally(() => setProjectsLoading(false));
      return;
    }

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
  }, [fixedProjectId, parentTaskId, isEdit, isSubtask, canMoveProject, baseProjectDept, isAdmin, departmentId, overseesDepartment, ownDepartment]);

  // ── Atanabilir kullanıcıları yükle — proje/departman değişince yeniden çek ──
  useEffect(() => {
    setAssigneesLoading(true);
    const params = new URLSearchParams();
    if (effectiveProjectId) {
      params.set("projectId", effectiveProjectId);
    } else if (isEdit) {
      if (baseUserDept) params.set("departmentId", baseUserDept);
    } else if (parentTaskId && fixedDepartmentId) {
      params.set("departmentId", fixedDepartmentId);
    } else if (departmentId) {
      params.set("projectDept", departmentId);
    } else if (ownDepartment) {
      params.set("departmentId", ownDepartment);
    }
    fetch(`/api/users/assignable?${params}`)
      .then((r) => (r.ok ? r.json() : []))
      .then((data: AssignableUser[]) => {
        if (!Array.isArray(data)) return;
        setAssignees(data);
        if (isFirstAssigneeFetch.current) {
          // İlk yüklemede mevcut atananı koru — liste dışında olsa bile (ör.
          // düzenleyenin kıdemi mevcut atanandan düşükse listede görünmez ama
          // değer değiştirilmediği sürece bu no-op'tur, backend de izin verir).
          isFirstAssigneeFetch.current = false;
          return;
        }
        // Proje/departman değişti — önceki seçim yeni kapsamda geçersizse sıfırla.
        setAssignedToId((prev) => (prev && data.some((u) => u.id === prev) ? prev : ""));
      })
      .catch(() => {})
      .finally(() => setAssigneesLoading(false));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [effectiveProjectId, isEdit, baseUserDept, departmentId, ownDepartment, parentTaskId, fixedDepartmentId]);

  // Mevcut atanan kişi eligibility listesinde yoksa bile gösterime ekle (display-only).
  const assigneeOptions: AssignableUser[] =
    isEdit && task?.assignedTo && !assignees.some((u) => u.id === task.assignedTo!.id)
      ? [{ id: task.assignedTo.id, name: task.assignedTo.name, email: task.assignedTo.email ?? "", department: "", title: null, seniorityLevel: 0 }, ...assignees]
      : assignees;

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
    if (!isEdit && !parentTaskId && isAdmin && !projectId && !departmentId) {
      setError("Projesiz görev için departman seçmelisiniz");
      return;
    }

    setLoading(true);
    setError("");

    try {
      let res: Response;

      if (isEdit) {
        const payload: Record<string, unknown> = {
          title: title.trim(),
          description: description.trim() || null,
          priority,
          assignedToId,
          dueDate: dueDate || null,
        };
        if (!isSubtask) {
          payload.projectId = projectId || null;
        }
        res = await fetch(`/api/tasks/${task!.id}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        });
      } else {
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
        res = await fetch("/api/tasks", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        });
      }

      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        setError(data.error || "Bir hata oluştu");
        return;
      }
      const result: TaskFull = await res.json();
      if (isEdit) onUpdate?.(result);
      else onCreate?.(result);
      onClose();
    } catch {
      setError("Sunucu hatası");
    } finally {
      setLoading(false);
    }
  }

  const currentProjectLabel = isEdit
    ? (task?.project ? task.project.name : "Projesiz")
    : "";
  const departmentLabel = isEdit
    ? (task?.project
        ? PROJECT_DEPT_LABELS[task.project.department] ?? task.project.department
        : USER_DEPT_LABELS[task?.departmentId ?? ""] ?? task?.departmentId ?? "—")
    : "";

  return (
    <div className="fixed inset-0 bg-black/40 backdrop-blur-sm flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg max-h-[95vh] overflow-y-auto">
        <div className="flex items-center justify-between p-6 border-b border-gray-100">
          <h2 className="text-lg font-bold text-gray-800">
            {isEdit ? "Görevi Düzenle" : parentTaskId ? "Yeni Alt Görev" : "Yeni Görev"}
          </h2>
          <button
            type="button"
            onClick={onClose}
            className="p-2 rounded-xl text-gray-400 hover:bg-gray-100 transition-colors"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          {/* Başlık */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1.5">Başlık *</label>
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

          {isEdit ? (
            <>
              {/* Departman — daima salt okunur; görevin güvenlik sınırıdır */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1.5">Departman</label>
                <div className="px-3.5 py-2.5 rounded-xl border border-gray-100 bg-gray-50 text-sm text-gray-600">
                  {departmentLabel}
                </div>
              </div>

              {/* Proje — alt görevde veya taşıma yetkisi yoksa salt okunur */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1.5">Proje</label>
                {isSubtask ? (
                  <div className="px-3.5 py-2.5 rounded-xl border border-gray-100 bg-gray-50 text-sm text-gray-600">
                    {currentProjectLabel}
                    <span className="block mt-0.5 text-xs text-gray-400">
                      Alt görevin projesi üst görevden miras alınır, tek başına değiştirilemez.
                    </span>
                  </div>
                ) : !canMoveProject ? (
                  <div className="px-3.5 py-2.5 rounded-xl border border-gray-100 bg-gray-50 text-sm text-gray-600">
                    {currentProjectLabel}
                  </div>
                ) : projectsLoading ? (
                  <div className="text-sm text-gray-400 py-2.5">Yükleniyor...</div>
                ) : (
                  <>
                    <select
                      value={projectId}
                      onChange={(e) => setProjectId(e.target.value)}
                      className="w-full px-3 py-2.5 rounded-xl border border-gray-200 text-sm text-gray-700 bg-white focus:outline-none focus:ring-2 focus:ring-[#F57C28]/30 focus:border-[#F57C28]"
                    >
                      <option value="">— Projesiz —</option>
                      {projects.map((p) => (
                        <option key={p.id} value={p.id}>{p.name}</option>
                      ))}
                    </select>
                    {(task?.children?.length ?? 0) > 0 && (
                      <p className="mt-1 text-xs text-gray-400">
                        Bu görevin {task!.children!.length} alt görevi de projeyle birlikte taşınacak.
                      </p>
                    )}
                  </>
                )}
              </div>
            </>
          ) : parentTaskId ? (
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1.5">Üst Görev</label>
              <div className="px-3.5 py-2.5 rounded-xl border border-gray-100 bg-gray-50 text-sm text-gray-600">
                {parentTaskTitle ?? parentTaskId}
              </div>
              <p className="mt-1 text-xs text-gray-400">Proje/departman üst görevden otomatik alınır.</p>
            </div>
          ) : (
            <>
              {/* Departman — ADMIN için EN ÜSTTE, proje seçiminden önce zorunlu */}
              {isAdmin && !fixedProjectId && (
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1.5">Departman *</label>
                  <select
                    value={departmentId}
                    onChange={(e) => {
                      setDepartmentId(e.target.value);
                      setProjectId("");
                    }}
                    required
                    className="w-full px-3 py-2.5 rounded-xl border border-gray-200 text-sm text-gray-700 bg-white focus:outline-none focus:ring-2 focus:ring-[#F57C28]/30 focus:border-[#F57C28]"
                  >
                    <option value="">— Departman seçin —</option>
                    {Object.entries(PROJECT_DEPT_LABELS).map(([val, label]) => (
                      <option key={val} value={val}>{label}</option>
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
                        <option key={p.id} value={p.id}>{p.name}</option>
                      ))}
                    </select>
                  )}
                </div>
              )}
            </>
          )}

          {/* Atanan kişi */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1.5">Atanan Kişi *</label>
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
                {assigneeOptions.map((u) => (
                  <option key={u.id} value={u.id}>
                    {u.name}
                    {isEdit && task?.assignedTo?.id === u.id ? " (mevcut)" : ""}
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
                {PRIORITY_OPTIONS.map((p) => (
                  <option key={p.value} value={p.value}>{p.label}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1.5">Son Tarih</label>
              <input
                type="date"
                value={dueDate}
                onChange={(e) => setDueDate(e.target.value)}
                className="w-full px-3 py-2.5 rounded-xl border border-gray-200 text-sm text-gray-700 focus:outline-none focus:ring-2 focus:ring-[#F57C28]/30 focus:border-[#F57C28]"
              />
            </div>
          </div>

          {/* Tekrarlayan görev — yalnızca oluştururken karar verilir; mevcut bir
              görevin tekrar ayarları RecurringSeriesPanel ("Seriyi Düzenle") ile
              yönetilir, tekil occurrence düzenlemesiyle karıştırılmaz. */}
          {!isEdit && (
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
                      <label className="block text-xs font-medium text-gray-500 mb-1">Tekrar Türü</label>
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
                          {recurringType === "MONTHLY" ? "Ayın Günü (1-31)" : "Haftanın Günü (1=Pt)"}
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
                    <label className="block text-xs font-medium text-gray-500 mb-1">İlk Tekrar Tarihi</label>
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
          )}

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
              {loading ? "Kaydediliyor..." : isEdit ? "Güncelle" : "Görev Oluştur"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
