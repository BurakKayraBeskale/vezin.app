"use client";

import { useEffect, useState } from "react";

interface PersonPerf {
  id: string;
  name: string;
  email: string;
  department: string;
  onTime: number;
  late: number;
  total: number;
  pct: number | null;
}

const DEPT_LABELS: Record<string, string> = {
  BAGIMSIZ_DENETIM:     "Bağımsız Denetim",
  YEMINLI_MALI_MUSAVIR: "YMM",
};

function pctColor(pct: number): string {
  if (pct >= 80) return "text-emerald-600";
  if (pct >= 50) return "text-amber-500";
  return "text-red-500";
}

export default function PerformancePanel() {
  const [data, setData] = useState<PersonPerf[] | null>(null);

  useEffect(() => {
    fetch("/api/performance")
      .then((r) => {
        if (!r.ok) throw new Error();
        return r.json();
      })
      .then(setData)
      .catch(() => setData([]));
  }, []);

  // Yükleniyor
  if (data === null) {
    return (
      <div className="mt-6 bg-white rounded-2xl border border-gray-100 shadow-sm p-6 animate-pulse">
        <div className="h-4 bg-gray-100 rounded w-48 mb-4" />
        <div className="space-y-3">
          {[...Array(4)].map((_, i) => (
            <div key={i} className="h-10 bg-gray-50 rounded" />
          ))}
        </div>
      </div>
    );
  }

  // Hata veya boş liste — sessizce gizle
  if (data.length === 0) return null;

  return (
    <div className="mt-6 bg-white rounded-2xl border border-gray-100 shadow-sm p-6">
      <h2 className="text-sm font-bold text-gray-700 mb-4 flex items-center gap-2">
        <svg className="w-4 h-4 text-[#F57C28]" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
        </svg>
        Personel Başarı Oranı
      </h2>
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="text-left text-xs text-gray-400 border-b border-gray-100">
              <th className="pb-2 font-semibold pr-4">Personel</th>
              <th className="pb-2 font-semibold pr-4">Departman</th>
              <th className="pb-2 font-semibold text-right">Başarı Oranı</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-50">
            {data.map((p) => (
              <tr key={p.id}>
                <td className="py-2.5 font-medium text-gray-800 pr-4">{p.name}</td>
                <td className="py-2.5 text-gray-400 text-xs pr-4">
                  {DEPT_LABELS[p.department] ?? p.department}
                </td>
                <td className="py-2.5 text-right">
                  {p.pct === null ? (
                    <span className="text-xs text-gray-300 italic">veri yok</span>
                  ) : (
                    <span className={`text-xs font-semibold ${pctColor(p.pct)}`}>
                      %{p.pct} — {p.onTime}/{p.total}
                    </span>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
