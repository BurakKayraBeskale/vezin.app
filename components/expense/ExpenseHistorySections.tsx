"use client";

/**
 * Form detayındaki onay / muhasebe / geçmiş bölümleri — hem düzenleme hem
 * salt-okunur görünümde ortak. Eski turlar silinmez, tur tur listelenir.
 */

import clsx from "clsx";
import { formatTRY } from "@/lib/expense/calc";
import {
  APPROVAL_STATUS_LABELS,
  EXPENSE_AUDIT_LABELS,
  EXPENSE_STATUS_LABELS,
  ROUND_STATUS_LABELS,
  SETTLEMENT_TYPE_LABELS,
  type ExpenseStatus,
} from "@/lib/expense/constants";
import type { ExpenseDetailDTO, ExpenseRoundDTO } from "./types";
import { Badge, Card, formatDateTime, formatDay } from "./ui";

const APPROVAL_COLOR: Record<string, "indigo" | "orange" | "gray" | "red" | "emerald"> = {
  PENDING: "orange",
  APPROVED: "emerald",
  REJECTED: "red",
  REPLACED: "gray",
  OVERRIDDEN: "gray",
};

function ApprovalList({
  round,
  canReplace,
  onReplace,
}: {
  round: ExpenseRoundDTO;
  canReplace?: boolean;
  onReplace?: (approvalId: string) => void;
}) {
  if (round.bypassed) {
    return <p className="text-sm text-gray-500">Gönderen, departmanın tanımlı onaycılarından biri olduğu için departman onayı atlandı.</p>;
  }
  return (
    <ul className="divide-y divide-gray-50">
      {round.approvals.map((a) => (
        <li key={a.id} className="py-2 flex items-start gap-3 flex-wrap">
          <div className="flex-1 min-w-0">
            <p className={clsx("text-sm font-medium", a.status === "REPLACED" ? "text-gray-400 line-through" : "text-gray-700")}>
              {a.approverName}
              {!a.approverActive && <span className="ml-2 text-[11px] font-semibold text-red-600 no-underline">Pasif</span>}
              {a.replacesApprovalId && <span className="ml-2 text-[11px] text-gray-400">(Admin atadı)</span>}
            </p>
            {a.note && <p className="text-xs text-gray-600 mt-0.5 whitespace-pre-line">“{a.note}”</p>}
            {a.status === "REPLACED" && (
              <p className="text-[11px] text-gray-400 mt-0.5">
                {a.replacedByName ?? "Admin"} tarafından değiştirildi · {formatDateTime(a.replacedAt)}
              </p>
            )}
          </div>
          <div className="flex items-center gap-2 flex-shrink-0">
            {a.decidedAt && <span className="text-[11px] text-gray-400 tabular-nums">{formatDateTime(a.decidedAt)}</span>}
            <Badge color={APPROVAL_COLOR[a.status] ?? "gray"}>{APPROVAL_STATUS_LABELS[a.status] ?? a.status}</Badge>
            {canReplace && a.status === "PENDING" && !a.approverActive && (
              <button
                type="button"
                onClick={() => onReplace?.(a.id)}
                className="text-xs font-semibold text-[#F57C28] hover:underline"
              >
                Değiştir
              </button>
            )}
          </div>
        </li>
      ))}
    </ul>
  );
}

function AccountingLine({ round }: { round: ExpenseRoundDTO }) {
  if (!round.accountingStatus) return null;
  const approved = round.accountingStatus === "APPROVED";
  return (
    <div className="text-sm">
      <span className={approved ? "text-emerald-600 font-semibold" : "text-red-600 font-semibold"}>
        Muhasebe {approved ? "onayladı" : "reddetti"}
      </span>
      <span className="text-gray-400 text-xs ml-2">
        {round.accountingByName ?? "—"} · {formatDateTime(round.accountingAt)}
      </span>
      {round.accountingNote && <p className="text-xs text-gray-600 mt-0.5 whitespace-pre-line">“{round.accountingNote}”</p>}
    </div>
  );
}

export function DepartmentApprovalSection({
  detail,
  onReplace,
}: {
  detail: ExpenseDetailDTO;
  onReplace: (approvalId: string) => void;
}) {
  const round = detail.rounds[detail.rounds.length - 1];
  if (!round) return null;
  const pct = round.requiredCount ? Math.round((round.approvedCount / round.requiredCount) * 100) : 0;
  return (
    <Card
      title="Departman Onayları"
      right={
        !round.bypassed && (
          <span className="text-xs font-semibold text-gray-500 tabular-nums">
            {round.approvedCount}/{round.requiredCount} onay · Tur {round.roundNumber}
          </span>
        )
      }
    >
      <div className="px-5 py-3 space-y-2">
        {!round.bypassed && (
          <div className="h-1.5 bg-gray-100 rounded-full overflow-hidden">
            <div className={clsx("h-full rounded-full", round.status === "REJECTED" ? "bg-red-400" : "bg-emerald-500")} style={{ width: `${pct}%` }} />
          </div>
        )}
        {round.adminOverride && round.status === "APPROVED" && (
          <p className="text-xs text-gray-500">Departman aşaması {round.closedByName ?? "Admin"} tarafından onaylanarak kapatıldı.</p>
        )}
        {round.status === "REJECTED" && round.rejectionNote && (
          <p className="text-xs text-red-600">
            Reddedildi ({round.closedByName ?? "—"}): {round.rejectionNote}
          </p>
        )}
        <ApprovalList round={round} canReplace={detail.permissions.canReplaceApprover} onReplace={onReplace} />
      </div>
    </Card>
  );
}

export function AccountingSection({ detail }: { detail: ExpenseDetailDTO }) {
  const round = detail.rounds[detail.rounds.length - 1];
  const settlements = [...detail.settlements].reverse();
  const reached = detail.rounds.some((r) => r.status === "APPROVED" || r.status === "SKIPPED");
  return (
    <Card title="Muhasebe İşlemi">
      <div className="px-5 py-3 space-y-3">
        {round?.accountingStatus ? (
          <AccountingLine round={round} />
        ) : (
          <p className="text-sm text-gray-400">
            {detail.status === "ACCOUNTING_APPROVAL" ? "Muhasebe onayı bekleniyor." : reached ? "Bu turda muhasebe kararı yok." : "Form henüz muhasebe aşamasına gelmedi."}
          </p>
        )}
        {settlements.length > 0 && (
          <ul className="divide-y divide-gray-50 border-t border-gray-100">
            {settlements.map((s) => (
              <li key={s.id} className="py-2.5 text-sm">
                <div className="flex items-center justify-between gap-3 flex-wrap">
                  <span className={clsx("font-semibold", s.revertedAt ? "text-gray-400 line-through" : "text-gray-700")}>
                    {SETTLEMENT_TYPE_LABELS[s.type] ?? s.type} · {formatTRY(s.amount)}
                  </span>
                  <span className="text-xs text-gray-400">
                    İşlem tarihi {formatDay(s.transactionDate)} · {s.createdByName} · {formatDateTime(s.createdAt)}
                  </span>
                </div>
                {s.note && <p className="text-xs text-gray-600 mt-0.5">{s.note}</p>}
                {s.revertedAt && (
                  <p className="text-xs text-red-600 mt-0.5">
                    Geri alındı — {s.revertedByName} · {formatDateTime(s.revertedAt)}: {s.revertReason}
                  </p>
                )}
              </li>
            ))}
          </ul>
        )}
      </div>
    </Card>
  );
}

export function RoundHistorySection({ detail }: { detail: ExpenseDetailDTO }) {
  if (detail.rounds.length === 0) return null;
  const rounds = [...detail.rounds].reverse();
  return (
    <Card title="Onay / Revizyon Geçmişi">
      <div className="divide-y divide-gray-100">
        {rounds.map((r) => (
          <details key={r.id} open={r.roundNumber === detail.rounds.length} className="px-5 py-3 group">
            <summary className="cursor-pointer list-none flex items-center gap-3 flex-wrap">
              <span className="text-sm font-bold text-gray-700">Tur {r.roundNumber}</span>
              <Badge color={r.status === "REJECTED" ? "red" : r.status === "PENDING" ? "orange" : r.status === "SKIPPED" ? "gray" : "emerald"}>
                {ROUND_STATUS_LABELS[r.status] ?? r.status}
              </Badge>
              {!r.bypassed && <span className="text-xs text-gray-500 tabular-nums">{r.approvedCount}/{r.requiredCount}</span>}
              <span className="text-xs text-gray-400 ml-auto">
                Gönderen {r.submittedByName ?? "—"} · {formatDateTime(r.submittedAt)}
              </span>
            </summary>
            <div className="mt-2 pl-1 space-y-2">
              <ApprovalList round={r} />
              {r.status === "REJECTED" && r.rejectionNote && (
                <p className="text-xs text-red-600">Red açıklaması: {r.rejectionNote}</p>
              )}
              <AccountingLine round={r} />
            </div>
          </details>
        ))}
      </div>
    </Card>
  );
}

function metaSummary(action: string, meta: Record<string, unknown> | null): string | null {
  if (!meta) return null;
  switch (action) {
    case "APPROVER_REPLACED":
      return `${meta.oldApproverName ?? "—"} → ${meta.newApproverName ?? "—"} (Tur ${meta.roundNumber})`;
    case "ROUND_CREATED":
      return Array.isArray(meta.approvers) && meta.approvers.length
        ? `Tur ${meta.roundNumber}: ${(meta.approvers as string[]).join(", ")}`
        : `Tur ${meta.roundNumber}`;
    case "DEPT_APPROVED":
      return `${meta.approved}/${meta.required}`;
    case "SUBMITTED":
    case "RESUBMITTED":
      return typeof meta.netAmount === "number" ? `Net ${formatTRY(meta.netAmount)}` : null;
    case "PAID":
    case "REFUND_RECEIVED":
      return typeof meta.amount === "number" ? `${formatTRY(meta.amount)} · ${meta.transactionDate}` : null;
    case "DOCUMENT_UPLOADED":
    case "DOCUMENT_REPLACED":
      return meta.previousName ? `${meta.previousName} → ${meta.name}` : String(meta.name ?? "");
    case "DOCUMENT_DELETED":
      return Array.isArray(meta.roundNumbers) && meta.roundNumbers.length
        ? `${meta.name} (Tur ${(meta.roundNumbers as number[]).join(", ")})`
        : String(meta.name ?? "");
    case "UPDATED":
      return typeof meta.netAmount === "number" ? `Net ${formatTRY(meta.netAmount)}, ${meta.itemCount} satır` : null;
    default:
      return null;
  }
}

export function AuditSection({ detail }: { detail: ExpenseDetailDTO }) {
  const audits = [...detail.audits].reverse();
  return (
    <Card title="İşlem Geçmişi">
      <ul className="divide-y divide-gray-50">
        {audits.map((a) => {
          const extra = metaSummary(a.action, a.meta);
          return (
            <li key={a.id} className="px-5 py-2.5 flex items-start gap-3 text-sm">
              <span className="text-[11px] text-gray-400 tabular-nums w-32 flex-shrink-0 pt-0.5">{formatDateTime(a.createdAt)}</span>
              <div className="flex-1 min-w-0">
                <p className="text-gray-700">
                  {EXPENSE_AUDIT_LABELS[a.action] ?? a.action}
                  {a.toStatus && a.fromStatus && (
                    <span className="text-xs text-gray-400 ml-2">
                      {EXPENSE_STATUS_LABELS[a.fromStatus as ExpenseStatus] ?? a.fromStatus} → {EXPENSE_STATUS_LABELS[a.toStatus as ExpenseStatus] ?? a.toStatus}
                    </span>
                  )}
                </p>
                {extra && <p className="text-xs text-gray-500">{extra}</p>}
                {a.note && <p className="text-xs text-gray-600 whitespace-pre-line">“{a.note}”</p>}
              </div>
              <span className="text-xs text-gray-500 flex-shrink-0">{a.actorName ?? "Sistem"}</span>
            </li>
          );
        })}
      </ul>
    </Card>
  );
}
