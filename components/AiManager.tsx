"use client";

import { useState, useEffect, useCallback } from "react";

const MODULE_LABELS: Record<string, string> = {
  BEYANNAME: "Beyanname Analizi",
  TXT_EXCEL: "TXT → Excel (Mizan)",
  KARSILASTIRMA: "Excel Karşılaştırma",
  TARAYICI: "Görsel → Excel",
};

const MODULES = Object.keys(MODULE_LABELS);

interface PromptRecord {
  module: string;
  prompt: string;
  isCustom: boolean;
  updatedAt?: string;
  updatedBy?: string;
}

export default function AiManager() {
  const [prompts, setPrompts] = useState<Record<string, PromptRecord>>({});
  const [selected, setSelected] = useState<string>(MODULES[0]);
  const [editValue, setEditValue] = useState("");
  const [saving, setSaving] = useState(false);
  const [resetting, setResetting] = useState(false);
  const [saveMsg, setSaveMsg] = useState<{ type: "ok" | "err"; text: string } | null>(null);

  // Test panel state
  const [testInput, setTestInput] = useState("");
  const [testResult, setTestResult] = useState("");
  const [testing, setTesting] = useState(false);
  const [testError, setTestError] = useState("");
  const [showTest, setShowTest] = useState(false);

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
    setTestResult("");
    setTestError("");
  }, [selected, prompts]);

  async function handleSave() {
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

  async function handleReset() {
    if (!confirm("Varsayılan prompta sıfırlamak istediğinize emin misiniz?")) return;
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

  async function handleTest() {
    if (!testInput.trim()) return;
    setTesting(true);
    setTestResult("");
    setTestError("");
    try {
      const res = await fetch("/api/admin/ai-prompts/test", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ prompt: editValue, text: testInput }),
      });
      const data = await res.json();
      if (!res.ok) {
        setTestError(data.error ?? "Test başarısız");
      } else {
        setTestResult(typeof data.result === "string" ? data.result : JSON.stringify(data.result, null, 2));
      }
    } catch {
      setTestError("Test sırasında bir hata oluştu.");
    } finally {
      setTesting(false);
    }
  }

  const current = prompts[selected];

  return (
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
            <button
              onClick={() => setShowTest((v) => !v)}
              className="px-3 py-1.5 rounded-lg text-sm bg-gray-100 hover:bg-gray-200 text-gray-600 hover:text-gray-900 transition-colors"
            >
              {showTest ? "Testi Gizle" : "Test Et"}
            </button>
            {current?.isCustom && (
              <button
                onClick={handleReset}
                disabled={resetting}
                className="px-3 py-1.5 rounded-lg text-sm bg-gray-100 hover:bg-gray-200 text-gray-600 hover:text-gray-900 transition-colors disabled:opacity-50"
              >
                {resetting ? "Sıfırlanıyor..." : "Varsayılana Sıfırla"}
              </button>
            )}
            <button
              onClick={handleSave}
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

        {/* Test paneli */}
        {showTest && (
          <div className="border border-gray-200 rounded-xl p-4 flex flex-col gap-3 bg-gray-50 max-h-72 overflow-y-auto">
            <p className="text-xs font-semibold text-gray-400 uppercase tracking-widest">Test Paneli</p>
            <textarea
              value={testInput}
              onChange={(e) => setTestInput(e.target.value)}
              rows={4}
              className="border border-gray-200 rounded-lg p-3 text-xs font-mono resize-none focus:outline-none focus:border-[#F57C28]"
              style={{ background: "#fff", color: "#111" }}
              placeholder="Buraya test metni girin..."
            />
            <button
              onClick={handleTest}
              disabled={testing || !testInput.trim()}
              className="self-start px-4 py-1.5 rounded-lg text-sm bg-[#F57C28] hover:bg-[#e06b1a] text-white font-medium disabled:opacity-50 transition-colors"
            >
              {testing ? "Test ediliyor..." : "Çalıştır"}
            </button>
            {testError && (
              <p className="text-red-400 text-xs">{testError}</p>
            )}
            {testResult && (
              <pre className="bg-white border border-gray-200 rounded-lg p-3 text-xs text-gray-700 overflow-auto whitespace-pre-wrap">
                {testResult}
              </pre>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
