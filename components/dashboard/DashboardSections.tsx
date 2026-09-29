"use client";

/**
 * Dashboard bölümleri — yalnız gösterim. Tüm sayılar/linkler /api/dashboard
 * yanıtından gelir (lib/dashboard/service.ts); burada hesap/yetki mantığı yok.
 */

import Link from "next/link";
import clsx from "clsx";
import MetricCard from "@/components/MetricCard";
import StatusBadge from "@/components/StatusBadge";
import PriorityBadge from "@/components/PriorityBadge";
import { BOARD_COLUMN_DEFS } from "@/components/board/types";
import { formatTRY } from "@/lib/expense/calc";
import type { DashboardSummaryDTO, UpcomingGroup } from "./types";

// ── Ortak ────────────────────────────────────────────────────────────────────

export function Panel({
  title,
  subtitle,
  action,
  children,
  className,
}: {
  title: string;
  subtitle?: string;
  action?: React.ReactNode;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <section className={clsx("bg-white rounded-2xl border border-gray-100 shadow-sm", className)}>
      <div className="px-5 py-3.5 border-b border-gray-100 flex items-center justify-between gap-3">
        <div className="min-w-0">
          <h2 className="text-sm font-bold text-gray-800">{title}</h2>
          {subtitle && <p className="text-[11px] text-gray-400 mt-0.5">{subtitle}</p>}
        </div>
        {action}
      </div>
      {children}
    </section>
  );
}

function SeeAll({ href, label }: { href: string; label: string }) {
  return (
    <Link href={href} className="text-xs font-semibold text-[#F57C28] hover:underline flex-shrink-0">
      {label}
    </Link>
  );
}

/** Son tarih — tarih-yalnız alanlar UTC gece yarısı saklanır; gün kaymasın diye UTC gösterilir. */
function formatDue(iso: string | null): string {
  if (!iso) return "—";
  return new Date(iso).toLocaleDateString("tr-TR", { timeZone: "UTC", day: "2-digit", month: "2-digit", year: "numeric" });
}

// ── KPI kartları ─────────────────────────────────────────────────────────────

const ICONS = {
  open: "M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2M9 12l2 2 4-4",
  overdue: "M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z",
  review: "M15 12a3 3 0 11-6 0 3 3 0 016 0z M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z",
  done: "M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z",
};

function Icon({ d }: { d: string }) {
  return (
    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d={d} />
    </svg>
  );
}

export function KpiCards({ data }: { data: DashboardSummaryDTO }) {
  const { kpis } = data;
  const cards = [
    { title: "Açık Görevler", value: kpis.open, sub: "Yapılacak, devam eden ve incelemedeki", accent: "orange", icon: ICONS.open },
    { title: "Geciken Görevler", value: kpis.overdue, sub: "Son tarihi geçmiş, tamamlanmamış", accent: "red", icon: ICONS.overdue },
    { title: "İncelemesinde Bekleyenler", value: kpis.review, sub: "İnceleme sahibi olduğu, incelemede", accent: "indigo", icon: ICONS.review },
    { title: "Bu Hafta Tamamlanan", value: kpis.doneThisWeek, sub: "Bu takvim haftası kapatılan", accent: "emerald", icon: ICONS.done },
  ];
  return (
    <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
      {cards.map((c) => (
        <MetricCard
          key={c.title}
          title={c.title}
          value={c.value.count}
          sub={c.sub}
          accentColor={`var(--badge-${c.accent}-text)`}
          bgColor={`var(--badge-${c.accent}-bg)`}
          href={c.value.href}
          ariaLabel={`${c.title}: ${c.value.count}. Görev Takip'te filtrelenmiş listeyi aç.`}
          icon={<Icon d={c.icon} />}
        />
      ))}
    </div>
  );
}

// ── Bekleyen İşlemler ────────────────────────────────────────────────────────

export function PendingActions({ data }: { data: DashboardSummaryDTO }) {
  return (
    <Panel
      title="Bekleyen İşlemler"
      subtitle={data.person.isSelf ? "Aksiyon almanız gereken işler" : `${data.person.name} için bekleyen işler`}
    >
      {data.pending.length === 0 ? (
        <p className="px-5 py-6 text-sm text-gray-400">Bekleyen işlem bulunmuyor.</p>
      ) : (
        <ul className="divide-y divide-gray-50">
          {data.pending.map((p) => (
            <li key={p.key}>
              <Link href={p.href} className="flex items-center justify-between gap-3 px-5 py-3 hover:bg-gray-50 transition-colors">
                <span className="text-sm text-gray-700">{p.label}</span>
                <span className="text-sm font-bold tabular-nums text-[#F57C28] bg-[#FFF3E9] rounded-lg px-2 py-0.5">{p.count}</span>
              </Link>
            </li>
          ))}
        </ul>
      )}
      {!data.person.isSelf && data.pending.length > 0 && (
        <p className="px-5 pb-3 text-[11px] text-gray-400">
          İşlemler ilgili modülde kendi yetkinizle yapılır; seçili personel adına işlem yapılamaz.
        </p>
      )}
    </Panel>
  );
}

// ── Finansal özet (yalnız yetkiliye döner) ───────────────────────────────────

export function FinanceSummary({ data }: { data: DashboardSummaryDTO }) {
  const f = data.finance;
  if (!f) return null;
  return (
    <Panel title="Harcama Özeti" subtitle="Kesinleşmiş alacak / iade (muhasebe onayı sonrası)" action={<SeeAll href={f.href} label="Harcamalar" />}>
      <div className="px-5 py-4 space-y-2.5 text-sm">
        <div className="flex justify-between gap-3">
          <span className="text-gray-500">Vezin&apos;den Alacağı</span>
          <span className="tabular-nums font-semibold text-emerald-600">{formatTRY(f.receivable.amount)}</span>
        </div>
        <div className="flex justify-between gap-3">
          <span className="text-gray-500">Vezin&apos;e İade Etmesi Gereken</span>
          <span className="tabular-nums font-semibold text-red-600">{formatTRY(f.refund.amount)}</span>
        </div>
        {f.inApproval && (
          <div className="flex justify-between gap-3 border-t border-gray-100 pt-2.5">
            <span className="text-gray-500">Onay sürecindeki formlar</span>
            <span className="tabular-nums text-gray-700">{f.inApproval.count} form</span>
          </div>
        )}
      </div>
    </Panel>
  );
}

// ── Bugün & Yaklaşan İşler ───────────────────────────────────────────────────

const GROUP_META: Record<UpcomingGroup, { label: string; cls: string }> = {
  overdue: { label: "Gecikmiş", cls: "text-red-600 bg-red-50 border-red-200" },
  today: { label: "Bugün", cls: "text-[#F57C28] bg-[#FFF3E9] border-[#F57C28]/30" },
  upcoming: { label: "Yaklaşan", cls: "text-gray-600 bg-gray-100 border-gray-200" },
};

export function UpcomingTasks({ data, onOpenTask }: { data: DashboardSummaryDTO; onOpenTask: (id: string) => void }) {
  const { items, total, href } = data.upcoming;
  const groups: UpcomingGroup[] = ["overdue", "today", "upcoming"];
  return (
    <Panel
      title="Bugün & Yaklaşan İşler"
      subtitle="Gecikmişler, bugün ve önümüzdeki 7 gün"
      action={total > items.length ? <SeeAll href={href} label={`Tümünü Gör (${total})`} /> : undefined}
    >
      {items.length === 0 ? (
        <p className="px-5 py-8 text-sm text-gray-400 text-center">Önümüzdeki 7 gün için yaklaşan görev bulunmuyor.</p>
      ) : (
        <div className="divide-y divide-gray-100">
          {groups.map((g) => {
            const rows = items.filter((i) => i.group === g);
            if (rows.length === 0) return null;
            return (
              <div key={g} className="py-1">
                <p className="px-5 pt-2 pb-1 text-[11px] font-semibold uppercase tracking-wide text-gray-400">{GROUP_META[g].label}</p>
                <ul>
                  {rows.map((t) => (
                    <li key={t.id}>
                      <button
                        type="button"
                        onClick={() => onOpenTask(t.id)}
                        className="w-full text-left px-5 py-2.5 hover:bg-gray-50 transition-colors flex items-center gap-3"
                      >
                        <span className={clsx("text-[11px] font-semibold px-2 py-0.5 rounded-md border tabular-nums flex-shrink-0", GROUP_META[g].cls)}>
                          {formatDue(t.dueDate)}
                        </span>
                        <span className="flex-1 min-w-0">
                          <span className="block text-sm font-medium text-gray-800 truncate">{t.title}</span>
                          {t.project && <span className="block text-[11px] text-gray-400 truncate">{t.project.name}</span>}
                        </span>
                        <span className="hidden sm:flex items-center gap-1.5 flex-shrink-0">
                          <PriorityBadge priority={t.priority} />
                          <StatusBadge status={t.status} />
                        </span>
                      </button>
                    </li>
                  ))}
                </ul>
              </div>
            );
          })}
        </div>
      )}
    </Panel>
  );
}

// ── Akıllı Takvim (B bloğu) ──────────────────────────────────────────────────

export function CalendarPlaceholder() {
  return (
    <Panel title="Akıllı Takvim" subtitle="Görevler, onaylı izinler ve resmî tatiller">
      <div className="px-5 py-10 text-center">
        <p className="text-sm text-gray-400">Akıllı Takvim bir sonraki güncellemede bu alana eklenecek.</p>
      </div>
    </Panel>
  );
}

// ── Görev Dağılımı ───────────────────────────────────────────────────────────

export function TaskDistribution({ data }: { data: DashboardSummaryDTO }) {
  const total = data.distribution.reduce((a, d) => a + d.count, 0);
  return (
    <Panel title="Görev Dağılımı" subtitle={`Atanan ${total} görev`}>
      {total > 0 && (
        <div className="px-5 pt-4">
          <div className="flex rounded-full overflow-hidden h-2.5 bg-gray-100">
            {data.distribution.map((d) => {
              const def = BOARD_COLUMN_DEFS.find((c) => c.id === d.status)!;
              return d.count > 0 ? (
                <div key={d.status} className="h-full" style={{ width: `${(d.count / total) * 100}%`, backgroundColor: def.color }} />
              ) : null;
            })}
          </div>
        </div>
      )}
      <ul className="p-3 grid grid-cols-2 gap-2">
        {data.distribution.map((d) => {
          const def = BOARD_COLUMN_DEFS.find((c) => c.id === d.status)!;
          return (
            <li key={d.status}>
              <Link href={d.href} className="block rounded-xl px-3 py-2.5 hover:ring-1 hover:ring-gray-200 transition" style={{ backgroundColor: def.bg }}>
                <p className="text-xl font-bold tabular-nums" style={{ color: def.color }}>{d.count}</p>
                <p className="text-[11px] font-medium text-gray-500">{def.label}</p>
              </Link>
            </li>
          );
        })}
      </ul>
    </Panel>
  );
}

// ── Öne Çıkan Projeler ───────────────────────────────────────────────────────

export function FeaturedProjects({ data }: { data: DashboardSummaryDTO }) {
  const { items, total, href } = data.projects;
  return (
    <Panel
      title="Öne Çıkan Projeler"
      subtitle="Dikkat gerektiren aktif projeler"
      action={total > 0 ? <SeeAll href={href} label={`Tüm Projeleri Gör (${total})`} /> : undefined}
    >
      {items.length === 0 ? (
        <p className="px-5 py-8 text-sm text-gray-400 text-center">Dikkat gerektiren aktif proje bulunmuyor.</p>
      ) : (
        <ul className="p-3 grid grid-cols-1 md:grid-cols-2 gap-2.5">
          {items.map((p) => (
            <li key={p.id}>
              <Link
                href={p.href}
                className={clsx(
                  "block rounded-xl border px-4 py-3 hover:border-[#F57C28] hover:shadow-sm transition-all",
                  p.overdueCount > 0 ? "border-red-200" : "border-gray-100"
                )}
              >
                <p className="text-sm font-semibold text-gray-800 truncate">{p.name}</p>
                <div className="mt-1.5 flex items-center gap-3 flex-wrap text-xs">
                  {p.overdueCount > 0 && <span className="font-semibold text-red-600">{p.overdueCount} gecikmiş</span>}
                  <span className="text-gray-600">{p.openCount} açık görev</span>
                  {p.nextDueDate && <span className="text-gray-400">Yaklaşan: {formatDue(p.nextDueDate)}</span>}
                </div>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </Panel>
  );
}

// ── Yükleniyor ───────────────────────────────────────────────────────────────

export function DashboardSkeleton() {
  return (
    <div className="space-y-4" aria-busy="true" aria-label="Dashboard yükleniyor">
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
        {[0, 1, 2, 3].map((i) => (
          <div key={i} className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5 h-32 animate-pulse">
            <div className="h-3 bg-gray-100 rounded w-1/2 mb-4" />
            <div className="h-8 bg-gray-100 rounded w-1/4" />
          </div>
        ))}
      </div>
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <div className="lg:col-span-2 bg-white rounded-2xl border border-gray-100 shadow-sm h-72 animate-pulse" />
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm h-72 animate-pulse" />
      </div>
    </div>
  );
}
