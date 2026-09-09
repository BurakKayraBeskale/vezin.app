"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

/**
 * Proje yaşam döngüsü aksiyonları.
 *
 * Durum → Gösterilen aksiyonlar:
 *   ACTIVE   → "Projeyi Tamamla"
 *   DONE     → "Yeniden Aç" | "Arşivle"
 *   ARCHIVED → "Geri Yükle" | "Sil"
 *   DELETED  → (hiçbir aksiyon)
 */
export default function ProjeAksiyonlar({
  projectId,
  status,
}: {
  projectId: string;
  status: string;
}) {
  const router = useRouter();
  const [loading, setLoading] = useState<string | null>(null);
  const [error, setError] = useState("");

  async function doAction(action: string) {
    setLoading(action);
    setError("");
    try {
      const res = await fetch(`/api/projects/${projectId}/status`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || "İşlem başarısız");
        return;
      }
      router.refresh();
    } finally {
      setLoading(null);
    }
  }

  if (status === "DELETED") return null;

  const btn = (
    action: string,
    label: string,
    variant: "orange" | "gray" | "red" | "green",
    confirmMsg?: string
  ) => {
    const colors = {
      orange: "bg-[#F57C28] text-white hover:bg-[#e06d1f]",
      gray:   "bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-600",
      red:    "bg-red-50 dark:bg-red-900/20 text-red-700 dark:text-red-400 hover:bg-red-100 dark:hover:bg-red-900/30 border border-red-200 dark:border-red-800",
      green:  "bg-green-50 dark:bg-green-900/20 text-green-700 dark:text-green-400 hover:bg-green-100 dark:hover:bg-green-900/30 border border-green-200 dark:border-green-800",
    };
    return (
      <button
        onClick={async () => {
          if (confirmMsg && !window.confirm(confirmMsg)) return;
          await doAction(action);
        }}
        disabled={loading !== null}
        className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors disabled:opacity-50 ${colors[variant]}`}
      >
        {loading === action ? "..." : label}
      </button>
    );
  };

  return (
    <div className="flex flex-col items-end gap-2">
      {error && (
        <p className="text-xs text-red-500 max-w-[240px] text-right">{error}</p>
      )}
      <div className="flex flex-wrap gap-2 justify-end">
        {status === "ACTIVE" && btn("complete", "Projeyi Tamamla", "green",
          "Projeyi tamamlamak istediğinizden emin misiniz? Tüm görevlerin tamamlanmış olması gerekir.")}

        {status === "DONE" && (
          <>
            {btn("reopen", "Yeniden Aç", "gray")}
            {btn("archive", "Arşivle", "orange",
              "Projeyi arşivlemek istediğinizden emin misiniz?")}
          </>
        )}

        {status === "ARCHIVED" && (
          <>
            {btn("restore", "Geri Yükle", "gray")}
            {btn("delete", "Sil", "red",
              "Projeyi silmek istediğinizden emin misiniz? Bu işlem geri alınamaz.")}
          </>
        )}
      </div>
    </div>
  );
}
