/**
 * Personel Harcama Formu — merkezi yetki kuralları (saf fonksiyonlar).
 *
 * Tüm API uçları, iş akışı fonksiyonları (lib/expense/workflow.ts) ve UI
 * bayrakları bu fonksiyonlardan geçer; bileşenlerde ayrı yetki mantığı yazılmaz.
 *
 * Görünürlük:
 *   Form sahibi → kendi formları (taslak dahil)
 *   Onaycı      → herhangi bir onay turunda yer aldığı formlar + şu an onaycısı
 *                 olduğu departmanın gönderilmiş (taslak olmayan) formları
 *   Muhasebe    → muhasebe aşamasına en az bir kez ulaşmış formlar
 *   Admin       → tümü
 *   Aynı departmandaki diğer çalışanlar → başkasının formunu GÖREMEZ
 *
 * Kimse kendi formunu onaylayamaz/reddedemez/kapatamaz (Admin dahil) — gönderen
 * tanımlı onaycıysa departman onayı zaten atlanır (bkz. workflow submit).
 * Hiçbir reviewer (Admin dahil) form içeriğini değiştiremez; içerik yalnız
 * sahibi tarafından DRAFT/REVISION durumunda düzenlenir.
 */

import {
  EXPENSE_CLOSED_STATUSES,
  EXPENSE_EDITABLE_STATUSES,
  EXPENSE_REVERT_TARGET,
  isExpenseAccountingUser,
  type ExpenseStatus,
} from "./constants";

export interface ExpenseActor {
  id: string;
  role: string;
  department: string;
  status: string;
}

/** Aktörün yetki bağlamı — şu anki onay ayarında onaycı olduğu departmanlar. */
export interface ExpenseActorScope {
  approverDepartments: string[];
}

export interface ExpenseApprovalLite {
  id: string;
  approverId: string;
  status: string;
}

export interface ExpenseRoundLite {
  id: string;
  roundNumber: number;
  status: string;
  approvals: ExpenseApprovalLite[];
}

export interface ExpenseFormLite {
  ownerId: string;
  status: string;
  departmentSnapshot: string | null;
  reachedAccountingAt: Date | string | null;
  rounds: ExpenseRoundLite[];
}

export function isExpenseAdmin(actor: ExpenseActor): boolean {
  return actor.role === "ADMIN" && actor.status === "ACTIVE";
}

function isActive(actor: ExpenseActor): boolean {
  return actor.status === "ACTIVE";
}

function isOwner(actor: ExpenseActor, form: ExpenseFormLite): boolean {
  return form.ownerId === actor.id;
}

/** En yüksek numaralı (güncel) onay turu. */
export function currentRound<R extends { roundNumber: number }>(form: { rounds: R[] }): R | null {
  if (form.rounds.length === 0) return null;
  return form.rounds.reduce((a, b) => (b.roundNumber > a.roundNumber ? b : a));
}

/** Departman onayı süren açık tur — yalnız form DEPT_APPROVAL iken. */
export function openDepartmentRound<R extends ExpenseRoundLite>(form: { status: string; rounds: R[] }): R | null {
  if (form.status !== "DEPT_APPROVAL") return null;
  const round = currentRound(form);
  return round && round.status === "PENDING" ? round : null;
}

/** Aktörün açık turdaki bekleyen onay kaydı. */
export function pendingApprovalFor(actor: ExpenseActor, form: ExpenseFormLite): ExpenseApprovalLite | null {
  const round = openDepartmentRound(form);
  if (!round) return null;
  return round.approvals.find((a) => a.approverId === actor.id && a.status === "PENDING") ?? null;
}

function appearsInAnyRound(actor: ExpenseActor, form: ExpenseFormLite): boolean {
  return form.rounds.some((r) => r.approvals.some((a) => a.approverId === actor.id));
}

// ── Görünürlük ───────────────────────────────────────────────────────────────

export function canViewExpenseForm(actor: ExpenseActor, form: ExpenseFormLite, scope: ExpenseActorScope): boolean {
  if (!isActive(actor)) return false;
  if (isExpenseAdmin(actor)) return true;
  if (isOwner(actor, form)) return true;
  if (form.status === "DRAFT") return false;
  if (appearsInAnyRound(actor, form)) return true;
  if (form.departmentSnapshot && scope.approverDepartments.includes(form.departmentSnapshot)) return true;
  if (form.reachedAccountingAt && isExpenseAccountingUser(actor)) return true;
  return false;
}

/**
 * Liste sorguları için Prisma WHERE — canViewExpenseForm ile birebir aynı kural.
 * (Prisma client import edilmez; düz obje literali.)
 */
export function buildExpenseVisibilityWhere(actor: ExpenseActor, scope: ExpenseActorScope): object {
  if (!isActive(actor)) return { id: "__none__" };
  if (isExpenseAdmin(actor)) return {};
  const or: object[] = [
    { ownerId: actor.id },
    { status: { not: "DRAFT" }, rounds: { some: { approvals: { some: { approverId: actor.id } } } } },
  ];
  if (scope.approverDepartments.length > 0) {
    or.push({ status: { not: "DRAFT" }, departmentSnapshot: { in: scope.approverDepartments } });
  }
  if (isExpenseAccountingUser(actor)) {
    or.push({ reachedAccountingAt: { not: null } });
  }
  return { OR: or };
}

// ── Sahip işlemleri ──────────────────────────────────────────────────────────

export function canEditExpenseForm(actor: ExpenseActor, form: ExpenseFormLite): boolean {
  return isActive(actor) && isOwner(actor, form) && EXPENSE_EDITABLE_STATUSES.includes(form.status as ExpenseStatus);
}

/** Onaya gönderme / yeniden gönderme (içerik doğrulaması ayrıca: validation.ts). */
export function canSubmitExpenseForm(actor: ExpenseActor, form: ExpenseFormLite): boolean {
  return canEditExpenseForm(actor, form);
}

/** Taslak kalıcı silme — iş akışı hiç başlamamış olmalı. */
export function canDeleteExpenseForm(actor: ExpenseActor, form: ExpenseFormLite): boolean {
  return isActive(actor) && isOwner(actor, form) && form.status === "DRAFT" && form.rounds.length === 0;
}

/** Formu İptal Et — yalnız sahibi, yalnız Düzeltme Bekliyor'da. */
export function canCancelExpenseForm(actor: ExpenseActor, form: ExpenseFormLite): boolean {
  return isActive(actor) && isOwner(actor, form) && form.status === "REVISION";
}

// ── Departman onayı ──────────────────────────────────────────────────────────

/**
 * Onayla/Reddet: açık turda bekleyen onay kaydı olan onaycı, ya da Admin
 * (tur üyesi değilse departman aşamasını tek başına kapatır). Sahibi hariç.
 */
export function canApproveDepartmentExpense(actor: ExpenseActor, form: ExpenseFormLite): boolean {
  if (!isActive(actor) || isOwner(actor, form)) return false;
  if (!openDepartmentRound(form)) return false;
  if (pendingApprovalFor(actor, form)) return true;
  return isExpenseAdmin(actor);
}

/** Pasifleşen onaycıyı değiştirme — yalnız Admin, yalnız açık turda. */
export function canReplaceExpenseApprover(actor: ExpenseActor, form: ExpenseFormLite): boolean {
  return isExpenseAdmin(actor) && openDepartmentRound(form) !== null;
}

// ── Muhasebe ─────────────────────────────────────────────────────────────────

function isAccountingOrAdmin(actor: ExpenseActor): boolean {
  return isExpenseAdmin(actor) || isExpenseAccountingUser(actor);
}

export function canApproveAccountingExpense(actor: ExpenseActor, form: ExpenseFormLite): boolean {
  return isActive(actor) && !isOwner(actor, form) && isAccountingOrAdmin(actor) && form.status === "ACCOUNTING_APPROVAL";
}

export function canMarkPaid(actor: ExpenseActor, form: ExpenseFormLite): boolean {
  return isActive(actor) && !isOwner(actor, form) && isAccountingOrAdmin(actor) && form.status === "PAYMENT_PENDING";
}

export function canMarkRefundReceived(actor: ExpenseActor, form: ExpenseFormLite): boolean {
  return isActive(actor) && !isOwner(actor, form) && isAccountingOrAdmin(actor) && form.status === "REFUND_PENDING";
}

/** Muhasebe/Admin rol kapısı (durumdan bağımsız) — 403/409 ayrımı için workflow kullanır. */
export function hasExpenseAccountingRole(actor: ExpenseActor): boolean {
  return isActive(actor) && isAccountingOrAdmin(actor);
}

// ── Çıktılar / belge temizliği ───────────────────────────────────────────────

/**
 * Harcama belgesi PDF'inin sunucudan fiziksel olarak kaldırılması — Muhasebe
 * veya Admin, yalnız kapanmış formda. Formu görme yetkisi ayrıca aranır (yoksa 404).
 */
export function canDeleteExpensePdf(actor: ExpenseActor, form: ExpenseFormLite): boolean {
  return hasExpenseAccountingRole(actor) && EXPENSE_CLOSED_STATUSES.includes(form.status as ExpenseStatus);
}

/** Excel'e Aktar — Muhasebe veya Admin. Dışa aktarılan satırlar yine görünürlük filtresinden geçer. */
export function canExportExpenseForms(actor: ExpenseActor): boolean {
  return hasExpenseAccountingRole(actor);
}

// ── Admin ────────────────────────────────────────────────────────────────────

export function canRevertSettlement(actor: ExpenseActor, form: ExpenseFormLite): boolean {
  return isExpenseAdmin(actor) && EXPENSE_REVERT_TARGET[form.status as ExpenseStatus] !== undefined;
}

export function canManageExpenseApprovalSettings(actor: ExpenseActor): boolean {
  return isExpenseAdmin(actor);
}

// ── Sekmeler ─────────────────────────────────────────────────────────────────

export interface ExpenseTabAccess {
  mine: boolean;
  approvals: boolean;
  accounting: boolean;
  all: boolean;
  settings: boolean;
}

/**
 * @param hasApprovalRecords aktörün herhangi bir turda onay kaydı var mı (ayardan
 *   çıkarılmış ama snapshot'ta hâlâ bekleyen onaycılar sekmeyi görmeye devam eder)
 */
export function getExpenseTabAccess(actor: ExpenseActor, scope: ExpenseActorScope, hasApprovalRecords: boolean): ExpenseTabAccess {
  const active = isActive(actor);
  return {
    mine: active,
    approvals: active && (scope.approverDepartments.length > 0 || hasApprovalRecords),
    accounting: active && isExpenseAccountingUser(actor),
    all: isExpenseAdmin(actor),
    settings: canManageExpenseApprovalSettings(actor),
  };
}

// ── UI bayrakları ────────────────────────────────────────────────────────────

export interface ExpensePermissionFlags {
  canEdit: boolean;
  canSubmit: boolean;
  canDelete: boolean;
  canCancel: boolean;
  canApproveDepartment: boolean;
  canApproveAccounting: boolean;
  canMarkPaid: boolean;
  canMarkRefundReceived: boolean;
  canRevertSettlement: boolean;
  canReplaceApprover: boolean;
  canDeleteDocument: boolean;
  /** Admin'in departman onayı turun üyesi olarak değil, aşamayı kapatarak mı yapılacağı */
  departmentActionIsAdminOverride: boolean;
}

export function getExpensePermissions(actor: ExpenseActor, form: ExpenseFormLite): ExpensePermissionFlags {
  const canApproveDepartment = canApproveDepartmentExpense(actor, form);
  return {
    canEdit: canEditExpenseForm(actor, form),
    canSubmit: canSubmitExpenseForm(actor, form),
    canDelete: canDeleteExpenseForm(actor, form),
    canCancel: canCancelExpenseForm(actor, form),
    canApproveDepartment,
    canApproveAccounting: canApproveAccountingExpense(actor, form),
    canMarkPaid: canMarkPaid(actor, form),
    canMarkRefundReceived: canMarkRefundReceived(actor, form),
    canRevertSettlement: canRevertSettlement(actor, form),
    canReplaceApprover: canReplaceExpenseApprover(actor, form),
    canDeleteDocument: canDeleteExpensePdf(actor, form),
    departmentActionIsAdminOverride: canApproveDepartment && !pendingApprovalFor(actor, form),
  };
}
