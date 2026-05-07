import clsx from "clsx";

type Priority = "HIGH" | "MEDIUM" | "LOW";

const cfg: Record<Priority, { label: string; cls: string; dot: string }> = {
  HIGH:   { label: "Yüksek", cls: "bg-red-50 text-red-600 border border-red-200",     dot: "bg-red-500" },
  MEDIUM: { label: "Orta",   cls: "bg-amber-50 text-amber-600 border border-amber-200", dot: "bg-amber-500" },
  LOW:    { label: "Düşük",  cls: "bg-emerald-50 text-emerald-600 border border-emerald-200", dot: "bg-emerald-500" },
};

export default function PriorityBadge({ priority }: { priority: Priority }) {
  const { label, cls, dot } = cfg[priority] ?? cfg.MEDIUM;
  return (
    <span className={clsx("inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-semibold", cls)}>
      <span className={clsx("w-1.5 h-1.5 rounded-full", dot)} />
      {label}
    </span>
  );
}
