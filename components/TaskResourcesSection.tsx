"use client";

import { useRef, useState } from "react";
import { TaskFull, TaskSourceRecord } from "./TaskModal";

type FileRes = TaskFull["files"][number];

interface Props {
  taskId: string;
  files: FileRes[];
  sources: TaskSourceRecord[];
  canManage: boolean;
  onFileAdded: (file: FileRes) => void;
  onSourceAdded: (source: TaskSourceRecord) => void;
}

function fmtDate(d: string) {
  return new Date(d).toLocaleDateString("tr-TR", { day: "numeric", month: "short", year: "numeric" });
}

export default function TaskResourcesSection({
  taskId,
  files,
  sources,
  canManage,
  onFileAdded,
  onSourceAdded,
}: Props) {
  const [showAdd, setShowAdd] = useState(false);
  const [mode, setMode] = useState<"file" | "link">("link");
  const [linkName, setLinkName] = useState("");
  const [linkUrl, setLinkUrl] = useState("");
  const [linkDesc, setLinkDesc] = useState("");
  const [fileComment, setFileComment] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const fileRef = useRef<HTMLInputElement>(null);

  const totalCount = files.length + sources.length;

  async function handleAddLink() {
    if (!linkName.trim() || !linkUrl.trim()) {
      setError("Ad ve URL zorunludur");
      return;
    }
    setSaving(true);
    setError("");
    try {
      const res = await fetch(`/api/tasks/${taskId}/sources`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: linkName.trim(), url: linkUrl.trim(), description: linkDesc.trim() || undefined }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || "Kaynak eklenemedi");
        return;
      }
      onSourceAdded(data);
      setLinkName("");
      setLinkUrl("");
      setLinkDesc("");
      setShowAdd(false);
    } catch {
      setError("Sunucu hatası");
    } finally {
      setSaving(false);
    }
  }

  async function handleAddFile() {
    const file = fileRef.current?.files?.[0];
    if (!file) {
      setError("Dosya seçin");
      return;
    }
    setSaving(true);
    setError("");
    try {
      const fd = new FormData();
      fd.append("file", file);
      if (fileComment.trim()) fd.append("comment", fileComment.trim());
      const res = await fetch(`/api/tasks/${taskId}/files`, { method: "POST", body: fd });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || "Dosya yüklenemedi");
        return;
      }
      onFileAdded(data);
      setFileComment("");
      if (fileRef.current) fileRef.current.value = "";
      setShowAdd(false);
    } catch {
      setError("Sunucu hatası");
    } finally {
      setSaving(false);
    }
  }

  return (
    <section className="px-6 py-4 border-b border-gray-50">
      <div className="flex items-center justify-between mb-2">
        <h3 className="text-[11px] font-semibold text-gray-400 uppercase tracking-wide">
          Kaynaklar {totalCount > 0 && `(${totalCount})`}
        </h3>
        {canManage && !showAdd && (
          <button
            type="button"
            onClick={() => setShowAdd(true)}
            className="text-xs font-semibold text-[#F57C28] hover:text-[#D96A1A] transition-colors"
          >
            + Kaynak Ekle
          </button>
        )}
      </div>

      {showAdd && (
        <div className="mb-3 p-3.5 rounded-xl border border-dashed border-gray-200 bg-gray-50 space-y-2.5">
          <div className="flex gap-2">
            {(
              [
                { key: "link", label: "Link" },
                { key: "file", label: "Dosya" },
              ] as const
            ).map((opt) => (
              <button
                key={opt.key}
                type="button"
                onClick={() => setMode(opt.key)}
                className={`px-3 py-1.5 rounded-lg text-xs font-semibold border transition-colors ${
                  mode === opt.key
                    ? "bg-[#F57C28]/10 border-[#F57C28] text-[#F57C28]"
                    : "border-gray-200 text-gray-500 hover:bg-white"
                }`}
              >
                {opt.label}
              </button>
            ))}
          </div>

          {mode === "link" ? (
            <div className="space-y-2">
              <input
                type="text"
                value={linkName}
                onChange={(e) => setLinkName(e.target.value)}
                placeholder="Kaynak adı"
                className="w-full px-3 py-2 rounded-lg border border-gray-200 text-xs text-gray-700 placeholder-gray-400 bg-white focus:outline-none focus:ring-2 focus:ring-[#F57C28]/30 focus:border-[#F57C28]"
              />
              <input
                type="url"
                value={linkUrl}
                onChange={(e) => setLinkUrl(e.target.value)}
                placeholder="https://..."
                className="w-full px-3 py-2 rounded-lg border border-gray-200 text-xs text-gray-700 placeholder-gray-400 bg-white focus:outline-none focus:ring-2 focus:ring-[#F57C28]/30 focus:border-[#F57C28]"
              />
              <input
                type="text"
                value={linkDesc}
                onChange={(e) => setLinkDesc(e.target.value)}
                placeholder="Açıklama (isteğe bağlı)"
                className="w-full px-3 py-2 rounded-lg border border-gray-200 text-xs text-gray-700 placeholder-gray-400 bg-white focus:outline-none focus:ring-2 focus:ring-[#F57C28]/30 focus:border-[#F57C28]"
              />
            </div>
          ) : (
            <div className="space-y-2">
              <input
                ref={fileRef}
                type="file"
                className="w-full text-xs text-gray-600 file:mr-3 file:py-1.5 file:px-3 file:rounded-lg file:border-0 file:text-xs file:font-semibold file:bg-[#F57C28]/10 file:text-[#F57C28]"
              />
              <input
                type="text"
                value={fileComment}
                onChange={(e) => setFileComment(e.target.value)}
                placeholder="Açıklama (isteğe bağlı)"
                className="w-full px-3 py-2 rounded-lg border border-gray-200 text-xs text-gray-700 placeholder-gray-400 bg-white focus:outline-none focus:ring-2 focus:ring-[#F57C28]/30 focus:border-[#F57C28]"
              />
            </div>
          )}

          {error && <p className="text-xs text-red-500">{error}</p>}

          <div className="flex gap-2">
            <button
              type="button"
              onClick={() => { setShowAdd(false); setError(""); }}
              className="flex-1 px-3 py-2 rounded-lg border border-gray-200 text-xs font-medium text-gray-600 hover:bg-white transition-colors"
            >
              Vazgeç
            </button>
            <button
              type="button"
              onClick={mode === "link" ? handleAddLink : handleAddFile}
              disabled={saving}
              className="flex-1 px-3 py-2 rounded-lg bg-[#F57C28] hover:bg-[#D96A1A] disabled:opacity-60 text-white text-xs font-semibold transition-colors"
            >
              {saving ? "Ekleniyor..." : "Ekle"}
            </button>
          </div>
        </div>
      )}

      {totalCount === 0 ? (
        <p className="text-sm text-gray-400 italic">Henüz kaynak eklenmedi</p>
      ) : (
        <ul className="space-y-2">
          {sources.map((s) => (
            <li key={s.id} className="flex items-center gap-3 p-2.5 rounded-xl border border-gray-100 bg-gray-50">
              <svg className="w-4 h-4 text-indigo-400 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M13.828 10.172a4 4 0 010 5.656l-4 4a4 4 0 01-5.656-5.656l1.172-1.172M10.172 13.828a4 4 0 010-5.656l4-4a4 4 0 015.656 5.656l-1.172 1.172" />
              </svg>
              <div className="flex-1 min-w-0">
                <p className="text-xs font-medium text-gray-700 truncate">{s.name}</p>
                <p className="text-[10px] text-gray-400">
                  {s.addedBy.name} · {fmtDate(s.createdAt)}
                </p>
                {s.description && <p className="text-[10px] text-gray-500 mt-0.5 italic">{s.description}</p>}
              </div>
              {s.url && (
                <a
                  href={s.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex-shrink-0 text-xs text-[#F57C28] hover:text-[#D96A1A] font-medium py-1 px-2 rounded-lg hover:bg-orange-50 transition-colors"
                >
                  Aç ↗
                </a>
              )}
            </li>
          ))}
          {files.map((f) => (
            <li key={f.id} className="flex items-center gap-3 p-2.5 rounded-xl border border-gray-100 bg-gray-50">
              <svg className="w-4 h-4 text-gray-400 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
              </svg>
              <div className="flex-1 min-w-0">
                <p className="text-xs font-medium text-gray-700 truncate">{f.filename}</p>
                <p className="text-[10px] text-gray-400">
                  {f.uploadedBy.name} · {fmtDate(f.createdAt)}
                </p>
                {f.comment && <p className="text-[10px] text-gray-500 mt-0.5 italic">{f.comment}</p>}
                {f.purgedAt && (
                  <p className="text-[10px] text-red-500 mt-0.5">
                    Saklama süresi dolduğu için fiziksel dosya kaldırılmıştır
                  </p>
                )}
              </div>
              {!f.purgedAt && (
                <a
                  href={`/api/files/${f.id}/download`}
                  download={f.filename}
                  className="flex-shrink-0 text-xs text-[#F57C28] hover:text-[#D96A1A] font-medium py-1 px-2 rounded-lg hover:bg-orange-50 transition-colors"
                >
                  İndir
                </a>
              )}
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
