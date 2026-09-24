import { LeaveType, LeaveStatus, LEAVE_TYPE_LABELS, LEAVE_STATUS_LABELS } from "@/lib/leave";

const TYPE_COLORS: Record<LeaveType, { bg: string; text: string; border: string }> = {
  ANNUAL:   { bg: "var(--badge-indigo-bg)",  text: "var(--badge-indigo-text)",  border: "var(--badge-indigo-border)" },
  EXCUSE:   { bg: "var(--badge-orange-bg)",  text: "var(--badge-orange-text)",  border: "var(--badge-orange-border)" },
  SICK:     { bg: "var(--badge-red-bg)",     text: "var(--badge-red-text)",     border: "var(--badge-red-border)" },
  UNPAID:   { bg: "var(--badge-gray-bg)",    text: "var(--badge-gray-text)",    border: "var(--badge-gray-border)" },
  PARENTAL: { bg: "var(--badge-emerald-bg)", text: "var(--badge-emerald-text)", border: "var(--badge-emerald-border)" },
};

const STATUS_COLORS: Record<LeaveStatus, { bg: string; text: string; border: string }> = {
  PENDING:   { bg: "var(--badge-orange-bg)",  text: "var(--badge-orange-text)",  border: "var(--badge-orange-border)" },
  APPROVED:  { bg: "var(--badge-emerald-bg)", text: "var(--badge-emerald-text)", border: "var(--badge-emerald-border)" },
  REJECTED:  { bg: "var(--badge-red-bg)",     text: "var(--badge-red-text)",     border: "var(--badge-red-border)" },
  CANCELLED: { bg: "var(--badge-gray-bg)",    text: "var(--badge-gray-text)",    border: "var(--badge-gray-border)" },
};

export function LeaveTypeBadge({ type }: { type: string }) {
  const c = TYPE_COLORS[type as LeaveType] ?? TYPE_COLORS.ANNUAL;
  return (
    <span
      className="inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-semibold border whitespace-nowrap"
      style={{ backgroundColor: c.bg, color: c.text, borderColor: c.border }}
    >
      {LEAVE_TYPE_LABELS[type as LeaveType] ?? type}
    </span>
  );
}

export function LeaveStatusBadge({ status }: { status: string }) {
  const c = STATUS_COLORS[status as LeaveStatus] ?? STATUS_COLORS.PENDING;
  return (
    <span
      className="inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-semibold border whitespace-nowrap"
      style={{ backgroundColor: c.bg, color: c.text, borderColor: c.border }}
    >
      {LEAVE_STATUS_LABELS[status as LeaveStatus] ?? status}
    </span>
  );
}
