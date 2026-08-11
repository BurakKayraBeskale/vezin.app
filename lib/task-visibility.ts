/**
 * Görev görünürlük sistemi — proje üyeliği modeli.
 *
 * Görünürlük sırası:
 *   1. ADMIN veya canViewAllProjects → tüm projeler/görevler
 *   2. overseesDepartment != null → yalnızca o birimin tüm projeleri/görevleri
 *   3. Diğerleri → yalnızca üye olduğu projeler; o projede TÜM görevler görülür
 *
 * KRİTİK: Filtre Prisma sorgusunun içinde uygulanır,
 *         frontend .filter() veya tüm görev döndürüp gizleme YAPILMAZ.
 */

import { prisma } from "@/lib/prisma";

export type VisibilityUser = {
  id: string;
  role: string;
  canViewAllProjects: boolean;
  overseesDepartment?: string | null;
};

/**
 * null → tüm projeler görülür (ADMIN / canViewAllProjects)
 * string[] → görülebilir proje ID'leri
 */
export async function getVisibleProjectIds(user: VisibilityUser): Promise<string[] | null> {
  if (user.role === "ADMIN" || user.canViewAllProjects) return null;

  if (user.overseesDepartment) {
    const projects = await prisma.project.findMany({
      where: { department: user.overseesDepartment },
      select: { id: true },
    });
    return projects.map((p) => p.id);
  }

  // Normal kullanıcı: sadece üye olduğu projeler
  const members = await prisma.projectMember.findMany({
    where: { userId: user.id },
    select: { projectId: true },
  });
  return members.map((m) => m.projectId);
}

/**
 * Proje ID listesini → Prisma task where filtresine çevirir.
 * null → {} (filtre yok, tüm görevler)
 * [] → { projectId: "__no_access__" } (SQL'de 0 sonuç döner)
 * [...] → { projectId: { in: [...] } }
 */
export function buildTaskVisibilityWhere(projectIds: string[] | null): object {
  if (projectIds === null) return {};
  if (projectIds.length === 0) return { projectId: "__no_access__" };
  return { projectId: { in: projectIds } };
}

/**
 * Proje ID listesini → Prisma project where filtresine çevirir.
 */
export function buildProjectVisibilityWhere(projectIds: string[] | null): object {
  if (projectIds === null) return {};
  if (projectIds.length === 0) return { id: "__no_access__" };
  return { id: { in: projectIds } };
}

// ── Backward compat shims ────────────────────────────────────────────────────
// Eski çağrıcılar için; yeni kod getVisibleProjectIds + buildTaskVisibilityWhere kullanmalı.

export type LegacyVisibilityUser = {
  id: string;
  role: string;
  canViewAllTasks?: boolean;
  canViewAllProjects?: boolean;
  overseesDepartment?: string | null;
};

/** @deprecated Use getVisibleProjectIds + buildTaskVisibilityWhere */
export async function getVisibleTaskIds(user: LegacyVisibilityUser): Promise<string[] | null> {
  const projectIds = await getVisibleProjectIds({
    id: user.id,
    role: user.role,
    canViewAllProjects: user.canViewAllProjects ?? user.canViewAllTasks ?? false,
    overseesDepartment: user.overseesDepartment,
  });
  return projectIds; // Now returns project IDs, not task IDs — callers must use buildTaskVisibilityWhere
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
    canViewAllProjects: user.canViewAllProjects ?? user.canViewAllTasks ?? false,
    overseesDepartment: user.overseesDepartment,
  });
  return buildTaskVisibilityWhere(projectIds);
}
