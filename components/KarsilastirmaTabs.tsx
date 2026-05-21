"use client";

import { useState } from "react";
import clsx from "clsx";
import TxtToExcelConverter from "@/components/TxtToExcelConverter";
import ExcelComparator from "@/components/ExcelComparator";

const tabs = [
  { id: "donusturucu", label: "Dönüştürücü" },
  { id: "karsilastirma", label: "Karşılaştırma" },
];

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

      {active === "donusturucu" && <TxtToExcelConverter />}
      {active === "karsilastirma" && <ExcelComparator />}
    </div>
  );
}
