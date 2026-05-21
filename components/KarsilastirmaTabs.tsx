"use client";

import { useState } from "react";
import clsx from "clsx";

const tabs = [
  { id: "donusturucu", label: "Dönüştürücü" },
  { id: "karsilastirma", label: "Karşılaştırma" },
];

function PlaceholderCard({
  title,
  description,
  icon,
}: {
  title: string;
  description: string;
  icon: React.ReactNode;
}) {
  return (
    <div className="rounded-2xl border-2 border-dashed border-gray-200 dark:border-white/10 bg-gray-50 dark:bg-white/[0.03] p-12 flex flex-col items-center justify-center text-center min-h-[360px] gap-6">
      <div className="w-14 h-14 rounded-2xl bg-[#F57C28]/10 flex items-center justify-center">
        {icon}
      </div>
      <div>
        <h2 className="text-lg font-semibold text-gray-700 dark:text-white/70">{title}</h2>
        <p className="mt-2 text-sm text-gray-400 dark:text-white/35 max-w-sm leading-relaxed">
          {description}
        </p>
      </div>
      <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium bg-[#F57C28]/10 text-[#F57C28]">
        <span className="w-1.5 h-1.5 rounded-full bg-[#F57C28] animate-pulse" />
        Yakında Aktif
      </span>
    </div>
  );
}

export default function KarsilastirmaTabs() {
  const [active, setActive] = useState("donusturucu");

  return (
    <div>
      {/* Tab bar */}
      <div className="flex gap-1 p-1 bg-gray-100 dark:bg-white/[0.06] rounded-xl w-fit mb-6">
        {tabs.map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActive(tab.id)}
            className={clsx(
              "px-5 py-2 rounded-lg text-sm font-medium transition-all",
              active === tab.id
                ? "bg-white dark:bg-[#17172A] text-gray-900 dark:text-white shadow-sm"
                : "text-gray-500 dark:text-white/40 hover:text-gray-700 dark:hover:text-white/70"
            )}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* Dönüştürücü */}
      {active === "donusturucu" && (
        <PlaceholderCard
          title="Dönüştürücü"
          description="Dosya ve veri dönüştürme modülü geliştirme aşamasındadır. Yakında bu alandan dönüşüm işlemlerinizi gerçekleştirebileceksiniz."
          icon={
            <svg
              className="w-7 h-7 text-[#F57C28]"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
              strokeWidth={1.5}
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M19.5 12c0-1.232-.046-2.453-.138-3.662a4.006 4.006 0 00-3.7-3.7 48.678 48.678 0 00-7.324 0 4.006 4.006 0 00-3.7 3.7c-.017.22-.032.441-.046.662M19.5 12l3-3m-3 3l-3-3m-12 3c0 1.232.046 2.453.138 3.662a4.006 4.006 0 003.7 3.7 48.656 48.656 0 007.324 0 4.006 4.006 0 003.7-3.7c.017-.22.032-.441.046-.662M4.5 12l3 3m-3-3l-3 3"
              />
            </svg>
          }
        />
      )}

      {/* Karşılaştırma */}
      {active === "karsilastirma" && (
        <PlaceholderCard
          title="Karşılaştırma"
          description="Belge ve veri karşılaştırma modülü geliştirme aşamasındadır. Yakında bu alandan kayıtlarınızı yan yana karşılaştırabileceksiniz."
          icon={
            <svg
              className="w-7 h-7 text-[#F57C28]"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
              strokeWidth={1.5}
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M9 4.5v15m6-15v15m-10.875 0h15.75c.621 0 1.125-.504 1.125-1.125V5.625c0-.621-.504-1.125-1.125-1.125H4.125C3.504 4.5 3 5.004 3 5.625v12.75c0 .621.504 1.125 1.125 1.125z"
              />
            </svg>
          }
        />
      )}
    </div>
  );
}
