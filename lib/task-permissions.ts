/**
 * Merkezi görev permission motoru — A+C BLOĞU
 *
 * 9 kural sistemi (öncelik sırası):
 *   1. ADMIN → daima görür (departman kapısı UYGULANMAZ)
 *   2. canViewAllProjects = true → tüm görevleri görür (departman kapısı UYGULANMAZ)
 *   3. Departman kapısı: görev departmanı kullanıcı departmanıyla eşleşmeli
 *      (kendi departmanı VEYA overseesDepartment eşleşmesi geçerlidir)
 *   4. overseesDepartment eşleşmesi → gözetmen departmanının tüm görevlerini görür
 *   5. seniorityLevel ≥ 11 aynı departman → tüm departman görevlerini görür
 *   6. assignedToId = userId → görür
 *   7. createdById = userId → görür
 *   8. project.createdById = userId → görür
 *   9. reviewOwnerId = userId → görür
 *
 * Departman kapısı notu:
 *   - ADMIN ve canViewAllProjects departman kapısının ÜSTÜNDEDIR
 *   - Projesiz görevler: departmentId (user dept formatı) kullanılır
 */

import { userDeptToProjectDept, projectDeptToUserDept } from "@/lib/access";

export type TaskPermUser = {
  id: string;
  role: string;
  department?: string;
  seniorityLevel?: number;
  canViewAllProjects: boolean;
  overseesDepartment?: string | null;
};

// ── Tek görev görünürlük kontrolü ────────────────────────────────────────────

/**
 * 9 kural sistemi — tek görev için görünürlük kontrolü.
 *
 * task.projectDepartment : proje tabanlı görevlerde project.department değeri
 * task.departmentId      : proje dışı görevlerde departman (user dept formatı)
 * task.projectCreatedById: task.project.createdById (proje kurucusu erişimi için)
 */
export function canViewTask(
  user: TaskPermUser,
  task: {
    assignedToId?: string | null;
    createdById: string;
    reviewOwnerId?: string | null;
    projectDepartment?: string | null;
    projectCreatedById?: string | null;
    projectId?: string | null;
    departmentId?: string | null;
    deletedAt?: Date | null;
  }
): boolean {
  // Silinmiş görev hiçbir zaman görünmez
  if (task.deletedAt) return false;

  // Kural 1: ADMIN her zaman görür (departman kapısı atlanır)
  if (user.role === "ADMIN") return true;

  // Kural 2: canViewAllProjects → tüm görevler (departman kapısı atlanır)
  if (user.canViewAllProjects) return true;

  // Görevin departman bilgisini belirle
  const taskProjDept = task.projectDepartment ?? null;
  // taskUserDept: user dept formatında görev departmanı
  const taskUserDept = taskProjDept
    ? projectDeptToUserDept(taskProjDept)   // project dept → user dept
    : task.departmentId ?? null;            // proje dışı: zaten user dept formatında

  const od = user.overseesDepartment ?? null;

  // Departman kapısı (Kural 3): departman bilgisi varsa eşleşme kontrolü
  if (taskProjDept !== null || taskUserDept !== null) {
    const ownDeptMatch =
      user.department != null && user.department === taskUserDept;
    const overseerMatch =
      od != null && od === taskProjDept;
    if (!ownDeptMatch && !overseerMatch) return false;
  }

  // Kural 4: overseesDepartment → gözetim altındaki departmanın tüm görevleri
  if (od && od === taskProjDept) return true;

  // Kural 5: Senior Manager+ (level ≥ 11) kendi departmanında
  const sl = user.seniorityLevel ?? 0;
  if (sl >= 11 && user.department != null && user.department === taskUserDept) return true;

  // Kural 6: Göreve atanan kişi
  if (task.assignedToId === user.id) return true;

  // Kural 7: Görevi oluşturan kişi
  if (task.createdById === user.id) return true;

  // Kural 8: Projeyi oluşturan kişi (yalnızca kendi departmanında — kapı zaten geçildi)
  if (task.projectCreatedById != null && task.projectCreatedById === user.id) return true;

  // Kural 9: İnceleme sahibi
  if (task.reviewOwnerId != null && task.reviewOwnerId === user.id) return true;

  return false;
}

// ── C BLOĞU: İş akışı yetki fonksiyonları ───────────────────────────────────

export type WorkflowUser = {
  id: string;
  role: string;
  seniorityLevel?: number;
  canViewAllProjects?: boolean;
  overseesDepartment?: string | null;
  department?: string;
};

/** İnceleme sahibi (reviewOwner) mi? */
function isReviewOwner(userId: string, task: { reviewOwnerId?: string | null }): boolean {
  return task.reviewOwnerId === userId;
}

/** Yönetici yetkisi var mı? (Admin / canViewAllProjects / overseesDepartment) */
function isManager(user: WorkflowUser): boolean {
  return (
    user.role === "ADMIN" ||
    user.canViewAllProjects === true ||
    user.overseesDepartment != null
  );
}

/** Senior Manager+ (kıdem ≥ 11) */
function isSeniorManager(user: WorkflowUser): boolean {
  return (user.seniorityLevel ?? 0) >= 11;
}

/**
 * Görevi inceleme yetkisi — yalnızca reviewOwner veya yönetici.
 * Durum: REVIEW → (DONE veya TODO)
 */
export function canReviewTask(
  user: WorkflowUser,
  task: { reviewOwnerId?: string | null; assignedToId?: string | null }
): boolean {
  if (isReviewOwner(user.id, task)) return true;
  if (isManager(user)) return true;
  if (isSeniorManager(user)) return true;
  return false;
}

/**
 * Görevi yeniden açma yetkisi — yalnızca reviewOwner veya yönetici.
 * Durum: DONE → TODO (action:"reopen")
 */
export function canReopenTask(
  user: WorkflowUser,
  task: { reviewOwnerId?: string | null }
): boolean {
  if (isReviewOwner(user.id, task)) return true;
  if (isManager(user)) return true;
  return false;
}

/**
 * İncelemeye gönderme yetkisi — yalnızca atanan kişi.
 * Durum: IN_PROGRESS → REVIEW
 */
export function canSubmitForReview(
  user: WorkflowUser,
  task: { assignedToId?: string | null }
): boolean {
  return task.assignedToId === user.id;
}

/**
 * İnceleme devrimi (take-over) yetkisi.
 * Koşul: kullanıcı mevcut reviewOwner değil, ve daha yüksek kıdem veya yönetici.
 */
export function canTakeOverReview(
  user: WorkflowUser,
  task: {
    reviewOwnerId?: string | null;
    reviewOwnerSeniorityLevel?: number | null;
  }
): boolean {
  if (task.reviewOwnerId === user.id) return false; // Zaten reviewOwner
  if (user.role === "ADMIN" || user.canViewAllProjects) return true;
  const ownerLevel = task.reviewOwnerSeniorityLevel ?? 0;
  const userLevel = user.seniorityLevel ?? 0;
  return userLevel > ownerLevel;
}

/**
 * Alt görev oluşturma yetkisi.
 * Hakkı olanlar: parent'ın assignee, reviewOwner, proje yöneticisi veya yönetici.
 */
export function canCreateSubtask(
  user: WorkflowUser,
  parentTask: {
    assignedToId?: string | null;
    reviewOwnerId?: string | null;
    projectCreatedById?: string | null;
  }
): boolean {
  if (user.id === parentTask.assignedToId) return true;
  if (isReviewOwner(user.id, parentTask)) return true;
  if (isManager(user)) return true;
  if (isSeniorManager(user)) return true;
  if (user.id === parentTask.projectCreatedById) return true;
  return false;
}

/**
 * Görev yeniden atama yetkisi.
 * Atayan, hedefin kıdemi üzerinde olmalı (ya da yönetici).
 */
export function canReassignTask(
  assigner: WorkflowUser,
  targetSeniorityLevel: number
): boolean {
  if (assigner.role === "ADMIN" || assigner.canViewAllProjects) return true;
  return (assigner.seniorityLevel ?? 0) > targetSeniorityLevel;
}

/**
 * Görevi farklı bir projeye taşıma yetkisi — yalnızca yönetici.
 */
export function canMoveTaskToProject(user: WorkflowUser): boolean {
  return isManager(user) || isSeniorManager(user);
}

/**
 * Kaynak (TaskSource) ekleme/silme yetkisi.
 * Atanan kişi ekleyemez; reviewOwner, Senior Manager+ ve Admin ekleyebilir.
 */
export function canManageTaskSource(
  user: WorkflowUser,
  task: { assignedToId?: string | null; reviewOwnerId?: string | null }
): boolean {
  if (task.assignedToId === user.id) return false;
  if (isReviewOwner(user.id, task)) return true;
  if (isManager(user)) return true;
  if (isSeniorManager(user)) return true;
  return false;
}

/**
 * Görev ana bilgilerini (başlık, açıklama, öncelik, son tarih, atanan, proje)
 * düzenleme yetkisi.
 * Hakkı olanlar: reviewOwner, yönetici (Admin/canViewAllProjects/overseesDepartment),
 * Senior Manager+/Partner (kıdem ≥ 11).
 * Atanan kişi ana bilgileri değiştiremez. Tamamlanmış (DONE) görev salt okunurdur
 * (önce Yeniden Aç gerekir).
 */
export function canManageTask(
  user: WorkflowUser,
  task: { assignedToId?: string | null; reviewOwnerId?: string | null; status?: string }
): boolean {
  if (task.status === "DONE") return false;
  if (task.assignedToId === user.id) return false;
  if (isReviewOwner(user.id, task)) return true;
  if (isManager(user)) return true;
  if (isSeniorManager(user)) return true;
  return false;
}

// ── D BLOĞU: Görev atama yetkisi (lib/access.ts'ten taşındı) ────────────────

/**
 * Görev atama yetkisi (kıdeme bağlı):
 *   Atayan, hedefin seniorityLevel'ını KESİNLİKLE geçmelidir.
 */
export function canAssignTask(assignerLevel: number, targetLevel: number): boolean {
  return assignerLevel > targetLevel;
}

/**
 * Atama istisnası: belirli atayan → hedef e-posta çiftlerine,
 * canBeAssignedTasks=false kuralının uygulanmadığı istisnalar.
 */
export const ASSIGN_EXCEPTIONS: Record<string, string[]> = {
  "muratozgur@vezin.com.tr": ["ebubekirozturk@vezin.com.tr"],
};

/**
 * Proje içinde görev atama yetkisi — tek doğru kaynak (UI ve API kullanır).
 */
export function canAssignTaskInProject(
  assigner: {
    id: string;
    role: string;
    canViewAllProjects: boolean;
    overseesDepartment?: string | null;
    seniorityLevel: number;
    department?: string;
    email?: string;
  },
  project: { department: string; createdById: string },
  target?: { seniorityLevel: number; canBeAssignedTasks?: boolean; email?: string }
): boolean {
  if (target && target.canBeAssignedTasks === false) {
    const exceptions = ASSIGN_EXCEPTIONS[assigner.email?.toLowerCase() ?? ""] ?? [];
    if (!exceptions.includes(target.email?.toLowerCase() ?? "")) return false;
  }
  if (assigner.role === "ADMIN" || assigner.canViewAllProjects) return true;
  // Proje otoritesi
  const userProjectDept = userDeptToProjectDept(assigner.department ?? "");
  const hasProjectAuthority =
    (assigner.overseesDepartment != null && assigner.overseesDepartment === project.department) ||
    (assigner.seniorityLevel >= 11 && userProjectDept === project.department) ||
    assigner.id === project.createdById;
  if (!hasProjectAuthority) return false;
  if (!target) return true;
  return assigner.seniorityLevel > target.seniorityLevel;
}

/**
 * Görev silme yetkisi.
 * A BLOĞU: assignedToId tek kaynak — assigneeIds artık kontrol edilmiyor.
 *
 * ADMIN / canViewAllProjects: KOŞULSUZ istisna — "atanan kişi silemez" kuralı
 * dahil hiçbir alt kurala tabi değildir. Bu yüzden bu kontrol en başta yapılır;
 * aksi halde ADMIN kendi üzerine atanmış bir görevi silmeye çalıştığında
 * (assignedToId === user.id) aşağıdaki "atanan silemez" kuralına takılıp
 * reddedilirdi.
 */
export function canDeleteTask(
  user: { id: string; role: string; canViewAllProjects: boolean; overseesDepartment?: string | null; department?: string; seniorityLevel?: number },
  task: { createdById: string; assignedToId?: string | null },
  project?: { department: string; createdById: string } | null
): boolean {
  if (user.role === "ADMIN" || user.canViewAllProjects) return true;
  // Göreve atanan kişi silemez
  if (task.assignedToId === user.id) return false;
  if (project != null) {
    const userProjectDept = userDeptToProjectDept(user.department ?? "");
    if (user.overseesDepartment != null && user.overseesDepartment === project.department) return true;
    if ((user.seniorityLevel ?? 0) >= 11 && userProjectDept === project.department) return true;
  }
  if (task.createdById === user.id) return true;
  if (project != null && project.createdById === user.id) return true;
  return false;
}

// ── Prisma WHERE filtresi ────────────────────────────────────────────────────

/**
 * Liste sorguları için Prisma WHERE filtresi üretir.
 * Daima `deletedAt: null` içerir.
 *
 * Departman kapısı iç içe proje koşullarıyla uygulanır:
 *   - project.department = ownProjectDept  → kendi departmanı
 *   - project.department = overseesDept    → gözetim departmanı
 */
export function buildTaskVisibilityWhere(user: TaskPermUser): object {
  const notDeleted = { deletedAt: null };

  const ownProjDept = userDeptToProjectDept(user.department ?? "");
  const sl = user.seniorityLevel ?? 0;
  const od = user.overseesDepartment ?? null;
  const uid = user.id;
  const cvap = user.canViewAllProjects;

  // Kural 1: ADMIN tüm silinmemiş görevleri görür (departman kapısı atlanır)
  if (user.role === "ADMIN") return notDeleted;

  // Kural 2: canViewAllProjects → tüm silinmemiş görevler (departman kapısı atlanır)
  if (cvap) return notDeleted;

  const conditions: object[] = [];

  // Kendi proje departmanındaki görevler
  if (ownProjDept) {
    const inOwnDept = { project: { department: ownProjDept } };

    if (sl >= 11) {
      // Kural 5: Senior Manager+ — kendi departmanındaki tüm görevler
      conditions.push(inOwnDept);
    } else {
      // Dar erişim: yalnızca belirli ilişkilerle
      // Kural 6: atanan
      conditions.push({ ...inOwnDept, assignedToId: uid });
      // Kural 7: oluşturan
      conditions.push({ ...inOwnDept, createdById: uid });
      // Kural 8: projeyi oluşturan
      conditions.push({ project: { department: ownProjDept, createdById: uid } });
      // Kural 9: inceleme sahibi
      conditions.push({ ...inOwnDept, reviewOwnerId: uid });
    }
  }

  // Kural 4: Gözetmen — gözetim departmanının tüm görevleri
  if (od) {
    conditions.push({ project: { department: od } });
  }

  // Proje dışı görevler: her zaman assignedToId, createdById veya reviewOwnerId ile
  // erişilebilir (canViewTask'in Kural 9'uyla tutarlı — take_over_review ile reviewOwner
  // devralan biri, ne atanan ne oluşturan olsa da projesiz görevi görebilmeli).
  conditions.push({ projectId: null, assignedToId: uid });
  conditions.push({ projectId: null, createdById: uid });
  conditions.push({ projectId: null, reviewOwnerId: uid });

  if (conditions.length === 0) {
    return { ...notDeleted, id: "__no_access__" };
  }

  return { AND: [notDeleted, { OR: conditions }] };
}
