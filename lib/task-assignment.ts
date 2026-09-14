/**
 * Merkezi "kime görev atanabilir" motoru — A BLOĞU.
 *
 * Prisma'ya bağımlı olduğu için lib/task-permissions.ts'ten AYRI tutulur:
 * task-permissions.ts client component'lerden de import edilir (canDeleteTask vb.),
 * bu dosyaya prisma eklenirse tarayıcı paketine sızar. Bu dosya yalnızca
 * server tarafında (API route, server component) kullanılmalıdır — lib/task-visibility.ts
 * ile aynı ayrım deseni.
 *
 * Kural (hepsi birlikte sağlanmalı):
 *   - assigner.seniorityLevel > target.seniorityLevel (KESİN büyük; eşit/yüksek/kendine atama yasak)
 *   - target.status === "ACTIVE"
 *   - target.canBeAssignedTasks === true (ASSIGN_EXCEPTIONS istisnası hariç)
 *   - ADMIN ve canViewAllProjects için yalnızca kıdem koşulu uygulanmaz
 *   - Projeli görev (scope.projectId) → target projenin aktif üyesi olmalı
 *   - Projesiz görev (scope.departmentId) → target, görevin departmanında olmalı
 *
 * ASSIGN_EXCEPTIONS yalnızca canBeAssignedTasks=false kuralını atlar; kıdem ve
 * scope (proje üyeliği/departman) kuralları istisna hedefler için de geçerlidir.
 */

import { prisma } from "@/lib/prisma";
import { HIDDEN_ACCOUNT_EMAILS } from "@/lib/hidden-accounts";
import { ASSIGN_EXCEPTIONS } from "@/lib/task-permissions";

export type AssignerUser = {
  id: string;
  role: string;
  seniorityLevel: number;
  canViewAllProjects: boolean;
  email?: string | null;
};

export type AssignmentScope = {
  /** Projeli görev — yalnızca bu projenin aktif üyeleri döner. */
  projectId?: string | null;
  /** Projesiz görev — yalnızca bu departmandaki kullanıcılar döner (user dept formatı). */
  departmentId?: string | null;
};

export type EligibleAssignee = {
  id: string;
  name: string;
  email: string;
  department: string;
  title: string | null;
  seniorityLevel: number;
};

const eligibleSelect = {
  id: true,
  name: true,
  email: true,
  department: true,
  title: true,
  seniorityLevel: true,
} as const;

async function resolveScopeWhere(scope: AssignmentScope): Promise<Record<string, unknown> | null> {
  if (scope.projectId) {
    const members = await prisma.projectMember.findMany({
      where: { projectId: scope.projectId },
      select: { userId: true },
    });
    return { id: { in: members.map((m) => m.userId) } };
  }
  if (scope.departmentId) {
    return { department: scope.departmentId };
  }
  return null;
}

/**
 * Atayanın atayabileceği kullanıcıları döndürür — tek doğru kaynak.
 * /api/users/assignable, görev oluşturma ve yeniden atama uçları bu fonksiyondan geçer.
 */
export async function getEligibleAssignees(
  assigner: AssignerUser,
  scope: AssignmentScope = {}
): Promise<EligibleAssignee[]> {
  const bypassSeniority = assigner.role === "ADMIN" || assigner.canViewAllProjects;
  const scopeWhere = await resolveScopeWhere(scope);
  const seniorityWhere = bypassSeniority ? {} : { seniorityLevel: { lt: assigner.seniorityLevel } };

  const baseWhere: Record<string, unknown> = {
    id: { not: assigner.id },
    email: { notIn: HIDDEN_ACCOUNT_EMAILS },
    status: "ACTIVE",
    canBeAssignedTasks: true,
    ...seniorityWhere,
    ...(scopeWhere ?? {}),
  };

  const eligible = await prisma.user.findMany({
    where: baseWhere,
    select: eligibleSelect,
    orderBy: [{ seniorityLevel: "desc" }, { name: "asc" }],
  });

  // ASSIGN_EXCEPTIONS: yalnızca canBeAssignedTasks=false kuralı atlanır;
  // kıdem ve scope (proje üyeliği/departman) kuralları istisna hedefler için de uygulanır.
  const exceptionEmails = ASSIGN_EXCEPTIONS[assigner.email?.toLowerCase() ?? ""] ?? [];
  if (exceptionEmails.length > 0) {
    const exceptionWhere: Record<string, unknown> = {
      id: { not: assigner.id },
      email: { in: exceptionEmails },
      status: "ACTIVE",
      ...seniorityWhere,
      ...(scopeWhere ?? {}),
    };
    const exceptionUsers = await prisma.user.findMany({ where: exceptionWhere, select: eligibleSelect });
    const existingIds = new Set(eligible.map((u) => u.id));
    for (const eu of exceptionUsers) {
      if (!existingIds.has(eu.id)) eligible.push(eu);
    }
    eligible.sort(
      (a, b) => b.seniorityLevel - a.seniorityLevel || a.name.localeCompare(b.name, "tr")
    );
  }

  return eligible;
}

/** Tek bir hedefin atanabilir olup olmadığını kontrol eder — aynı kuralı ikinci kez yazmaz. */
export async function isEligibleAssignee(
  assigner: AssignerUser,
  targetId: string,
  scope: AssignmentScope = {}
): Promise<boolean> {
  const eligible = await getEligibleAssignees(assigner, scope);
  return eligible.some((u) => u.id === targetId);
}
