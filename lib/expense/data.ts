/**
 * Personel Harcama Formu — veri erişimi: aktör/yetki bağlamı, listeler,
 * detay serileştirme, onay ayarları. Durum değiştiren işlemler workflow.ts'te.
 */

import { prisma } from "@/lib/prisma";
import { HIDDEN_ACCOUNT_EMAILS } from "@/lib/hidden-accounts";
import { roundMoney } from "./calc";
import {
  EXPENSE_ACCOUNTING_DEPARTMENT,
  EXPENSE_ACCOUNTING_OPEN_STATUSES,
  EXPENSE_IN_APPROVAL_STATUSES,
  isExpenseStatus,
} from "./constants";
import {
  buildExpenseVisibilityWhere,
  canViewExpenseForm,
  currentRound,
  getExpensePermissions,
  getExpenseTabAccess,
  type ExpenseActor,
  type ExpenseActorScope,
  type ExpenseTabAccess,
} from "./permissions";
import { ExpenseError, parseDateOnly } from "./validation";

// ── Aktör ────────────────────────────────────────────────────────────────────

export interface ExpenseActorFull extends ExpenseActor {
  name: string;
  title: string;
}

/** Aktör her istekte DB'den okunur (token'daki departman/durum bayat olabilir). */
export async function loadExpenseActor(userId: string): Promise<ExpenseActorFull | null> {
  const u = await prisma.user.findUnique({
    where: { id: userId },
    select: { id: true, role: true, department: true, status: true, name: true, title: true },
  });
  return u ?? null;
}

/**
 * Aktörün şu an onaycısı olduğu departmanlar. Onaycı yalnız kendi departmanından
 * seçilebildiği için, sonradan departmanı değişmiş kullanıcının eski ayar kaydı
 * sayılmaz (bkz. resolveDepartmentApprovers ile aynı kural).
 */
export async function loadExpenseActorScope(actor: ExpenseActor): Promise<ExpenseActorScope> {
  if (actor.status !== "ACTIVE") return { approverDepartments: [] };
  const rows = await prisma.expenseApprovalConfig.findMany({
    where: { userId: actor.id, department: actor.department },
    select: { department: true },
  });
  return { approverDepartments: [...new Set(rows.map((r) => r.department))] };
}

export async function loadExpenseTabAccess(actor: ExpenseActor, scope: ExpenseActorScope): Promise<ExpenseTabAccess> {
  const hasApprovalRecords = (await prisma.expenseApproval.count({ where: { approverId: actor.id } })) > 0;
  return getExpenseTabAccess(actor, scope, hasApprovalRecords);
}

/** Gönderim anında geçerli onaycılar: ayardaki, AKTİF ve hâlâ o departmanda olan kullanıcılar. */
export async function resolveDepartmentApprovers(department: string): Promise<{ id: string; name: string }[]> {
  const rows = await prisma.expenseApprovalConfig.findMany({
    where: { department, user: { status: "ACTIVE", department } },
    select: { user: { select: { id: true, name: true } } },
    orderBy: { user: { name: "asc" } },
  });
  return rows.map((r) => r.user);
}

export async function accountingRecipientIds(): Promise<string[]> {
  const rows = await prisma.user.findMany({
    where: { department: EXPENSE_ACCOUNTING_DEPARTMENT, status: "ACTIVE" },
    select: { id: true },
  });
  return rows.map((r) => r.id);
}

/** Departman listesi — User.department'taki mevcut değerlerden DİNAMİK. */
export async function listExpenseDepartments(): Promise<string[]> {
  const rows = await prisma.user.findMany({
    where: { status: { not: "DELETED" }, department: { not: "" } },
    distinct: ["department"],
    select: { department: true },
    orderBy: { department: "asc" },
  });
  return rows.map((r) => r.department);
}

// ── Detay ────────────────────────────────────────────────────────────────────

export const expenseDetailInclude = {
  owner: { select: { id: true, name: true, department: true, title: true, status: true } },
  items: { orderBy: { sortOrder: "asc" as const } },
  rounds: {
    orderBy: { roundNumber: "asc" as const },
    include: {
      approvals: {
        orderBy: { createdAt: "asc" as const },
        include: { approver: { select: { id: true, name: true, status: true } } },
      },
    },
  },
  documents: { where: { deletedAt: null }, orderBy: { createdAt: "desc" as const } },
  settlements: { orderBy: { createdAt: "asc" as const } },
  audits: { orderBy: { createdAt: "asc" as const } },
};

async function userNameMap(ids: (string | null | undefined)[]): Promise<Map<string, string>> {
  const unique = [...new Set(ids.filter(Boolean) as string[])];
  if (unique.length === 0) return new Map();
  const rows = await prisma.user.findMany({ where: { id: { in: unique } }, select: { id: true, name: true } });
  return new Map(rows.map((r) => [r.id, r.name]));
}

function parseMeta(meta: string | null): Record<string, unknown> | null {
  if (!meta) return null;
  try {
    return JSON.parse(meta);
  } catch {
    return null;
  }
}

/**
 * Tek formun tam detayı — görüntüleme yetkisi yoksa 404. Yanıt, UI'ın ihtiyaç
 * duyduğu yetki bayraklarını (permissions) da içerir; bayraklar yalnız UI
 * içindir, her işlem sunucuda yeniden doğrulanır.
 */
export async function getExpenseDetail(formId: string, actor: ExpenseActorFull, scope: ExpenseActorScope) {
  const form = await prisma.expenseForm.findUnique({ where: { id: formId }, include: expenseDetailInclude });
  if (!form || !canViewExpenseForm(actor, form, scope)) throw new ExpenseError(404, "Form bulunamadı");

  const names = await userNameMap([
    ...form.rounds.flatMap((r) => [r.submittedById, r.closedById, r.accountingById, ...r.approvals.map((a) => a.replacedById)]),
  ]);
  const permissions = getExpensePermissions(actor, form);
  const latest = currentRound(form);

  let lastRejection: { stage: "DEPARTMENT" | "ACCOUNTING"; note: string | null; byName: string | null; at: Date | null } | null = null;
  if (latest?.status === "REJECTED") {
    const rejecter = latest.approvals.find((a) => a.status === "REJECTED");
    lastRejection = {
      stage: "DEPARTMENT",
      note: latest.rejectionNote,
      byName: rejecter?.approver.name ?? names.get(latest.closedById ?? "") ?? null,
      at: latest.closedAt,
    };
  } else if (latest?.accountingStatus === "REJECTED") {
    lastRejection = {
      stage: "ACCOUNTING",
      note: latest.accountingNote,
      byName: names.get(latest.accountingById ?? "") ?? null,
      at: latest.accountingAt,
    };
  }

  const activeDocument = form.documents.find((d) => !d.replacedAt) ?? null;
  const docOut = (d: (typeof form.documents)[number]) => ({
    id: d.id, name: d.name, size: d.size, createdAt: d.createdAt, uploadedByName: d.uploadedByName, replacedAt: d.replacedAt,
  });

  let approverCandidates: { id: string; name: string; title: string }[] = [];
  if (permissions.canReplaceApprover && form.departmentSnapshot && latest) {
    const inRound = latest.approvals.filter((a) => a.status !== "REPLACED").map((a) => a.approverId);
    approverCandidates = await prisma.user.findMany({
      where: {
        status: "ACTIVE",
        department: form.departmentSnapshot,
        id: { notIn: [...inRound, form.ownerId] },
        email: { notIn: HIDDEN_ACCOUNT_EMAILS },
      },
      select: { id: true, name: true, title: true },
      orderBy: { name: "asc" },
    });
  }

  return {
    id: form.id,
    formNo: form.formNo,
    status: form.status,
    version: form.version,
    note: form.note,
    owner: { id: form.owner.id, status: form.owner.status },
    // Gönderilmiş formda snapshot; taslakta canlı kullanıcı bilgisi
    ownerName: form.ownerNameSnapshot ?? form.owner.name,
    department: form.departmentSnapshot ?? form.owner.department,
    title: form.titleSnapshot ?? form.owner.title,
    isSnapshot: form.snapshotAt !== null,
    createdAt: form.createdAt,
    lastActionAt: form.lastActionAt,
    firstSubmittedAt: form.firstSubmittedAt,
    cashAdvance: form.cashAdvance,
    totalAmount: form.totalAmount,
    netAmount: form.netAmount,
    items: form.items.map((i) => ({
      id: i.id,
      date: i.date,
      subject: i.subject,
      vendor: i.vendor,
      description: i.description,
      clientProject: i.clientProject,
      amount: i.amount,
    })),
    activeDocument: activeDocument ? docOut(activeDocument) : null,
    previousDocuments: form.documents.filter((d) => d.replacedAt).map(docOut),
    rounds: form.rounds.map((r) => ({
      id: r.id,
      roundNumber: r.roundNumber,
      status: r.status,
      bypassed: r.bypassed,
      adminOverride: r.adminOverride,
      submittedAt: r.submittedAt,
      submittedByName: names.get(r.submittedById) ?? null,
      closedAt: r.closedAt,
      closedByName: r.closedById ? names.get(r.closedById) ?? null : null,
      rejectionNote: r.rejectionNote,
      accountingStatus: r.accountingStatus,
      accountingByName: r.accountingById ? names.get(r.accountingById) ?? null : null,
      accountingAt: r.accountingAt,
      accountingNote: r.accountingNote,
      approvedCount: r.approvals.filter((a) => a.status === "APPROVED").length,
      requiredCount: r.approvals.filter((a) => a.status !== "REPLACED").length,
      approvals: r.approvals.map((a) => ({
        id: a.id,
        approverId: a.approverId,
        approverName: a.approver.name,
        approverActive: a.approver.status === "ACTIVE",
        status: a.status,
        decidedAt: a.decidedAt,
        note: a.note,
        replacedAt: a.replacedAt,
        replacedByName: a.replacedById ? names.get(a.replacedById) ?? null : null,
        replacesApprovalId: a.replacesApprovalId,
      })),
    })),
    settlements: form.settlements.map((s) => ({
      id: s.id,
      type: s.type,
      amount: s.amount,
      transactionDate: s.transactionDate,
      note: s.note,
      createdByName: s.createdByName,
      createdAt: s.createdAt,
      revertedAt: s.revertedAt,
      revertedByName: s.revertedByName,
      revertReason: s.revertReason,
    })),
    audits: form.audits.map((a) => ({
      id: a.id,
      action: a.action,
      actorName: a.actorName,
      fromStatus: a.fromStatus,
      toStatus: a.toStatus,
      note: a.note,
      meta: parseMeta(a.meta),
      createdAt: a.createdAt,
    })),
    lastRejection,
    permissions,
    approverCandidates,
  };
}

export type ExpenseDetail = Awaited<ReturnType<typeof getExpenseDetail>>;

// ── Listeler ─────────────────────────────────────────────────────────────────

export type ExpenseListScope = "mine" | "approvals" | "accounting" | "all";

export interface ExpenseListFilters {
  q?: string | null;
  status?: string | null;
  dateFrom?: string | null;
  dateTo?: string | null;
  department?: string | null;
  ownerId?: string | null;
  /** approvals/accounting sekmeleri: "pending" (varsayılan) | "all" */
  view?: string | null;
}

const LIST_LIMIT = 500;

/** Türkiye UTC+3 (yaz saati yok) — tarih filtresi gün sınırları için. */
function istanbulDayStart(dateOnly: string): Date {
  const d = parseDateOnly(dateOnly, "Tarih");
  return new Date(d!.getTime() - 3 * 60 * 60 * 1000);
}

function scopeWhere(listScope: ExpenseListScope, actor: ExpenseActor, scope: ExpenseActorScope, access: ExpenseTabAccess, view: string): object {
  switch (listScope) {
    case "mine":
      return { ownerId: actor.id };
    case "approvals": {
      if (!access.approvals) throw new ExpenseError(404, "Bulunamadı");
      if (view === "all") {
        const or: object[] = [{ rounds: { some: { approvals: { some: { approverId: actor.id } } } } }];
        if (scope.approverDepartments.length) or.push({ departmentSnapshot: { in: scope.approverDepartments } });
        return { ownerId: { not: actor.id }, status: { not: "DRAFT" }, OR: or };
      }
      return {
        status: "DEPT_APPROVAL",
        rounds: { some: { status: "PENDING", approvals: { some: { approverId: actor.id, status: "PENDING" } } } },
      };
    }
    case "accounting": {
      if (!access.accounting && !access.all) throw new ExpenseError(404, "Bulunamadı");
      if (view === "all") return { reachedAccountingAt: { not: null } };
      return { status: { in: EXPENSE_ACCOUNTING_OPEN_STATUSES } };
    }
    case "all":
      if (!access.all) throw new ExpenseError(404, "Bulunamadı");
      return {};
  }
}

export async function listExpenseForms(
  actor: ExpenseActor,
  scope: ExpenseActorScope,
  access: ExpenseTabAccess,
  listScope: ExpenseListScope,
  filters: ExpenseListFilters
) {
  const view = filters.view === "all" ? "all" : "pending";
  const base: object[] = [buildExpenseVisibilityWhere(actor, scope), scopeWhere(listScope, actor, scope, access, view)];
  const and: object[] = [...base];

  if (filters.status) {
    if (!isExpenseStatus(filters.status)) throw new ExpenseError(400, "Geçersiz durum filtresi");
    and.push({ status: filters.status });
  }
  if (filters.dateFrom) and.push({ createdAt: { gte: istanbulDayStart(filters.dateFrom) } });
  if (filters.dateTo) {
    and.push({ createdAt: { lt: new Date(istanbulDayStart(filters.dateTo).getTime() + 24 * 60 * 60 * 1000) } });
  }
  const q = filters.q?.trim();
  if (q) {
    and.push({
      OR: [
        { formNo: { contains: q } },
        { ownerNameSnapshot: { contains: q } },
        { owner: { name: { contains: q } } },
        { note: { contains: q } },
        {
          items: {
            some: {
              OR: [
                { subject: { contains: q } },
                { vendor: { contains: q } },
                { description: { contains: q } },
                { clientProject: { contains: q } },
              ],
            },
          },
        },
      ],
    });
  }
  if (listScope !== "mine") {
    if (filters.department) {
      and.push({
        OR: [
          { departmentSnapshot: filters.department },
          { departmentSnapshot: null, owner: { department: filters.department } },
        ],
      });
    }
    if (filters.ownerId) and.push({ ownerId: filters.ownerId });
  }

  const rows = await prisma.expenseForm.findMany({
    where: { AND: and },
    orderBy: { lastActionAt: "desc" },
    take: LIST_LIMIT,
    select: {
      id: true,
      formNo: true,
      status: true,
      createdAt: true,
      lastActionAt: true,
      totalAmount: true,
      cashAdvance: true,
      netAmount: true,
      ownerNameSnapshot: true,
      departmentSnapshot: true,
      owner: { select: { id: true, name: true, department: true } },
      rounds: {
        orderBy: { roundNumber: "desc" },
        take: 1,
        select: { status: true, approvals: { select: { status: true } } },
      },
    },
  });

  const forms = rows.map((f) => {
    const round = f.rounds[0];
    const progress =
      f.status === "DEPT_APPROVAL" && round?.status === "PENDING"
        ? {
            approved: round.approvals.filter((a) => a.status === "APPROVED").length,
            required: round.approvals.filter((a) => a.status !== "REPLACED").length,
          }
        : null;
    return {
      id: f.id,
      formNo: f.formNo,
      status: f.status,
      createdAt: f.createdAt,
      lastActionAt: f.lastActionAt,
      totalAmount: f.totalAmount,
      cashAdvance: f.cashAdvance,
      netAmount: f.netAmount,
      ownerId: f.owner.id,
      ownerName: f.ownerNameSnapshot ?? f.owner.name,
      department: f.departmentSnapshot ?? f.owner.department,
      approvalProgress: progress,
    };
  });

  let facets: { departments: string[]; owners: { id: string; name: string }[] } | null = null;
  if (listScope !== "mine") {
    const [departments, ownerRows] = await Promise.all([
      listExpenseDepartments(),
      prisma.expenseForm.findMany({
        where: { AND: base },
        distinct: ["ownerId"],
        select: { owner: { select: { id: true, name: true } } },
      }),
    ]);
    facets = {
      departments,
      owners: ownerRows.map((r) => r.owner).sort((a, b) => a.name.localeCompare(b.name, "tr")),
    };
  }

  return { forms, facets, truncated: rows.length === LIST_LIMIT };
}

/**
 * Formlarım özet kartları — kesin borç/alacak yalnız muhasebe onayı sonrası:
 *   receivable → yalnız PAYMENT_PENDING net toplamı
 *   refund     → yalnız REFUND_PENDING (mutlak) toplamı
 *   inApproval → DEPT_APPROVAL + ACCOUNTING_APPROVAL (sayı + net toplamı, bilgi amaçlı)
 */
export async function getExpenseSummary(ownerId: string) {
  const [pay, refund, inApproval] = await Promise.all([
    prisma.expenseForm.aggregate({ where: { ownerId, status: "PAYMENT_PENDING" }, _sum: { netAmount: true }, _count: true }),
    prisma.expenseForm.aggregate({ where: { ownerId, status: "REFUND_PENDING" }, _sum: { netAmount: true }, _count: true }),
    prisma.expenseForm.aggregate({
      where: { ownerId, status: { in: EXPENSE_IN_APPROVAL_STATUSES } },
      _sum: { netAmount: true },
      _count: true,
    }),
  ]);
  return {
    receivable: { amount: roundMoney(pay._sum.netAmount ?? 0), count: pay._count },
    refund: { amount: roundMoney(-(refund._sum.netAmount ?? 0)), count: refund._count },
    inApproval: { amount: roundMoney(inApproval._sum.netAmount ?? 0), count: inApproval._count },
  };
}

// ── Onay ayarları (ADMIN) ────────────────────────────────────────────────────

export async function getApprovalSettings() {
  const departments = await listExpenseDepartments();
  const [users, configs] = await Promise.all([
    prisma.user.findMany({
      where: { status: "ACTIVE", department: { in: departments }, email: { notIn: HIDDEN_ACCOUNT_EMAILS } },
      select: { id: true, name: true, title: true, department: true },
      orderBy: { name: "asc" },
    }),
    prisma.expenseApprovalConfig.findMany({
      include: { user: { select: { id: true, name: true, status: true, department: true } } },
      orderBy: { createdAt: "asc" },
    }),
  ]);

  return departments.map((department) => {
    const deptConfigs = configs.filter((c) => c.department === department);
    const valid = deptConfigs.filter((c) => c.user.status === "ACTIVE" && c.user.department === department);
    const invalid = deptConfigs.filter((c) => !(c.user.status === "ACTIVE" && c.user.department === department));
    return {
      department,
      users: users.filter((u) => u.department === department).map(({ id, name, title }) => ({ id, name, title })),
      approverIds: valid.map((c) => c.userId),
      // Pasifleşmiş / departmanı değişmiş onaycılar — yeni gönderimlerde dikkate alınmaz
      invalidApprovers: invalid.map((c) => ({
        id: c.userId,
        name: c.user.name,
        reason: c.user.status !== "ACTIVE" ? "Pasif kullanıcı" : "Departmanı değişmiş",
      })),
    };
  });
}

/**
 * Bir departmanın onaycı listesini tamamen değiştirir. Açık formlar etkilenmez
 * (onaycılar gönderimde round'a snapshot'lanır). Boş liste = onay akışı yok.
 */
export async function setDepartmentApprovers(actor: ExpenseActorFull, department: unknown, approverIds: unknown) {
  if (typeof department !== "string" || !department) throw new ExpenseError(400, "Departman gerekli");
  if (!Array.isArray(approverIds) || approverIds.some((id) => typeof id !== "string")) {
    throw new ExpenseError(400, "Onaycı listesi geçersiz");
  }
  const departments = await listExpenseDepartments();
  if (!departments.includes(department)) throw new ExpenseError(400, "Bilinmeyen departman");

  const ids = [...new Set(approverIds as string[])];
  if (ids.length > 0) {
    const valid = await prisma.user.count({
      where: { id: { in: ids }, status: "ACTIVE", department, email: { notIn: HIDDEN_ACCOUNT_EMAILS } },
    });
    if (valid !== ids.length) {
      throw new ExpenseError(400, "Onaycılar yalnızca bu departmanın aktif kullanıcıları arasından seçilebilir.");
    }
  }

  await prisma.$transaction(async (tx) => {
    await tx.expenseApprovalConfig.deleteMany({ where: { department, userId: { notIn: ids } } });
    const existing = await tx.expenseApprovalConfig.findMany({ where: { department }, select: { userId: true } });
    const have = new Set(existing.map((e) => e.userId));
    const toCreate = ids.filter((id) => !have.has(id));
    if (toCreate.length) {
      await tx.expenseApprovalConfig.createMany({
        data: toCreate.map((userId) => ({ department, userId, createdById: actor.id })),
      });
    }
  });
}
