"use client";

import { useState } from "react";

export default function MailDraftPanel() {
  const [kime, setKime]       = useState("");
  const [konu, setKonu]       = useState("");
  const [kisaNot, setKisaNot] = useState("");
  const [loading, setLoading] = useState(false);
  const [result, setResult]   = useState("");
  const [error, setError]     = useState("");
  const [copied, setCopied]   = useState(false);

  async function handleGenerate() {
    if (!konu.trim()) return;
    setLoading(true);
    setError("");
    setResult("");
    setCopied(false);
    try {
      const res = await fetch("/api/ai/mail-draft", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ konu, not: kisaNot }),
      });
      if (!res.ok) {
        const d = await res.json().catch(() => ({}));
        throw new Error(d.error || "Mail oluşturulamadı");
      }
      const { result: text } = await res.json();
      setResult(text);
    } catch (e: any) {
      setError(e.message || "Hata oluştu");
    } finally {
      setLoading(false);
    }
  }

  async function handleCopy() {
    try {
      await navigator.clipboard.writeText(result);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      /* ignore */
    }
  }

  return (
    <div className="max-w-2xl space-y-5">
      {/* Form kartı */}
      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6 space-y-4">

        {/* Kime */}
        <div>
          <label className="block text-xs font-medium text-gray-500 mb-1.5">
            Kime <span className="text-gray-300">(isteğe bağlı)</span>
          </label>
          <input
            type="text"
            value={kime}
            onChange={(e) => setKime(e.target.value)}
            placeholder="Alıcı adı veya unvanı..."
            className="w-full px-3.5 py-2.5 rounded-xl border border-gray-200 text-sm text-gray-800 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-[#F57C28]/30 focus:border-[#F57C28]"
          />
        </div>

        {/* Konu */}
        <div>
          <label className="block text-xs font-medium text-gray-500 mb-1.5">
            Konu <span className="text-red-400">*</span>
          </label>
          <input
            type="text"
            value={konu}
            onChange={(e) => setKonu(e.target.value)}
            placeholder="Mailin konusu..."
            className="w-full px-3.5 py-2.5 rounded-xl border border-gray-200 text-sm text-gray-800 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-[#F57C28]/30 focus:border-[#F57C28]"
          />
        </div>

        {/* Kısa Not */}
        <div>
          <label className="block text-xs font-medium text-gray-500 mb-1.5">Kısa Not</label>
          <textarea
            rows={3}
            value={kisaNot}
            onChange={(e) => setKisaNot(e.target.value)}
            placeholder="Ne söylemek istediğini birkaç cümleyle yaz..."
            className="w-full px-3.5 py-2.5 rounded-xl border border-gray-200 text-sm text-gray-800 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-[#F57C28]/30 focus:border-[#F57C28] resize-none"
          />
        </div>

        {/* Hata */}
        {error && (
          <div className="flex items-start gap-2 bg-red-50 border border-red-200 text-red-700 text-sm rounded-xl px-4 py-3">
            <svg className="w-4 h-4 flex-shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m9-.75a9 9 0 11-18 0 9 9 0 0118 0zm-9 3.75h.008v.008H12v-.008z" />
            </svg>
            {error}
          </div>
        )}

        {/* Buton */}
        <button
          onClick={handleGenerate}
          disabled={loading || !konu.trim()}
          className="w-full py-3 rounded-xl bg-[#F57C28] hover:bg-[#e06b1a] disabled:opacity-60 text-white text-sm font-semibold transition-colors shadow-md shadow-[#F57C28]/25 flex items-center justify-center gap-2"
        >
          {loading ? (
            <>
              <svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v4l3-3-3-3v4a8 8 0 00-8 8h4l-3 3-3-3h4z" />
              </svg>
              Oluşturuluyor...
            </>
          ) : (
            <>
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M6 12L3.269 3.126A59.768 59.768 0 0121.485 12 59.77 59.77 0 013.27 20.876L5.999 12zm0 0h7.5" />
              </svg>
              Mail Oluştur
            </>
          )}
        </button>
      </div>

      {/* Sonuç */}
      {result && (
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6">
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-sm font-semibold text-gray-800">Oluşturulan Mail</h3>
            <button
              onClick={handleCopy}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors ${
                copied
                  ? "bg-emerald-100 text-emerald-700 border border-emerald-200"
                  : "bg-gray-100 hover:bg-gray-200 text-gray-600 border border-gray-200"
              }`}
            >
              {copied ? (
                <>
                  <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2.5}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                  </svg>
                  Kopyalandı!
                </>
              ) : (
                <>
                  <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
                  </svg>
                  Kopyala
                </>
              )}
            </button>
          </div>
          {kime && (
            <p className="text-xs text-gray-400 mb-3">
              <span className="font-medium text-gray-500">Kime:</span> {kime}
            </p>
          )}
          <pre className="whitespace-pre-wrap text-sm text-gray-700 font-sans leading-relaxed">{result}</pre>
        </div>
      )}
    </div>
  );
}
