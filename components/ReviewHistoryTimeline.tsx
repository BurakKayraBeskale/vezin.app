"use client";

import { TaskReviewRoundRecord } from "./TaskModal";

function fmtDateTime(d: string) {
  const date = new Date(d);
  const datePart = date.toLocaleDateString("tr-TR", { day: "2-digit", month: "2-digit", year: "numeric" });
  const timePart = date.toLocaleTimeString("tr-TR", { hour: "2-digit", minute: "2-digit" });
  return `${datePart} ${timePart}`;
}

function AttachmentLine({ att }: { att: TaskReviewRoundRecord["attachments"][number] }) {
  if (att.purgedAt) {
    return (
      <p className="text-[11px] text-red-500 mt-1">
        Saklama süresi dolduğu için fiziksel dosya kaldırılmıştır ({att.name})
      </p>
    );
  }
  if (att.type === "LINK" && att.url) {
    return (
      <a
        href={att.url}
        target="_blank"
        rel="noopener noreferrer"
        className="inline-flex items-center gap-1 text-[11px] text-[#F57C28] hover:text-[#D96A1A] font-medium mt-1"
      >
        🔗 {att.name}
      </a>
    );
  }
  return (
    <a
      href={`/api/tasks/${(att as any).taskId}/attachments/${att.id}/download`}
      className="inline-flex items-center gap-1 text-[11px] text-[#F57C28] hover:text-[#D96A1A] font-medium mt-1"
    >
      📎 {att.name}
    </a>
  );
}

interface Props {
  taskId: string;
  rounds: TaskReviewRoundRecord[];
}

export default function ReviewHistoryTimeline({ taskId, rounds }: Props) {
  if (rounds.length === 0) {
    return <p className="text-sm text-gray-400 italic">Henüz inceleme geçmişi yok</p>;
  }

  return (
    <ol className="space-y-5">
      {rounds.map((r) => (
        <li key={r.id}>
          <p className="text-[11px] font-bold text-gray-400 uppercase tracking-wide mb-1.5">
            İnceleme Turu {r.roundNumber}
          </p>

          {/* Gönderim */}
          <div className="pl-3 border-l-2 border-indigo-200 pb-3">
            <p className="text-sm">
              <span className="font-semibold text-gray-800">{r.submittedBy.name}</span>{" "}
              <span className="text-gray-500">— İncelemeye Gönderdi</span>
            </p>
            <p className="text-sm text-gray-600 mt-0.5">"{r.submissionNote}"</p>
            <p className="text-[11px] text-gray-400 mt-1">{fmtDateTime(r.submittedAt)}</p>
            {r.attachments
              .filter((a) => a.kind === "SUBMISSION")
              .map((a) => (
                <AttachmentLine key={a.id} att={{ ...a, taskId } as any} />
              ))}
          </div>

          {/* Revizyon / Onay */}
          {r.reviewAction === "REVISION_REQUESTED" && r.reviewedBy && (
            <div className="pl-3 border-l-2 border-amber-200">
              <p className="text-[11px] font-bold text-gray-400 uppercase tracking-wide mb-1.5 mt-2">
                Revizyon {r.roundNumber}
              </p>
              <p className="text-sm">
                <span className="font-semibold text-gray-800">{r.reviewedBy.name}</span>{" "}
                <span className="text-gray-500">— Revizyon İstedi</span>
              </p>
              {r.reviewNote && <p className="text-sm text-gray-600 mt-0.5">"{r.reviewNote}"</p>}
              {r.reviewedAt && <p className="text-[11px] text-gray-400 mt-1">{fmtDateTime(r.reviewedAt)}</p>}
              {r.attachments
                .filter((a) => a.kind === "FEEDBACK")
                .map((a) => (
                  <AttachmentLine key={a.id} att={{ ...a, taskId } as any} />
                ))}
            </div>
          )}

          {r.reviewAction === "APPROVED" && r.reviewedBy && (
            <div className="pl-3 border-l-2 border-emerald-200">
              <p className="text-sm mt-2">
                <span className="font-semibold text-gray-800">{r.reviewedBy.name}</span>{" "}
                <span className="text-emerald-600 font-medium">— Onayladı</span>
              </p>
              {r.reviewedAt && <p className="text-[11px] text-gray-400 mt-1">{fmtDateTime(r.reviewedAt)}</p>}
            </div>
          )}
        </li>
      ))}
    </ol>
  );
}
