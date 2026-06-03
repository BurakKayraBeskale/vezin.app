"use client";

import { useState, useEffect, useCallback } from "react";

const MODULE_LABELS: Record<string, string> = {
  BEYANNAME:       "Beyanname Analizi",
  TXT_EXCEL:       "TXT → Excel (Mizan)",
  KARSILASTIRMA:   "Excel Karşılaştırma",
  TARAYICI:        "Görsel → Excel",
  METIN_DUZENLEME: "Metin Düzenleme",
  MAIL_TASLAGI:    "Mail Taslağı",
};

const MODULES = Object.keys(MODULE_LABELS);

interface PromptRecord {
  module: string;
  prompt: string;
  isCustom: boolean;
  updatedAt?: string;
  updatedBy?: string;
}

interface ConfirmState {
  open: boolean;
  action: "save" | "reset" | null;
}

function ConfirmModal({
  action,
  onConfirm,
  onCancel,
}: {
  action: "save" | "reset";
  onConfirm: () => void;
  onCancel: () => void;
}) {
  const isSave = action === "save";
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div className="absolute inset-0 bg-black/40" onClick={onCancel} />
      <div className="relative bg-white dark:bg-[#1e1e30] rounded-2xl shadow-2xl p-6 w-full max-w-sm mx-4 border border-gray-200 dark:border-white/10">
        <div className="flex items-start gap-3 mb-4">
          <div className={`w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0 ${isSave ? "bg-[#F57C28]/10" : "bg-red-500/10"}`}>
            {isSave ? (
              <svg className="w-5 h-5 text-[#F57C28]" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M8 7H5a2 2 0 00-2 2v9a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-3m-1 4l-3 3m0 0l-3-3m3 3V4" />
              </svg>
            ) : (
              <svg className="w-5 h-5 text-red-500" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126zM12 15.75h.007v.008H12v-.008z" />
              </svg>
            )}
          </div>
          <div>
            <h3 className="text-sm font-semibold text-gray-800 dark:text-white">
              {isSave ? "Promptu kaydet" : "Varsayılana sıfırla"}
            </h3>
            <p className="text-xs text-gray-500 dark:text-white/50 mt-1">
              {isSave
                ? "Bu modül için promptu güncellemek istediğinize emin misiniz?"
                : "Bu modülün promptunu varsayılana sıfırlamak istediğinize emin misiniz? Bu işlem geri alınamaz."}
            </p>
          </div>
        </div>
        <div className="flex gap-2 justify-end">
          <button
            onClick={onCancel}
            className="px-4 py-2 rounded-lg text-sm text-gray-600 hover:text-gray-800 dark:text-white/60 dark:hover:text-white bg-gray-100 dark:bg-white/10 hover:bg-gray-200 dark:hover:bg-white/15 transition-colors"
          >
            İptal
          </button>
          <button
            onClick={onConfirm}
            className={`px-4 py-2 rounded-lg text-sm text-white font-medium transition-colors ${isSave ? "bg-[#F57C28] hover:bg-[#e06b1a]" : "bg-red-500 hover:bg-red-600"}`}
          >
            {isSave ? "Evet, kaydet" : "Evet, sıfırla"}
          </button>
        </div>
      </div>
    </div>
  );
}

export default function AiManager() {
  const [prompts, setPrompts] = useState<Record<string, PromptRecord>>({});
  const [selected, setSelected] = useState<string>(MODULES[0]);
  const [editValue, setEditValue] = useState("");
  const [saving, setSaving] = useState(false);
  const [resetting, setResetting] = useState(false);
  const [saveMsg, setSaveMsg] = useState<{ type: "ok" | "err"; text: string } | null>(null);
  const [confirm, setConfirm] = useState<ConfirmState>({ open: false, action: null });

  const fetchPrompts = useCallback(async () => {
    try {
      const res = await fetch("/api/admin/ai-prompts");
      if (!res.ok) return;
      const data: PromptRecord[] = await res.json();
      const map: Record<string, PromptRecord> = {};
      data.forEach((p) => (map[p.module] = p));
      setPrompts(map);
    } catch {}
  }, []);

  useEffect(() => {
    fetchPrompts();
  }, [fetchPrompts]);

  useEffect(() => {
    if (prompts[selected]) {
      setEditValue(prompts[selected].prompt);
    }
    setSaveMsg(null);
  }, [selected, prompts]);

  async function doSave() {
    setSaving(true);
    setSaveMsg(null);
    try {
      const res = await fetch(`/api/admin/ai-prompts/${selected}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ prompt: editValue }),
      });
      if (!res.ok) throw new Error("Kayıt başarısız");
      await fetchPrompts();
      setSaveMsg({ type: "ok", text: "Prompt kaydedildi." });
    } catch {
      setSaveMsg({ type: "err", text: "Kayıt sırasında hata oluştu." });
    } finally {
      setSaving(false);
    }
  }

  async function doReset() {
    setResetting(true);
    setSaveMsg(null);
    try {
      const res = await fetch(`/api/admin/ai-prompts/${selected}`, { method: "DELETE" });
      if (!res.ok) throw new Error("Sıfırlama başarısız");
      await fetchPrompts();
      setSaveMsg({ type: "ok", text: "Varsayılan prompta sıfırlandı." });
    } catch {
      setSaveMsg({ type: "err", text: "Sıfırlama sırasında hata oluştu." });
    } finally {
      setResetting(false);
    }
  }

  function handleConfirm() {
    const action = confirm.action;
    setConfirm({ open: false, action: null });
    if (action === "save") doSave();
    else if (action === "reset") doReset();
  }

  const current = prompts[selected];

  return (
    <>
      {confirm.open && confirm.action && (
        <ConfirmModal
          action={confirm.action}
          onConfirm={handleConfirm}
          onCancel={() => setConfirm({ open: false, action: null })}
        />
      )}

      <div className="flex gap-6 h-[calc(100vh-8rem)] min-h-0">
        {/* Sol panel — modül listesi */}
        <div className="w-56 flex-shrink-0 flex flex-col gap-1">
          <p className="text-xs font-semibold text-gray-400 uppercase tracking-widest mb-2 px-1">Modüller</p>
          {MODULES.map((mod) => {
            const p = prompts[mod];
            return (
              <button
                key={mod}
                onClick={() => setSelected(mod)}
                className={`flex items-center gap-2 px-3 py-2.5 rounded-lg text-left text-sm transition-colors ${
                  selected === mod
                    ? "bg-[#F57C28] text-white shadow-md shadow-[#F57C28]/20"
                    : "text-gray-600 hover:text-gray-900 hover:bg-gray-100"
                }`}
              >
                <span className="flex-1 font-medium">{MODULE_LABELS[mod]}</span>
                {p?.isCustom && (
                  <span className="text-[10px] bg-orange-100 text-orange-600 rounded px-1.5 py-0.5 font-semibold">
                    Özel
                  </span>
                )}
              </button>
            );
          })}
        </div>

        {/* Sağ panel — düzenleyici */}
        <div className="flex-1 flex flex-col min-w-0 gap-4 overflow-hidden">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-gray-800 font-semibold text-base">{MODULE_LABELS[selected]}</h2>
              {current?.isCustom && current.updatedAt && (
                <p className="text-xs text-gray-400 mt-0.5">
                  Son güncelleme: {new Date(current.updatedAt).toLocaleString("tr-TR")}
                  {current.updatedBy && ` · ${current.updatedBy}`}
                </p>
              )}
            </div>
            <div className="flex gap-2">
              {current?.isCustom && (
                <button
                  onClick={() => setConfirm({ open: true, action: "reset" })}
                  disabled={resetting}
                  className="px-3 py-1.5 rounded-lg text-sm bg-gray-100 hover:bg-gray-200 text-gray-600 hover:text-gray-900 transition-colors disabled:opacity-50"
                >
                  {resetting ? "Sıfırlanıyor..." : "Varsayılana Sıfırla"}
                </button>
              )}
              <button
                onClick={() => setConfirm({ open: true, action: "save" })}
                disabled={saving}
                className="px-4 py-1.5 rounded-lg text-sm bg-[#F57C28] hover:bg-[#e06b1a] text-white font-medium transition-colors disabled:opacity-50"
              >
                {saving ? "Kaydediliyor..." : "Kaydet"}
              </button>
            </div>
          </div>

          {saveMsg && (
            <div
              className={`text-sm px-3 py-2 rounded-lg ${
                saveMsg.type === "ok"
                  ? "bg-green-500/15 text-green-400"
                  : "bg-red-500/15 text-red-400"
              }`}
            >
              {saveMsg.text}
            </div>
          )}

          <textarea
            value={editValue}
            onChange={(e) => setEditValue(e.target.value)}
            className="flex-1 border border-gray-200 rounded-xl p-4 text-sm font-mono resize-none focus:outline-none focus:border-[#F57C28] min-h-0"
            style={{ background: "#fff", color: "#111" }}
            placeholder="Prompt içeriği..."
            spellCheck={false}
          />
        </div>
      </div>
    </>
  );
}
