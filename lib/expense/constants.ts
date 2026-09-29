/**
 * Personel Harcama Formu — sabitler ve etiketler (UI + sunucu ortak).
 *
 * Prisma client import ETMEZ; hem client bileşenlerinden hem API'den
 * güvenle import edilebilir.
 */

/**
 * Muhasebe aşamasını yürüten departman (User.department değeri). Muhasebe
 * yetkisine dair TÜM kontroller isExpenseAccountingUser üzerinden geçer —
 * "MUHASEBE" string karşılaştırması bileşenlere dağıtılmaz.
 */
export const EXPENSE_ACCOUNTING_DEPARTMENT = "MUHASEBE";

export function isExpenseAccountingUser(user: { department?: string | null; status?: string | null }): boolean {
  return user.department === EXPENSE_ACCOUNTING_DEPARTMENT && (user.status ?? "ACTIVE") === "ACTIVE";
}

// ── Durumlar ─────────────────────────────────────────────────────────────────

export const EXPENSE_STATUSES = [
  "DRAFT",
  "DEPT_APPROVAL",
  "REVISION",
  "ACCOUNTING_APPROVAL",
  "PAYMENT_PENDING",
  "REFUND_PENDING",
  "PAID",
  "REFUND_RECEIVED",
  "SETTLED",
  "CANCELLED",
] as const;
export type ExpenseStatus = (typeof EXPENSE_STATUSES)[number];

export const EXPENSE_STATUS_LABELS: Record<ExpenseStatus, string> = {
  DRAFT:               "Taslak",
  DEPT_APPROVAL:       "Departman Onayında",
  REVISION:            "Düzeltme Bekliyor",
  ACCOUNTING_APPROVAL: "Muhasebe Onayında",
  PAYMENT_PENDING:     "Ödeme Bekliyor",
  REFUND_PENDING:      "İade Bekliyor",
  PAID:                "Ödendi",
  REFUND_RECEIVED:     "İade Alındı",
  SETTLED:             "Mahsuplaştı",
  CANCELLED:           "İptal Edildi",
};

export function isExpenseStatus(v: unknown): v is ExpenseStatus {
  return typeof v === "string" && (EXPENSE_STATUSES as readonly string[]).includes(v);
}

/** Form sahibinin içerik düzenleyebildiği durumlar. */
export const EXPENSE_EDITABLE_STATUSES: ExpenseStatus[] = ["DRAFT", "REVISION"];
/** "Onay Sürecindeki Talepler" kartı. */
export const EXPENSE_IN_APPROVAL_STATUSES: ExpenseStatus[] = ["DEPT_APPROVAL", "ACCOUNTING_APPROVAL"];
/** Muhasebe İşlemleri sekmesinde "Bekleyen" görünümü. */
export const EXPENSE_ACCOUNTING_OPEN_STATUSES: ExpenseStatus[] = ["ACCOUNTING_APPROVAL", "PAYMENT_PENDING", "REFUND_PENDING"];
/**
 * Kapanmış formlar — harcama belgesi PDF'i yalnız bu durumlarda sunucudan
 * kaldırılabilir. Süreç devam ederken (onay/düzeltme/ödeme/iade bekleyen) belge korunur.
 */
export const EXPENSE_CLOSED_STATUSES: ExpenseStatus[] = ["PAID", "REFUND_RECEIVED", "SETTLED", "CANCELLED"];
/** Admin'in geri alabildiği kapanış durumları → geri alınınca dönülecek durum. */
export const EXPENSE_REVERT_TARGET: Partial<Record<ExpenseStatus, ExpenseStatus>> = {
  PAID:            "PAYMENT_PENDING",
  REFUND_RECEIVED: "REFUND_PENDING",
  // Net 0 formda ödeme/iade aşaması yok — tek anlamlı açık durum muhasebe onayıdır.
  SETTLED:         "ACCOUNTING_APPROVAL",
};

// ── Round / onaycı kaydı durumları ───────────────────────────────────────────

export const ROUND_STATUS_LABELS: Record<string, string> = {
  PENDING:  "Onay bekliyor",
  APPROVED: "Departman onayı tamamlandı",
  REJECTED: "Reddedildi",
  SKIPPED:  "Departman onayı atlandı",
};

export const APPROVAL_STATUS_LABELS: Record<string, string> = {
  PENDING:    "Bekliyor",
  APPROVED:   "Onayladı",
  REJECTED:   "Reddetti",
  REPLACED:   "Değiştirildi",
  OVERRIDDEN: "Admin kapattı",
};

export const SETTLEMENT_TYPE_LABELS: Record<string, string> = {
  PAYMENT: "Ödeme",
  REFUND:  "İade",
  OFFSET:  "Mahsup",
};

// ── Audit ────────────────────────────────────────────────────────────────────

export const EXPENSE_AUDIT_LABELS: Record<string, string> = {
  CREATED:             "Form oluşturuldu",
  UPDATED:             "Form düzeltildi",
  DOCUMENT_UPLOADED:   "PDF yüklendi",
  DOCUMENT_REPLACED:   "PDF değiştirildi",
  DOCUMENT_DELETED:    "Harcama belgesi PDF'i sunucudan kaldırıldı",
  SUBMITTED:           "Onaya gönderildi",
  RESUBMITTED:         "Yeniden gönderildi",
  ROUND_CREATED:       "Onay turu oluşturuldu",
  DEPT_BYPASSED:       "Departman onayı atlandı (gönderen tanımlı onaycı)",
  DEPT_APPROVED:       "Departman onayı verildi",
  DEPT_REJECTED:       "Departman onayı reddedildi",
  DEPT_ADMIN_APPROVED: "Departman aşaması Admin tarafından onaylandı",
  DEPT_COMPLETED:      "Departman onayı tamamlandı, Muhasebe'ye geçti",
  APPROVER_REPLACED:   "Onaycı Admin tarafından değiştirildi",
  ACCOUNTING_APPROVED: "Muhasebe onayladı",
  ACCOUNTING_REJECTED: "Muhasebe reddetti",
  PAYMENT_PENDING:     "Ödeme Bekliyor durumuna geçti",
  REFUND_PENDING:      "İade Bekliyor durumuna geçti",
  PAID:                "Ödendi olarak işaretlendi",
  REFUND_RECEIVED:     "İade Alındı olarak işaretlendi",
  SETTLED:             "Mahsuplaştı",
  CANCELLED:           "Form iptal edildi",
  SETTLEMENT_REVERTED: "Kapanış geri alındı",
};

// ── Bildirim türleri (Notification.type) ─────────────────────────────────────

export const EXPENSE_NOTIFICATION_TYPES = {
  approvalRequest:    "EXPENSE_APPROVAL_REQUEST",
  accountingRequest:  "EXPENSE_ACCOUNTING_REQUEST",
  rejected:           "EXPENSE_REJECTED",
  accountingApproved: "EXPENSE_ACCOUNTING_APPROVED",
  paid:               "EXPENSE_PAID",
  refundReceived:     "EXPENSE_REFUND_RECEIVED",
  approverChanged:    "EXPENSE_APPROVER_CHANGED",
  settlementReverted: "EXPENSE_SETTLEMENT_REVERTED",
} as const;

export function expenseFormHref(formId: string): string {
  return `/harcama/${formId}`;
}

// ── Form No ──────────────────────────────────────────────────────────────────

export const EXPENSE_FORM_NO_PREFIX = "PHF";

export function formatExpenseFormNo(year: number, seq: number): string {
  return `${EXPENSE_FORM_NO_PREFIX}-${year}-${String(seq).padStart(6, "0")}`;
}

// ── Belge ────────────────────────────────────────────────────────────────────

export const EXPENSE_PDF_MAX_BYTES = 20 * 1024 * 1024;

export const EXPENSE_PDF_DELETE_CONFIRM =
  "Harcama belgesi PDF dosyası sunucudan kalıcı olarak kaldırılacaktır. Form, harcama bilgileri ve onay geçmişi korunacaktır. Bu işlem geri alınamaz.";
export const EXPENSE_DOCUMENT_ARCHIVED_MESSAGE = "Fiziksel belge arşivlendikten sonra sistemden kaldırılmıştır.";

// ── Mesajlar ─────────────────────────────────────────────────────────────────

export const EXPENSE_NO_APPROVER_MESSAGE =
  "Departmanınız için harcama onay akışı henüz tanımlanmamış. Lütfen sistem yöneticisiyle iletişime geçin.";
export const EXPENSE_STALE_MESSAGE =
  "Form bu arada başka bir kullanıcı tarafından güncellendi. Lütfen sayfayı yenileyip tekrar deneyin.";

// ── Departman etiketleri ─────────────────────────────────────────────────────
// Departman listesi DİNAMİKTİR (User.department'taki mevcut değerler); bu harita
// yalnızca bilinen değerlerin okunur adını verir, bilinmeyen değer olduğu gibi gösterilir.

const DEPARTMENT_LABELS: Record<string, string> = {
  ADMIN:                "Yönetim",
  BAGIMSIZ_DENETIM:     "Bağımsız Denetim",
  YEMINLI_MALI_MUSAVIR: "Yeminli Mali Müşavirlik",
  MUHASEBE:             "Muhasebe",
  IDARI_ISLER:          "İdari İşler",
  OUTSOURCE:            "Outsource",
};

export function expenseDepartmentLabel(department: string | null | undefined): string {
  if (!department) return "—";
  return DEPARTMENT_LABELS[department] ?? department;
}
