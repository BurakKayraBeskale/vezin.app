"use client";

import { useEffect, useState } from "react";
import { useSession } from "next-auth/react";
import { useRouter } from "next/navigation";
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  LineChart, Line, Legend,
} from "recharts";

interface DeptStat {
  dept: string; label: string; todo: number; inProgress: number; review: number; done: number; overdue: number;
}
interface PersonStat {
  userId: string; name: string; dept: string;
  todo: number; inProgress: number; review: number; done: number; overdue: number;
  completedThisPeriod: number; avgDurationMinutes: number | null;
}
interface LeaveStat {
  userId: string; name: string; dept: string;
  totalDays: number; usedDays: number; remainingDays: number;
}
interface WeekPoint { week: string; tamamlanan: number; ortalamaDk: number; }

interface ReportData {
  departmentStats: DeptStat[];
  personStats: PersonStat[];
  leaveStats: LeaveStat[];
  weeklyChart: WeekPoint[];
  period: string;
}

const CustomTooltip = ({ active, payload, label }: any) => {
  if (!active || !payload?.length) return null;
  return (
    <div className="bg-white border border-gray-200 rounded-xl shadow-lg p-3 text-sm">
      <p className="font-semibold text-gray-700 mb-1.5">{label}</p>
      {payload.map((e: any) => (
        <div key={e.name} className="flex items-center gap-2 mb-0.5">
          <span className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: e.color }} />
          <span className="text-gray-500">{e.name}:</span>
          <span className="font-bold text-gray-800">{e.value}</span>
        </div>
      ))}
    </div>
  );
};

function fmtDuration(minutes: number | null) {
  if (!minutes) return "—";
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  if (h === 0) return `${m} dk`;
  if (m === 0) return `${h} sa`;
  return `${h} sa ${m} dk`;
}

export default function ReportsPage() {
  const { data: session, status } = useSession();
  const router = useRouter();
  const [period, setPeriod] = useState<"weekly" | "monthly">("monthly");
  const [data, setData] = useState<ReportData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (status === "loading") return;
    const role = (session?.user as any)?.role;
    if (role !== "ADMIN") { router.replace("/"); return; }
    setLoading(true);
    fetch(`/api/reports?period=${period}`)
      .then((r) => r.json())
      .then((d) => { setData(d); setLoading(false); });
  }, [period, session, status]);

  if (loading) {
    return (
      <div className="max-w-6xl mx-auto space-y-6">
        <div className="h-8 bg-white rounded-xl animate-pulse w-48" />
        {[...Array(3)].map((_, i) => (
          <div key={i} className="bg-white rounded-2xl border border-gray-100 shadow-sm h-64 animate-pulse" />
        ))}
      </div>
    );
  }

  if (!data) return null;

  return (
    <div className="max-w-6xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold text-gray-800">Raporlar</h1>
          <p className="text-sm text-gray-400 mt-1">Departman ve kişi bazlı performans analizi</p>
        </div>
        <div className="flex gap-2">
          {(["weekly", "monthly"] as const).map((p) => (
            <button
              key={p}
              onClick={() => setPeriod(p)}
              className={`px-4 py-2 rounded-xl text-sm font-semibold border transition-all ${
                period === p
                  ? "border-[#F57C28] bg-[#FFF3E9] text-[#F57C28]"
                  : "border-gray-200 bg-white text-gray-500 hover:border-gray-300"
              }`}
            >
              {p === "weekly" ? "Bu Hafta" : "Bu Ay"}
            </button>
          ))}
        </div>
      </div>

      {/* 1. Departman bazlı görev dağılımı */}
      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6">
        <h2 className="text-base font-bold text-gray-800 mb-1">Departman Bazlı Görev Dağılımı</h2>
        <p className="text-xs text-gray-400 mb-5">Her departmandaki görev durumları</p>
        <ResponsiveContainer width="100%" height={240}>
          <BarChart data={data.departmentStats} margin={{ top: 4, right: 8, left: -22, bottom: 0 }} barSize={16}>
            <CartesianGrid strokeDasharray="3 3" stroke="#F3F4F6" vertical={false} />
            <XAxis dataKey="label" tick={{ fontSize: 11, fill: "#9CA3AF" }} axisLine={false} tickLine={false} />
            <YAxis tick={{ fontSize: 11, fill: "#9CA3AF" }} axisLine={false} tickLine={false} allowDecimals={false} />
            <Tooltip content={<CustomTooltip />} />
            <Legend iconType="circle" iconSize={8} wrapperStyle={{ fontSize: 11, paddingTop: 12 }} />
            <Bar dataKey="todo"       name="Yapılacak"    fill="#9CA3AF" radius={[4,4,0,0]} />
            <Bar dataKey="inProgress" name="Devam Eden"   fill="#F57C28" radius={[4,4,0,0]} />
            <Bar dataKey="review"     name="İncelemede"   fill="#6366F1" radius={[4,4,0,0]} />
            <Bar dataKey="done"       name="Tamamlandı"   fill="#10B981" radius={[4,4,0,0]} />
            <Bar dataKey="overdue"    name="Geciken"      fill="#EF4444" radius={[4,4,0,0]} />
          </BarChart>
        </ResponsiveContainer>
      </div>

      {/* 2. Haftalık tamamlanma trendi */}
      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6">
        <h2 className="text-base font-bold text-gray-800 mb-1">Haftalık Tamamlanma Trendi</h2>
        <p className="text-xs text-gray-400 mb-5">Son 7 haftada tamamlanan görev sayısı ve ortalama süre (dk)</p>
        <ResponsiveContainer width="100%" height={220}>
          <LineChart data={data.weeklyChart} margin={{ top: 4, right: 8, left: -22, bottom: 0 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#F3F4F6" vertical={false} />
            <XAxis dataKey="week" tick={{ fontSize: 11, fill: "#9CA3AF" }} axisLine={false} tickLine={false} />
            <YAxis tick={{ fontSize: 11, fill: "#9CA3AF" }} axisLine={false} tickLine={false} allowDecimals={false} />
            <Tooltip content={<CustomTooltip />} />
            <Legend iconType="circle" iconSize={8} wrapperStyle={{ fontSize: 11, paddingTop: 12 }} />
            <Line type="monotone" dataKey="tamamlanan"  name="Tamamlanan"    stroke="#10B981" strokeWidth={2.5} dot={{ r: 3.5, fill: "#10B981", strokeWidth: 0 }} activeDot={{ r: 5 }} />
            <Line type="monotone" dataKey="ortalamaDk"  name="Ort. Süre (dk)" stroke="#6366F1" strokeWidth={2.5} dot={{ r: 3.5, fill: "#6366F1", strokeWidth: 0 }} activeDot={{ r: 5 }} strokeDasharray="5 4" />
          </LineChart>
        </ResponsiveContainer>
      </div>

      {/* 3. Kişi bazlı performans */}
      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm">
        <div className="px-6 py-4 border-b border-gray-100">
          <h2 className="text-base font-bold text-gray-800">Kişi Bazlı Performans</h2>
          <p className="text-xs text-gray-400 mt-0.5">{period === "weekly" ? "Bu hafta" : "Bu ay"} tamamlanan görevler</p>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[640px]">
            <thead className="bg-gray-50 border-b border-gray-100">
              <tr>
                {["Kişi", "Departman", "Aktif", "Tamamlanan", "Geciken", "Dönem Kapanan", "Ort. Süre"].map((h) => (
                  <th key={h} className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide whitespace-nowrap">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {data.personStats.length === 0 ? (
                <tr><td colSpan={7} className="py-10 text-center text-gray-400 text-sm">Veri yok</td></tr>
              ) : (
                data.personStats
                  .sort((a, b) => b.done - a.done)
                  .map((p) => (
                    <tr key={p.userId} className="hover:bg-gray-50/50 transition-colors">
                      <td className="px-4 py-3.5">
                        <div className="flex items-center gap-2">
                          <div className="w-7 h-7 rounded-full bg-[#F57C28] flex items-center justify-center text-white text-[10px] font-bold flex-shrink-0">
                            {p.name.split(" ").map((n) => n[0]).join("").slice(0, 2).toUpperCase()}
                          </div>
                          <span className="text-sm font-medium text-gray-800">{p.name}</span>
                        </div>
                      </td>
                      <td className="px-4 py-3.5 text-xs text-gray-500">{p.dept}</td>
                      <td className="px-4 py-3.5">
                        <span className="text-sm font-semibold text-orange-500">{p.inProgress + p.review}</span>
                      </td>
                      <td className="px-4 py-3.5">
                        <span className="text-sm font-semibold text-emerald-600">{p.done}</span>
                      </td>
                      <td className="px-4 py-3.5">
                        <span className={`text-sm font-semibold ${p.overdue > 0 ? "text-red-500" : "text-gray-400"}`}>{p.overdue}</span>
                      </td>
                      <td className="px-4 py-3.5">
                        <span className="text-sm font-bold text-indigo-600">{p.completedThisPeriod}</span>
                      </td>
                      <td className="px-4 py-3.5 text-sm text-gray-500">{fmtDuration(p.avgDurationMinutes)}</td>
                    </tr>
                  ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* 4. İzin kullanım özeti */}
      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm">
        <div className="px-6 py-4 border-b border-gray-100">
          <h2 className="text-base font-bold text-gray-800">İzin Kullanım Özeti</h2>
          <p className="text-xs text-gray-400 mt-0.5">{new Date().getFullYear()} yılı yıllık izin</p>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[480px]">
            <thead className="bg-gray-50 border-b border-gray-100">
              <tr>
                {["Kişi", "Departman", "Toplam", "Kullanılan", "Kalan", "Kullanım %"].map((h) => (
                  <th key={h} className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide whitespace-nowrap">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {data.leaveStats.length === 0 ? (
                <tr><td colSpan={6} className="py-10 text-center text-gray-400 text-sm">İzin verisi yok</td></tr>
              ) : (
                data.leaveStats
                  .sort((a, b) => b.usedDays - a.usedDays)
                  .map((l) => {
                    const pct = l.totalDays > 0 ? Math.round((l.usedDays / l.totalDays) * 100) : 0;
                    return (
                      <tr key={l.userId} className="hover:bg-gray-50/50 transition-colors">
                        <td className="px-4 py-3.5">
                          <div className="flex items-center gap-2">
                            <div className="w-7 h-7 rounded-full bg-indigo-100 flex items-center justify-center text-indigo-600 text-[10px] font-bold flex-shrink-0">
                              {l.name.split(" ").map((n) => n[0]).join("").slice(0, 2).toUpperCase()}
                            </div>
                            <span className="text-sm font-medium text-gray-800">{l.name}</span>
                          </div>
                        </td>
                        <td className="px-4 py-3.5 text-xs text-gray-500">{l.dept}</td>
                        <td className="px-4 py-3.5 text-sm text-gray-600">{l.totalDays}</td>
                        <td className="px-4 py-3.5 text-sm font-semibold text-orange-500">{l.usedDays}</td>
                        <td className="px-4 py-3.5 text-sm font-semibold text-emerald-600">{l.remainingDays}</td>
                        <td className="px-4 py-3.5">
                          <div className="flex items-center gap-2">
                            <div className="flex-1 h-1.5 bg-gray-100 rounded-full overflow-hidden min-w-[60px]">
                              <div className="h-full bg-[#F57C28] rounded-full" style={{ width: `${pct}%` }} />
                            </div>
                            <span className="text-xs text-gray-500 w-8 text-right">{pct}%</span>
                          </div>
                        </td>
                      </tr>
                    );
                  })
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
