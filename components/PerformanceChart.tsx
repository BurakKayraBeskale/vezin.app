"use client";

import {
  LineChart, Line, XAxis, YAxis, CartesianGrid,
  Tooltip, ResponsiveContainer,
} from "recharts";

interface WeeklyData { week: string; acilan: number; kapanan: number; geciken: number; }

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

export default function PerformanceChart({ data }: { data: WeeklyData[] }) {
  return (
    <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6">
      <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-2 mb-5">
        <div>
          <h2 className="text-base font-bold text-gray-800">Son 7 Haftanın Performansı</h2>
          <p className="text-xs text-gray-400 mt-0.5">Açılan · Kapanan · Geciken işler</p>
        </div>
        <div className="flex items-center gap-3 text-xs text-gray-400 flex-wrap">
          {[["#F57C28","Açılan"],["#10B981","Kapanan"],["#EF4444","Geciken"]].map(([c,l])=>(
            <span key={l} className="flex items-center gap-1">
              <span className="w-3 h-0.5 rounded inline-block" style={{backgroundColor:c}} />{l}
            </span>
          ))}
        </div>
      </div>
      <ResponsiveContainer width="100%" height={230}>
        <LineChart data={data} margin={{ top: 4, right: 8, left: -22, bottom: 0 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="#F3F4F6" vertical={false} />
          <XAxis dataKey="week" tick={{ fontSize: 11, fill: "#9CA3AF" }} axisLine={false} tickLine={false} />
          <YAxis tick={{ fontSize: 11, fill: "#9CA3AF" }} axisLine={false} tickLine={false} allowDecimals={false} />
          <Tooltip content={<CustomTooltip />} />
          <Line type="monotone" dataKey="acilan"  name="Açılan"  stroke="#F57C28" strokeWidth={2.5} dot={{ r: 3.5, fill: "#F57C28", strokeWidth: 0 }} activeDot={{ r: 5 }} />
          <Line type="monotone" dataKey="kapanan" name="Kapanan" stroke="#10B981" strokeWidth={2.5} dot={{ r: 3.5, fill: "#10B981", strokeWidth: 0 }} activeDot={{ r: 5 }} />
          <Line type="monotone" dataKey="geciken" name="Geciken" stroke="#EF4444" strokeWidth={2.5} dot={{ r: 3.5, fill: "#EF4444", strokeWidth: 0 }} activeDot={{ r: 5 }} strokeDasharray="5 4" />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}
