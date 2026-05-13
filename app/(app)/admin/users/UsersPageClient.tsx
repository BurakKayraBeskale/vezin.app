"use client";

import { useState } from "react";
import clsx from "clsx";
import UserTable from "@/components/UserTable";
import OrgChart, { OrgUser } from "@/components/OrgChart";
import OrgEditor from "@/components/OrgEditor";

type Tab = "liste" | "org";
type OrgView = "schema" | "edit";

const DEPT_OPTIONS = [
  { value: "ALL",                  label: "Tüm Departmanlar" },
  { value: "ADMIN",                label: "Yönetim" },
  { value: "MUHASEBE",             label: "Muhasebe" },
  { value: "BAGIMSIZ_DENETIM",     label: "Bağımsız Denetim" },
  { value: "YEMINLI_MALI_MUSAVIR", label: "YMM" },
  { value: "OUTSOURCE",            label: "Outsource" },
];

interface Props {
  initialUsers: OrgUser[];
  currentUserId: string;
}

export default function UsersPageClient({ initialUsers, currentUserId }: Props) {
  const [tab, setTab] = useState<Tab>("liste");
  const [orgDept, setOrgDept] = useState<string>("ALL");
  const [orgView, setOrgView] = useState<OrgView>("schema");

  const filteredForOrg =
    orgDept === "ALL"
      ? initialUsers
      : initialUsers.filter((u) => u.department === orgDept);

  return (
    <div>
      {/* Tab bar */}
      <div className="flex border-b border-gray-100 mb-6 overflow-x-auto">
        <button
          onClick={() => setTab("liste")}
          className={clsx(
            "flex items-center gap-2 px-4 py-3 text-sm font-medium border-b-2 transition-colors -mb-px whitespace-nowrap",
            tab === "liste"
              ? "border-[#F57C28] text-[#F57C28]"
              : "border-transparent text-gray-500 hover:text-gray-700"
          )}
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M4 6h16M4 10h16M4 14h16M4 18h16" />
          </svg>
          Kullanıcı Listesi
        </button>
        <button
          onClick={() => setTab("org")}
          className={clsx(
            "flex items-center gap-2 px-4 py-3 text-sm font-medium border-b-2 transition-colors -mb-px whitespace-nowrap",
            tab === "org"
              ? "border-[#F57C28] text-[#F57C28]"
              : "border-transparent text-gray-500 hover:text-gray-700"
          )}
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
          </svg>
          Organizasyon Şeması
        </button>
      </div>

      {tab === "liste" && (
        <UserTable initialUsers={initialUsers} currentUserId={currentUserId} />
      )}

      {tab === "org" && (
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6">
          {/* Toolbar: departman filtresi + görünüm toggle */}
          <div className="flex items-center justify-between gap-3 mb-5 flex-wrap">
            <div className="flex items-center gap-3">
              <label className="text-xs font-semibold text-gray-500">Departman:</label>
              <select
                value={orgDept}
                onChange={(e) => setOrgDept(e.target.value)}
                className="text-xs border border-gray-200 rounded-lg px-2.5 py-1.5 focus:outline-none focus:ring-1 focus:ring-[#F57C28]/30 focus:border-[#F57C28] text-gray-600"
              >
                {DEPT_OPTIONS.map((o) => (
                  <option key={o.value} value={o.value}>{o.label}</option>
                ))}
              </select>
              {orgDept !== "ALL" && (
                <span className="text-xs text-gray-400">{filteredForOrg.length} kişi</span>
              )}
            </div>

            {/* Şema / Düzenle toggle */}
            <div className="flex items-center gap-1 bg-gray-100 rounded-xl p-1">
              <button
                onClick={() => setOrgView("schema")}
                className={clsx(
                  "flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all",
                  orgView === "schema"
                    ? "bg-white text-gray-800 shadow-sm"
                    : "text-gray-500 hover:text-gray-700"
                )}
              >
                <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                  <path strokeLinecap="round" strokeLinejoin="round" d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                </svg>
                Şema
              </button>
              <button
                onClick={() => setOrgView("edit")}
                className={clsx(
                  "flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all",
                  orgView === "edit"
                    ? "bg-white text-[#F57C28] shadow-sm"
                    : "text-gray-500 hover:text-gray-700"
                )}
              >
                <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M7 11.5V14m0-2.5v-6a1.5 1.5 0 113 0m-3 6a1.5 1.5 0 00-3 0v2a7.5 7.5 0 0015 0v-5a1.5 1.5 0 00-3 0m-6-3V11m0-5.5v-1a1.5 1.5 0 013 0v1m0 0V11m0-5.5a1.5 1.5 0 013 0v3m0 0V11" />
                </svg>
                Bağlantı Düzenle
              </button>
            </div>
          </div>

          {orgView === "schema" ? (
            <OrgChart users={filteredForOrg} />
          ) : (
            <OrgEditor users={filteredForOrg} />
          )}
        </div>
      )}
    </div>
  );
}
