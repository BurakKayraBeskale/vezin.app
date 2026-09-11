/**
 * Görev ve proje görünürlük sistemi.
 *
 * Proje görünürlük kuralları (getVisibleProjectIds):
 *   1. ADMIN veya canViewAllProjects → tüm projeler (silinmişler hariç)
 *   2. overseesDepartment set → sadece o departmanın projeleri (backward compat)
 *   3. seniorityLevel >= 11 (Senior Manager+/Partner) → kendi departmanının projeleri
 *   4. Diğerleri → yalnızca üye olduğu projeler
 *
 * Görev görünürlüğü (buildTaskVisibilityWhereForUser):
 *   Proje tabanlı görev sistemi için — detaylı permission ayrı implementasyonda.
 */

import { prisma } from "@/lib/prisma";
import { userDeptToProjectDept } from "@/lib/access";
import { buildTaskVisibilityWhere as buildTaskPermissionsWhere } from "@/lib/task-permissions";

export type VisibilityUser = {
  id: string;
  role: string;
  department?: string;
  seniorityLevel?: number;
  canViewAllProjects: boolean;
  overseesDepartment?: string | null;
};

/**
 * null → tüm projeler görülür (ADMIN / canViewAllProjects)
 * string[] → görülebilir proje ID'leri (silinmiş projeler dahil edilmez)
 */
export async function getVisibleProjectIds(user: VisibilityUser): Promise<string[] | null> {
  if (user.role === "ADMIN" || user.canViewAllProjects) return null;

  // overseesDepartment: eski sistem — açıkça belirlenen departman gözetmenleri
  if (user.overseesDepartment) {
    const projects = await prisma.project.findMany({
      where: { department: user.overseesDepartment, deletedAt: null },
      select: { id: true },
    });
    return projects.map((p) => p.id);
  }

  // Senior Manager 1+ (seviye >= 11) ve Partner (14): kendi departmanının projeleri
  if ((user.seniorityLevel ?? 0) >= 11) {
    const projectDept = userDeptToProjectDept(user.department ?? "");
    if (projectDept) {
      const projects = await prisma.project.findMany({
        where: { department: projectDept, deletedAt: null },
        select: { id: true },
      });
      return projects.map((p) => p.id);
    }
  }

  // Normal kullanıcı: sadece üye olduğu projeler
  const members = await prisma.projectMember.findMany({
    where: { userId: user.id },
    select: { projectId: true },
  });
  return members.map((m) => m.projectId);
}

/**
 * Proje ID listesini → Prisma project where filtresine çevirir.
 * Silinmiş projeler (deletedAt != null) daima hariç tutulur.
 */
export function buildProjectVisibilityWhere(projectIds: string[] | null): object {
  const notDeleted = { deletedAt: null };
  if (projectIds === null) return notDeleted;
  if (projectIds.length === 0) return { id: "__no_access__" };
  return { id: { in: projectIds }, ...notDeleted };
}

/**
 * Görev görünürlük filtresi — merkezi permission motoruna delege eder.
 *
 * Yeni 9-kural sistemi (A BLOĞU):
 *   - ADMIN ve canViewAllProjects=true → tüm görevler (departman kapısı atlanır)
 *   - Departman kapısı: görev departmanı kullanıcı departmanıyla eşleşmeli
 *   - Ayrıntılar: lib/task-permissions.ts
 */
export function buildTaskVisibilityWhereForUser(user: {
  id: string;
  role: string;
  canViewAllProjects: boolean;
  overseesDepartment?: string | null;
  seniorityLevel?: number;
  department?: string;
}): object {
  return buildTaskPermissionsWhere({
    id: user.id,
    role: user.role,
    department: user.department,
    seniorityLevel: user.seniorityLevel,
    canViewAllProjects: user.canViewAllProjects,
    overseesDepartment: user.overseesDepartment,
  });
}

/**
 * Proje ID listesini → Prisma task where filtresine çevirir.
 * @deprecated Yeni kod buildTaskVisibilityWhereForUser kullanmalı.
 */
export function buildTaskVisibilityWhere(projectIds: string[] | null): object {
  if (projectIds === null) return {};
  if (projectIds.length === 0) return { projectId: "__no_access__" };
  return { projectId: { in: projectIds } };
}

// ── Backward compat shims ────────────────────────────────────────────────────

export type LegacyVisibilityUser = {
  id: string;
  role: string;
  department?: string;
  seniorityLevel?: number;
  canViewAllTasks?: boolean;
  canViewAllProjects?: boolean;
  overseesDepartment?: string | null;
};

/** @deprecated Use getVisibleProjectIds + buildTaskVisibilityWhere */
export async function getVisibleTaskIds(user: LegacyVisibilityUser): Promise<string[] | null> {
  const projectIds = await getVisibleProjectIds({
    id: user.id,
    role: user.role,
    department: user.department ?? "",
    seniorityLevel: user.seniorityLevel ?? 0,
    canViewAllProjects: user.canViewAllProjects ?? user.canViewAllTasks ?? false,
    overseesDepartment: user.overseesDepartment,
  });
  return projectIds;
}

/** @deprecated Use buildTaskVisibilityWhere */
export function buildVisibilityWhere(ids: string[] | null): object {
  return buildTaskVisibilityWhere(ids);
}

/** @deprecated Use getVisibleProjectIds + buildTaskVisibilityWhere */
export async function getVisibleTaskFilter(user: {
  id: string;
  role: string;
  department: string;
  canViewAllTasks?: boolean;
  canViewAllProjects?: boolean;
  overseesDepartment?: string | null;
}): Promise<object> {
  const projectIds = await getVisibleProjectIds({
    id: user.id,
    role: user.role,
    department: user.department,
    seniorityLevel: 0,
    canViewAllProjects: user.canViewAllProjects ?? user.canViewAllTasks ?? false,
    overseesDepartment: user.overseesDepartment,
  });
  return buildTaskVisibilityWhere(projectIds);
}
