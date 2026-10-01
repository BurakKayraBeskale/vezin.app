/**
 * Dashboard "Görüntülenen Personel" yetki politikası — TEK kaynak.
 *
 * Kim kimin Dashboard'unu seçebilir (yalnız AKTİF kullanıcılar, gizli hesaplar hariç):
 *   ADMIN / canViewAllProjects            → tüm departmanlardaki tüm aktif personel
 *   Senior Manager 1+ / Partner (≥ 11)    → kendi departmanındaki tüm aktif personel
 *   Departman sorumlusu (overseesDepartment) → + sorumlu olduğu departmanın personeli
 *   Assistant Manager … Manager 3 (7–10)  → kendi departmanında, ortak proje üyeliği
 *                                            olan ya da görevlerini zaten görebildiği kişiler
 *   Senior 2 ve altı (≤ 6)                → yalnız kendisi
 *
 * ÖNEMLİ: kişi seçmek YENİ YETKİ VERMEZ. Dashboard'daki her sayı/liste viewer'ın
 * kendi görünürlüğüyle (Task Core / proje / izin / harcama izinleri) ayrıca
 * filtrelenir — bkz. lib/dashboard/service.ts. Bu dosya yalnız "seçici listesi"dir.
 */

import { prisma } from "@/lib/prisma";
import { HIDDEN_ACCOUNT_EMAILS } from "@/lib/hidden-accounts";
import { TITLE_TO_LEVEL } from "@/lib/hierarchy";
import { projectDeptToUserDept } from "@/lib/access";
import { buildTaskVisibilityWhereForUser } from "@/lib/task-visibility";

/** Assistant Manager (7) ve üstü başkasını seçebilir. */
export const DASHBOARD_TEAM_VIEW_MIN_LEVEL = TITLE_TO_LEVEL["Assistant Manager"];
/** Senior Manager 1 (11) ve üstü kendi departmanının tamamını seçebilir. */
export const DASHBOARD_DEPARTMENT_VIEW_MIN_LEVEL = TITLE_TO_LEVEL["Senior Manager 1"];

export interface DashboardViewer {
  id: string;
  name: string;
  email: string;
  role: string;
  status: string;
  department: string;
  seniorityLevel: number;
  canViewAllProjects: boolean;
  overseesDepartment: string | null;
}

export interface DashboardPerson {
  id: string;
  name: string;
  title: string;
  department: string;
}

export type DashboardPeopleScope =
  | { kind: "self" }
  | { kind: "all" }
  | { kind: "departments"; departments: string[] }
  | { kind: "team"; department: string };

/** Oturumdaki bilgi bayat olabilir — viewer her istekte DB'den okunur. */
export async function loadDashboardViewer(userId: string): Promise<DashboardViewer | null> {
  const u = await prisma.user.findUnique({
    where: { id: userId },
    select: {
      id: true,
      name: true,
      email: true,
      role: true,
      status: true,
      department: true,
      seniorityLevel: true,
      canViewAllProjects: true,
      overseesDepartment: true,
    },
  });
  return u && u.status === "ACTIVE" ? u : null;
}

/** Saf politika — hangi kapsam (DB'ye dokunmaz, test edilebilir). */
export function getDashboardPeopleScope(viewer: DashboardViewer): DashboardPeopleScope {
  if (viewer.role === "ADMIN" || viewer.canViewAllProjects) return { kind: "all" };
  const overseenUserDept = viewer.overseesDepartment ? projectDeptToUserDept(viewer.overseesDepartment) : null;
  if (viewer.seniorityLevel >= DASHBOARD_DEPARTMENT_VIEW_MIN_LEVEL || overseenUserDept) {
    const departments = [viewer.department, overseenUserDept].filter((d): d is string => !!d);
    return { kind: "departments", departments: [...new Set(departments)] };
  }
  if (viewer.seniorityLevel >= DASHBOARD_TEAM_VIEW_MIN_LEVEL) return { kind: "team", department: viewer.department };
  return { kind: "self" };
}

const personSelect = { id: true, name: true, title: true, department: true } as const;

/**
 * Viewer'ın Dashboard'da seçebileceği personel — kendisi her zaman ilk sırada.
 * Pasif kullanıcılar ve gizli hesaplar listelenmez.
 */
export async function getDashboardSelectableUsers(viewer: DashboardViewer): Promise<DashboardPerson[]> {
  const scope = getDashboardPeopleScope(viewer);
  const self: DashboardPerson = { id: viewer.id, name: viewer.name, title: "", department: viewer.department };

  let others: DashboardPerson[] = [];
  const base = { status: "ACTIVE", id: { not: viewer.id }, email: { notIn: HIDDEN_ACCOUNT_EMAILS } };

  if (scope.kind === "all") {
    others = await prisma.user.findMany({ where: base, select: personSelect });
  } else if (scope.kind === "departments") {
    others = await prisma.user.findMany({ where: { ...base, department: { in: scope.departments } }, select: personSelect });
  } else if (scope.kind === "team") {
    // Ortak proje: viewer'ın üyesi olduğu / kurduğu projeler
    const [memberships, created] = await Promise.all([
      prisma.projectMember.findMany({ where: { userId: viewer.id }, select: { projectId: true } }),
      prisma.project.findMany({ where: { createdById: viewer.id, deletedAt: null }, select: { id: true } }),
    ]);
    const projectIds = [...new Set([...memberships.map((m) => m.projectId), ...created.map((p) => p.id)])];
    const visibleTasks = buildTaskVisibilityWhereForUser(viewer);
    others = await prisma.user.findMany({
      where: {
        ...base,
        department: scope.department,
        OR: [
          ...(projectIds.length ? [{ projectMembers: { some: { projectId: { in: projectIds } } } }] : []),
          // Görevlerini zaten görebildiği kişiler (Task Core görünürlüğü)
          { assignedTasks: { some: visibleTasks as object } },
        ],
      },
      select: personSelect,
    });
  }

  others.sort((a, b) => a.name.localeCompare(b.name, "tr"));
  const selfRow = (await prisma.user.findUnique({ where: { id: viewer.id }, select: personSelect })) ?? self;
  return [selfRow, ...others];
}

/** Seçilen kişi viewer'ın seçebileceği biri mi? (API tarafı kapısı) */
export async function canViewDashboardOf(viewer: DashboardViewer, targetId: string): Promise<boolean> {
  if (targetId === viewer.id) return true;
  const people = await getDashboardSelectableUsers(viewer);
  return people.some((p) => p.id === targetId);
}

/**
 * API kapısı + hedef kişi: viewer'ın seçemeyeceği ya da aktif olmayan kişi → null
 * (çağıran 404 döner). /api/dashboard ve /api/dashboard/calendar ortak kullanır.
 */
export async function loadDashboardTarget(viewer: DashboardViewer, targetId: string) {
  if (!(await canViewDashboardOf(viewer, targetId))) return null;
  const target = await prisma.user.findUnique({
    where: { id: targetId },
    select: { id: true, name: true, role: true, email: true, department: true, status: true },
  });
  return target && target.status === "ACTIVE" ? target : null;
}
