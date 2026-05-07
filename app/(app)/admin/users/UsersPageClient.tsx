"use client";

import { useState } from "react";
import clsx from "clsx";
import UserTable from "@/components/UserTable";
import OrgChart, { OrgUser } from "@/components/OrgChart";

type Tab = "liste" | "org";

interface Props {
  initialUsers: OrgUser[];
  currentUserId: string;
}

export default function UsersPageClient({ initialUsers, currentUserId }: Props) {
  const [tab, setTab] = useState<Tab>("liste");

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
          <OrgChart users={initialUsers} />
        </div>
      )}
    </div>
  );
}
