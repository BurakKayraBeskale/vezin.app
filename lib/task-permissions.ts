/**
 * Merkezi görev permission motoru — A BLOĞU
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

  // Proje dışı görevler: her zaman assignedToId veya createdById ile erişilebilir
  conditions.push({ projectId: null, assignedToId: uid });
  conditions.push({ projectId: null, createdById: uid });

  if (conditions.length === 0) {
    return { ...notDeleted, id: "__no_access__" };
  }

  return { AND: [notDeleted, { OR: conditions }] };
}
