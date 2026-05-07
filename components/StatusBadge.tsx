import clsx from "clsx";

type Status = "TODO" | "IN_PROGRESS" | "REVIEW" | "DONE";

const cfg: Record<Status, { label: string; cls: string }> = {
  TODO:        { label: "Yapılacak",      cls: "bg-gray-100 text-gray-600" },
  IN_PROGRESS: { label: "Devam Ediyor",  cls: "bg-orange-50 text-orange-600 border border-orange-200" },
  REVIEW:      { label: "İncelemede",    cls: "bg-indigo-50 text-indigo-600 border border-indigo-200" },
  DONE:        { label: "Tamamlandı",    cls: "bg-emerald-50 text-emerald-600 border border-emerald-200" },
};

export default function StatusBadge({ status }: { status: Status }) {
  const { label, cls } = cfg[status] ?? cfg.TODO;
  return (
    <span className={clsx("inline-block text-[11px] font-semibold px-2 py-0.5 rounded-full", cls)}>
      {label}
    </span>
  );
}
