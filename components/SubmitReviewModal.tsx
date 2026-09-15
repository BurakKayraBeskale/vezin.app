"use client";

import { useState } from "react";
import { TaskFull } from "./TaskModal";
import AttachmentPicker, { AttachmentValue } from "./AttachmentPicker";

interface Props {
  taskId: string;
  onClose: () => void;
  onSubmitted: (task: TaskFull) => void;
}

export default function SubmitReviewModal({ taskId, onClose, onSubmitted }: Props) {
  const [note, setNote] = useState("");
  const [attachment, setAttachment] = useState<AttachmentValue>({ mode: "none" });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  async function handleSubmit() {
    if (!note.trim()) {
      setError("Yapılan değişiklikler / teslim notu zorunludur");
      return;
    }
    setLoading(true);
    setError("");
    try {
      const payload: Record<string, unknown> = { action: "submit_review", submissionNote: note.trim() };
      if (attachment.mode === "link") {
        if (!attachment.url.trim()) {
          setError("Link URL'si zorunludur");
          setLoading(false);
          return;
        }
        payload.attachmentUrl = attachment.url.trim();
        payload.attachmentName = attachment.name.trim() || undefined;
      }

      const res = await fetch(`/api/tasks/${taskId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || "İncelemeye gönderilemedi");
        return;
      }
      let updated: TaskFull = data;

      if (attachment.mode === "file" && attachment.file) {
        const roundId = updated.reviewRounds?.slice().sort((a, b) => b.roundNumber - a.roundNumber)[0]?.id;
        if (roundId) {
          const fd = new FormData();
          fd.append("roundId", roundId);
          fd.append("kind", "SUBMISSION");
          fd.append("file", attachment.file);
          const fileRes = await fetch(`/api/tasks/${taskId}/attachments`, { method: "POST", body: fd });
          if (fileRes.ok) {
            const refreshed = await fetch(`/api/tasks/${taskId}`);
            if (refreshed.ok) updated = await refreshed.json();
          }
        }
      }

      onSubmitted(updated);
    } catch {
      setError("Sunucu hatası");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="fixed inset-0 bg-black/40 backdrop-blur-sm flex items-center justify-center z-[60] p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg max-h-[95vh] overflow-y-auto">
        <div className="flex items-center justify-between p-6 border-b border-gray-100">
          <h2 className="text-lg font-bold text-gray-800">İncelemeye Gönder</h2>
          <button onClick={onClose} className="p-2 rounded-xl text-gray-400 hover:bg-gray-100 transition-colors">
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        <div className="p-6 space-y-4">
          <div className="bg-indigo-50 border border-indigo-100 text-indigo-700 text-xs rounded-xl px-4 py-3 leading-relaxed">
            Görevi incelemeye göndermek üzeresiniz. İncelemeye gönderildikten sonra görevi
            kendiniz tekrar Yapılacak veya Devam Ediyor durumuna alamazsınız. Görev yetkili
            kişi tarafından onaylanacak veya revizyon için size geri gönderilecektir.
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1.5">
              Yapılan Değişiklikler / Teslim Notu *
            </label>
            <textarea
              rows={4}
              value={note}
              onChange={(e) => setNote(e.target.value)}
              placeholder="Görev kapsamında neler yaptığınızı özetleyin..."
              className="w-full px-3.5 py-2.5 rounded-xl border border-gray-200 text-sm text-gray-800 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-[#F57C28]/30 focus:border-[#F57C28] resize-none"
            />
          </div>

          <AttachmentPicker value={attachment} onChange={setAttachment} disabled={loading} />

          {error && (
            <div className="bg-red-50 border border-red-200 text-red-600 text-sm rounded-xl px-4 py-2.5">
              {error}
            </div>
          )}

          <div className="flex gap-3 pt-1">
            <button
              type="button"
              onClick={onClose}
              disabled={loading}
              className="flex-1 px-4 py-2.5 rounded-xl border border-gray-200 text-sm font-medium text-gray-600 hover:bg-gray-50 disabled:opacity-60 transition-colors"
            >
              Vazgeç
            </button>
            <button
              type="button"
              onClick={handleSubmit}
              disabled={loading}
              className="flex-1 px-4 py-2.5 rounded-xl bg-[#F57C28] hover:bg-[#D96A1A] disabled:opacity-60 text-white text-sm font-semibold transition-colors shadow-md shadow-[#F57C28]/25"
            >
              {loading ? "Gönderiliyor..." : "İncelemeye Gönder"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
