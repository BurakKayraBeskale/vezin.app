import Link from "next/link";

interface Props {
  title: string;
  value: number;
  icon: React.ReactNode;
  accentColor: string;
  bgColor: string;
  sub: string;
  /** delta: geçen haftaya göre fark. higherIsBetter: true ise artış yeşil, false ise azalış yeşil */
  trend?: { delta: number; higherIsBetter: boolean };
  /** verilirse kart tıklanabilir/link olur (klavye erişilebilir, focus halkalı) */
  href?: string;
  /** ekran okuyucular için anlamlı etiket — verilmezse title kullanılır */
  ariaLabel?: string;
}

export default function MetricCard({ title, value, icon, accentColor, bgColor, sub, trend, href, ariaLabel }: Props) {
  const showTrend = trend && trend.delta !== 0;
  const isGood = showTrend
    ? trend!.higherIsBetter ? trend!.delta > 0 : trend!.delta < 0
    : false;

  const content = (
    <>
      <div className="flex items-center justify-between mb-4">
        <p className="text-sm font-medium text-gray-500">{title}</p>
        <div
          className="w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0"
          style={{ backgroundColor: bgColor }}
        >
          <span style={{ color: accentColor }}>{icon}</span>
        </div>
      </div>
      <p className="text-3xl font-bold text-gray-800">{value}</p>
      <div className="flex items-center gap-2 mt-1">
        <p className="text-xs text-gray-400 flex-1">{sub}</p>
        {showTrend && (
          <span
            className={`text-[11px] font-semibold flex items-center gap-0.5 flex-shrink-0 ${
              isGood ? "text-emerald-500" : "text-red-500"
            }`}
          >
            {trend!.delta > 0 ? "↑" : "↓"}
            {Math.abs(trend!.delta)} geçen haftaya göre
          </span>
        )}
      </div>
    </>
  );

  if (href) {
    return (
      <Link
        href={href}
        aria-label={ariaLabel ?? title}
        className="block text-left bg-white rounded-2xl border border-gray-100 shadow-sm p-5 transition-all hover:shadow-md hover:border-gray-200 hover:-translate-y-0.5 cursor-pointer focus:outline-none focus-visible:ring-2 focus-visible:ring-[#F57C28] focus-visible:ring-offset-2"
      >
        {content}
      </Link>
    );
  }

  return (
    <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5 hover:shadow-md transition-shadow">
      {content}
    </div>
  );
}
