import type { ExpensePermissionFlags, ExpenseTabAccess } from "@/lib/expense/permissions";

export type { ExpensePermissionFlags, ExpenseTabAccess };

/** GET /api/expenses/[id] yanıtı (tarihler ISO metin). Kaynak: lib/expense/data.ts getExpenseDetail */
export interface ExpenseDetailDTO {
  id: string;
  formNo: string;
  status: string;
  version: number;
  note: string | null;
  owner: { id: string; status: string };
  ownerName: string;
  department: string;
  title: string;
  isSnapshot: boolean;
  createdAt: string;
  lastActionAt: string;
  firstSubmittedAt: string | null;
  cashAdvance: number;
  totalAmount: number;
  netAmount: number;
  items: {
    id: string;
    date: string | null;
    subject: string;
    vendor: string;
    description: string;
    clientProject: string | null;
    amount: number;
  }[];
  activeDocument: ExpenseDocumentDTO | null;
  previousDocuments: ExpenseDocumentDTO[];
  /** Fiziksel dosyası sunucudan kaldırılmış belgeler — metadata korunur */
  archivedDocuments: ExpenseDocumentDTO[];
  rounds: ExpenseRoundDTO[];
  settlements: {
    id: string;
    type: string;
    amount: number;
    transactionDate: string;
    note: string | null;
    createdByName: string;
    createdAt: string;
    revertedAt: string | null;
    revertedByName: string | null;
    revertReason: string | null;
  }[];
  audits: {
    id: string;
    action: string;
    actorName: string | null;
    fromStatus: string | null;
    toStatus: string | null;
    note: string | null;
    meta: Record<string, unknown> | null;
    createdAt: string;
  }[];
  lastRejection: { stage: "DEPARTMENT" | "ACCOUNTING"; note: string | null; byName: string | null; at: string | null } | null;
  permissions: ExpensePermissionFlags;
  approverCandidates: { id: string; name: string; title: string }[];
}

export interface ExpenseDocumentDTO {
  id: string;
  name: string;
  size: number;
  createdAt: string;
  uploadedByName: string;
  replacedAt: string | null;
  deletedAt: string | null;
  deletedByName: string | null;
  /** Belgenin kullanıldığı onay turları */
  roundNumbers: number[];
}

export interface ExpenseRoundDTO {
  id: string;
  roundNumber: number;
  status: string;
  bypassed: boolean;
  adminOverride: boolean;
  submittedAt: string;
  submittedByName: string | null;
  closedAt: string | null;
  closedByName: string | null;
  rejectionNote: string | null;
  accountingStatus: string | null;
  accountingByName: string | null;
  accountingAt: string | null;
  accountingNote: string | null;
  approvedCount: number;
  requiredCount: number;
  approvals: {
    id: string;
    approverId: string;
    approverName: string;
    approverActive: boolean;
    status: string;
    decidedAt: string | null;
    note: string | null;
    replacedAt: string | null;
    replacedByName: string | null;
    replacesApprovalId: string | null;
  }[];
}

/** GET /api/expenses liste satırı */
export interface ExpenseListRow {
  id: string;
  formNo: string;
  status: string;
  createdAt: string;
  lastActionAt: string;
  totalAmount: number;
  cashAdvance: number;
  netAmount: number;
  ownerId: string;
  ownerName: string;
  department: string;
  approvalProgress: { approved: number; required: number } | null;
}

export interface ExpenseListResponse {
  forms: ExpenseListRow[];
  facets: { departments: string[]; owners: { id: string; name: string }[] } | null;
  summary: {
    receivable: { amount: number; count: number };
    refund: { amount: number; count: number };
    inApproval: { amount: number; count: number };
  } | null;
  truncated: boolean;
}

/** Üst bilgi alanları — taslakta canlı kullanıcı, gönderilmiş formda snapshot. */
export interface ExpenseHeaderInfo {
  formNo: string | null;
  ownerName: string;
  department: string;
  title: string;
  createdAt: string | null;
}
