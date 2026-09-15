"use client";

import { useRef } from "react";

export type AttachmentValue =
  | { mode: "none" }
  | { mode: "file"; file: File | null }
  | { mode: "link"; url: string; name: string };

interface Props {
  value: AttachmentValue;
  onChange: (v: AttachmentValue) => void;
  disabled?: boolean;
}

/** submit_review / request_revision modallarında ortak kullanılan opsiyonel ek seçici (dosya VEYA link). */
export default function AttachmentPicker({ value, onChange, disabled }: Props) {
  const fileRef = useRef<HTMLInputElement>(null);

  return (
    <div>
      <label className="block text-sm font-medium text-gray-700 mb-1.5">
        Ek (İsteğe Bağlı)
      </label>
      <div className="flex gap-2 mb-2">
        {(
          [
            { key: "none", label: "Yok" },
            { key: "file", label: "Dosya" },
            { key: "link", label: "OneDrive/SharePoint Linki" },
          ] as const
        ).map((opt) => (
          <button
            key={opt.key}
            type="button"
            disabled={disabled}
            onClick={() => {
              if (opt.key === "none") onChange({ mode: "none" });
              else if (opt.key === "file") onChange({ mode: "file", file: null });
              else onChange({ mode: "link", url: "", name: "" });
            }}
            className={`px-3 py-1.5 rounded-lg text-xs font-semibold border transition-colors disabled:opacity-50 ${
              value.mode === opt.key
                ? "bg-[#F57C28]/10 border-[#F57C28] text-[#F57C28]"
                : "border-gray-200 text-gray-500 hover:bg-gray-50"
            }`}
          >
            {opt.label}
          </button>
        ))}
      </div>

      {value.mode === "file" && (
        <div>
          <label className="flex items-center justify-center gap-1.5 text-xs font-medium px-3 py-2.5 rounded-lg cursor-pointer transition-colors w-full bg-[#F57C28]/10 text-[#F57C28] hover:bg-[#F57C28]/20">
            <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" />
            </svg>
            {value.file ? value.file.name : "Dosya Seç"}
            <input
              ref={fileRef}
              type="file"
              className="hidden"
              disabled={disabled}
              onChange={(e) => onChange({ mode: "file", file: e.target.files?.[0] ?? null })}
            />
          </label>
        </div>
      )}

      {value.mode === "link" && (
        <div className="space-y-2">
          <input
            type="url"
            value={value.url}
            onChange={(e) => onChange({ mode: "link", url: e.target.value, name: value.name })}
            placeholder="https://..."
            disabled={disabled}
            className="w-full px-3.5 py-2.5 rounded-xl border border-gray-200 text-sm text-gray-800 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-[#F57C28]/30 focus:border-[#F57C28]"
          />
          <input
            type="text"
            value={value.name}
            onChange={(e) => onChange({ mode: "link", url: value.url, name: e.target.value })}
            placeholder="Link adı (isteğe bağlı)"
            disabled={disabled}
            className="w-full px-3.5 py-2.5 rounded-xl border border-gray-200 text-sm text-gray-800 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-[#F57C28]/30 focus:border-[#F57C28]"
          />
        </div>
      )}
    </div>
  );
}
