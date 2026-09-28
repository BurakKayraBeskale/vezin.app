"use client";

/**
 * Form detay ekranı. Sahibi Taslak/Düzeltme Bekliyor'da düzenleyici görür;
 * diğer herkes (Admin dahil) içeriği SALT-OKUNUR görür ve yalnız yetkisine
 * göre iş akışı aksiyonlarını kullanır. Butonlar yalnız UI kolaylığıdır —
 * her aksiyon sunucuda yeniden yetki/durum/sürüm kontrolünden geçer.
 */

import { useState } from "react";
import { formatTRY, netDirection, statusAfterAccountingApproval } from "@/lib/expense/calc";
import { EXPENSE_STATUS_LABELS, expenseDepartmentLabel } from "@/lib/expense/constants";
import ExpenseEditor from "./ExpenseEditor";
import { AccountingSection, AuditSection, DepartmentApprovalSection, RoundHistorySection } from "./ExpenseHistorySections";
import type { ExpenseDetailDTO } from "./types";
import {
  Card,
  ErrorBox,
  ExpenseStatusBadge,
  Field,
  Modal,
  NetAmount,
  btnDanger,
  btnPrimary,
  btnSecondary,
  btnSuccess,
  formatCreatedDate,
  formatDateTime,
  formatDay,
  inputCls,
  readError,
  todayIso,
} from "./ui";

type ActionModal =
  | { kind: "dept-approve" }
  | { kind: "dept-reject" }
  | { kind: "accounting-approve" }
  | { kind: "accounting-reject" }
  | { kind: "mark-paid" }
  | { kind: "mark-refund-received" }
  | { kind: "revert-settlement" }
  | { kind: "replace-approver"; approvalId: string };

export default function ExpenseDetailView({ initial }: { initial: ExpenseDetailDTO }) {
  const [detail, setDetail] = useState<ExpenseDetailDTO>(initial);
  const [modal, setModal] = useState<ActionModal | null>(null);
  const [note, setNote] = useState("");
  const [txDate, setTxDate] = useState(todayIso());
  const [newApproverId, setNewApproverId] = useState("");
  const [busy, setBusy] = useState(false);
  const [modalError, setModalError] = useState("");
  const [banner, setBanner] = useState("");

  const p = detail.permissions;
  const currentRound = detail.rounds[detail.rounds.length - 1];

  function open(m: ActionModal) {
    setModal(m);
    setNote("");
    setTxDate(todayIso());
    setNewApproverId("");
    setModalError("");
  }

  async function reload() {
    const res = await fetch(`/api/expenses/${detail.id}`);
    if (res.ok) setDetail(await res.json());
  }

  async function run(body: Record<string, unknown>) {
    setBusy(true);
    setModalError("");
    try {
      const res = await fetch(`/api/expenses/${detail.id}/actions`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      if (res.status === 409) {
        // Stale ekran: başka biri işlem yaptı — güncel hali göster
        setModal(null);
        setBanner(await readError(res));
        await reload();
        return;
      }
      if (!res.ok) {
        setModalError(await readError(res));
        return;
      }
      setDetail(await res.json());
      setModal(null);
      setBanner("");
    } finally {
      setBusy(false);
    }
  }

  function submitModal() {
    if (!modal) return;
    switch (modal.kind) {
      case "dept-approve":
        return run({ action: "dept-approve", roundId: currentRound?.id });
      case "dept-reject":
        return run({ action: "dept-reject", roundId: currentRound?.id, note });
      case "accounting-approve":
        return run({ action: "accounting-approve", version: detail.version });
      case "accounting-reject":
        return run({ action: "accounting-reject", version: detail.version, note });
      case "mark-paid":
      case "mark-refund-received":
        return run({ action: modal.kind, version: detail.version, transactionDate: txDate, note });
      case "revert-settlement":
        return run({ action: "revert-settlement", version: detail.version, reason: note });
      case "replace-approver":
        return run({ action: "replace-approver", approvalId: modal.approvalId, newApproverId });
    }
  }

  const header = (
    <Card
      title={
        <span className="flex items-center gap-2">
          {detail.formNo}
          <ExpenseStatusBadge status={detail.status} />
        </span>
      }
      right={
        <div className="flex gap-2 flex-wrap">
          {p.canApproveDepartment && (
            <>
              <button type="button" className={btnDanger} onClick={() => open({ kind: "dept-reject" })}>Reddet</button>
              <button type="button" className={btnSuccess} onClick={() => open({ kind: "dept-approve" })}>Onayla</button>
            </>
          )}
          {p.canApproveAccounting && (
            <>
              <button type="button" className={btnDanger} onClick={() => open({ kind: "accounting-reject" })}>Reddet</button>
              <button type="button" className={btnSuccess} onClick={() => open({ kind: "accounting-approve" })}>Muhasebe Onayı</button>
            </>
          )}
          {p.canMarkPaid && (
            <button type="button" className={btnPrimary} onClick={() => open({ kind: "mark-paid" })}>Ödendi</button>
          )}
          {p.canMarkRefundReceived && (
            <button type="button" className={btnPrimary} onClick={() => open({ kind: "mark-refund-received" })}>İade Alındı</button>
          )}
          {p.canRevertSettlement && (
            <button type="button" className={btnSecondary} onClick={() => open({ kind: "revert-settlement" })}>Kapanışı Geri Al</button>
          )}
        </div>
      }
    >
      <div className="p-5 grid grid-cols-2 md:grid-cols-6 gap-4">
        <Field label="Personel">
          {detail.ownerName}
          {detail.owner.status !== "ACTIVE" && <span className="ml-1.5 text-[11px] font-semibold text-red-600">Pasif</span>}
        </Field>
        <Field label="Departman">{expenseDepartmentLabel(detail.department)}</Field>
        <Field label="Ünvan">{detail.title || "—"}</Field>
        <Field label="Oluşturma Tarihi">{formatCreatedDate(detail.createdAt)}</Field>
        <Field label="İlk Gönderim">{formatDateTime(detail.firstSubmittedAt)}</Field>
        <Field label="Son İşlem">{formatDateTime(detail.lastActionAt)}</Field>
      </div>
      {detail.note && (
        <div className="px-5 pb-5">
          <p className="text-[11px] font-semibold text-gray-400 uppercase tracking-wide mb-0.5">Genel Açıklama / Not</p>
          <p className="text-sm text-gray-700 whitespace-pre-line">{detail.note}</p>
        </div>
      )}
    </Card>
  );

  const bannerEl = banner && (
    <div className="bg-orange-50 border border-orange-200 text-orange-700 text-sm rounded-xl px-4 py-2.5 flex items-center justify-between gap-3">
      <span>{banner}</span>
      <button type="button" className="text-xs font-semibold" onClick={() => setBanner("")}>Kapat</button>
    </div>
  );

  const historySections = (
    <>
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <DepartmentApprovalSection detail={detail} onReplace={(approvalId) => open({ kind: "replace-approver", approvalId })} />
        <AccountingSection detail={detail} />
      </div>
      <RoundHistorySection detail={detail} />
      <AuditSection detail={detail} />
    </>
  );

  if (p.canEdit) {
    return (
      <div className="space-y-4">
        {bannerEl}
        <ExpenseEditor
          key={`${detail.id}-${detail.status}`}
          mode="edit"
          detail={detail}
          onDetail={setDetail}
          header={{
            formNo: detail.formNo,
            ownerName: detail.ownerName,
            department: detail.department,
            title: detail.title,
            createdAt: detail.createdAt,
          }}
        />
        {detail.rounds.length > 0 && historySections}
        {detail.rounds.length === 0 && <AuditSection detail={detail} />}
      </div>
    );
  }

  const dir = netDirection(detail.netAmount);

  return (
    <div className="space-y-4">
      {bannerEl}
      {header}

      {detail.status === "REVISION" && detail.lastRejection && (
        <div className="bg-red-50 border border-red-200 rounded-2xl px-5 py-3 text-sm">
          <span className="font-bold text-red-600">Düzeltme istendi ({detail.lastRejection.stage === "ACCOUNTING" ? "Muhasebe" : "Departman"}): </span>
          <span className="text-gray-700">{detail.lastRejection.note}</span>
          <span className="text-xs text-gray-400 ml-2">{detail.lastRejection.byName} · {formatDateTime(detail.lastRejection.at)}</span>
        </div>
      )}

      <Card title={`Harcama Satırları (${detail.items.length})`}>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-[11px] font-semibold text-gray-400 uppercase tracking-wide border-b border-gray-100">
                <th className="pl-5 pr-2 py-2.5 w-8">#</th>
                <th className="px-2 py-2.5">Tarih</th>
                <th className="px-2 py-2.5">Harcama Konusu</th>
                <th className="px-2 py-2.5">Firma / Harcama Yeri</th>
                <th className="px-2 py-2.5">Açıklama</th>
                <th className="px-2 py-2.5">Müşteri / Proje</th>
                <th className="pl-2 pr-5 py-2.5 text-right">Tutar</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {detail.items.map((i, idx) => (
                <tr key={i.id} className="align-top">
                  <td className="pl-5 pr-2 py-2.5 text-xs text-gray-400">{idx + 1}</td>
                  <td className="px-2 py-2.5 whitespace-nowrap tabular-nums text-gray-600">{formatDay(i.date)}</td>
                  <td className="px-2 py-2.5 text-gray-800">{i.subject}</td>
                  <td className="px-2 py-2.5 text-gray-700">{i.vendor}</td>
                  <td className="px-2 py-2.5 text-gray-600">{i.description}</td>
                  <td className="px-2 py-2.5 text-gray-500">{i.clientProject || "—"}</td>
                  <td className="pl-2 pr-5 py-2.5 text-right tabular-nums font-medium text-gray-800 whitespace-nowrap">{formatTRY(i.amount)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <Card title="Toplamlar">
          <div className="p-5 space-y-2.5 text-sm">
            <div className="flex justify-between"><span className="text-gray-500">Genel Toplam</span><span className="tabular-nums font-semibold text-gray-800">{formatTRY(detail.totalAmount)}</span></div>
            <div className="flex justify-between"><span className="text-gray-500">Nakit Avans</span><span className="tabular-nums text-gray-800">{formatTRY(detail.cashAdvance)}</span></div>
            <div className="flex justify-between border-t border-gray-100 pt-2.5">
              <span className="font-semibold text-gray-700">Net Durum</span>
              <NetAmount amount={detail.netAmount} withLabel className="text-base" />
            </div>
            <p className="text-[11px] text-gray-400">
              {dir === "RECEIVABLE" ? "Vezin personele ödeyecek." : dir === "REFUND" ? "Personel Vezin'e iade edecek." : "Avans harcamaya eşit — mahsup."}
            </p>
          </div>
        </Card>
        <Card title="Harcama Belgeleri (PDF)">
          <div className="p-5 space-y-2">
            {detail.activeDocument ? (
              <div className="flex items-center justify-between gap-3 bg-gray-50 rounded-xl px-3 py-2.5">
                <div className="min-w-0">
                  <p className="text-sm font-medium text-gray-700 truncate">{detail.activeDocument.name}</p>
                  <p className="text-[11px] text-gray-400">
                    {detail.activeDocument.size < 1024 * 1024
                      ? `${Math.max(1, Math.round(detail.activeDocument.size / 1024))} KB`
                      : `${(detail.activeDocument.size / 1024 / 1024).toFixed(1)} MB`}{" "}
                    · {formatDateTime(detail.activeDocument.createdAt)}
                  </p>
                </div>
                <div className="flex gap-3 flex-shrink-0">
                  <a href={`/api/expenses/${detail.id}/document/${detail.activeDocument.id}`} target="_blank" rel="noreferrer" className="text-xs font-semibold text-[#F57C28] hover:underline">
                    Görüntüle
                  </a>
                  <a href={`/api/expenses/${detail.id}/document/${detail.activeDocument.id}?download=1`} className="text-xs font-semibold text-gray-500 hover:underline">
                    İndir
                  </a>
                </div>
              </div>
            ) : (
              <p className="text-sm text-gray-400">PDF yok.</p>
            )}
            {detail.previousDocuments.length > 0 && (
              <details className="text-xs">
                <summary className="cursor-pointer text-gray-400">Önceki sürümler ({detail.previousDocuments.length})</summary>
                <ul className="mt-1.5 space-y-1">
                  {detail.previousDocuments.map((d) => (
                    <li key={d.id} className="flex justify-between gap-3">
                      <a href={`/api/expenses/${detail.id}/document/${d.id}`} target="_blank" rel="noreferrer" className="text-gray-500 hover:underline truncate">{d.name}</a>
                      <span className="text-gray-400 flex-shrink-0">değiştirildi {formatDateTime(d.replacedAt)}</span>
                    </li>
                  ))}
                </ul>
              </details>
            )}
          </div>
        </Card>
      </div>

      {historySections}

      {modal && (
        <Modal title={MODAL_TITLES[modal.kind]} onClose={() => !busy && setModal(null)}>
          <div className="space-y-4">
            {(modal.kind === "dept-approve" || modal.kind === "accounting-approve") && (
              <div className="space-y-2 text-sm">
                <div className="flex justify-between"><span className="text-gray-500">Personel</span><span className="text-gray-800">{detail.ownerName}</span></div>
                <div className="flex justify-between"><span className="text-gray-500">Genel Toplam</span><span className="tabular-nums text-gray-800">{formatTRY(detail.totalAmount)}</span></div>
                <div className="flex justify-between"><span className="text-gray-500">Nakit Avans</span><span className="tabular-nums text-gray-800">{formatTRY(detail.cashAdvance)}</span></div>
                <div className="flex justify-between"><span className="text-gray-500">Net</span><NetAmount amount={detail.netAmount} withLabel /></div>
                {modal.kind === "accounting-approve" && (
                  <p className="text-xs text-gray-500 bg-gray-50 rounded-xl px-3 py-2">
                    Onay sonrası durum: <strong>{EXPENSE_STATUS_LABELS[statusAfterAccountingApproval(detail.netAmount)]}</strong>
                  </p>
                )}
                {modal.kind === "dept-approve" && p.departmentActionIsAdminOverride && (
                  <p className="text-xs text-orange-700 bg-orange-50 border border-orange-200 rounded-xl px-3 py-2">
                    Bu turun onaycısı değilsiniz. Admin olarak onaylarsanız departman aşaması bekleyen onaylar beklenmeden kapanır ve form Muhasebe&apos;ye geçer.
                  </p>
                )}
              </div>
            )}

            {(modal.kind === "mark-paid" || modal.kind === "mark-refund-received") && (
              <div className="space-y-3">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">İşlem Tarihi</label>
                  <input type="date" value={txDate} onChange={(e) => setTxDate(e.target.value)} className={inputCls} />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Tutar</label>
                  <input value={formatTRY(Math.abs(detail.netAmount))} readOnly disabled className={`${inputCls} opacity-70 tabular-nums`} />
                  <p className="text-[11px] text-gray-400 mt-1">Kısmi işlem yapılmaz — formun net tutarı kapanır.</p>
                </div>
              </div>
            )}

            {modal.kind === "replace-approver" && (
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Yeni onaycı ({expenseDepartmentLabel(detail.department)})</label>
                <select value={newApproverId} onChange={(e) => setNewApproverId(e.target.value)} className={inputCls}>
                  <option value="">Seçin…</option>
                  {detail.approverCandidates.map((c) => (
                    <option key={c.id} value={c.id}>{c.name}{c.title ? ` — ${c.title}` : ""}</option>
                  ))}
                </select>
                <p className="text-[11px] text-gray-400 mt-1">Yalnızca bu form için geçerlidir; onay ayarları değişmez.</p>
              </div>
            )}

            {modal.kind !== "dept-approve" && modal.kind !== "accounting-approve" && modal.kind !== "replace-approver" && (
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  {NOTE_LABELS[modal.kind]}
                  {NOTE_REQUIRED.includes(modal.kind) ? " *" : <span className="font-normal text-gray-400"> (opsiyonel)</span>}
                </label>
                <textarea value={note} onChange={(e) => setNote(e.target.value)} rows={3} maxLength={2000} className={`${inputCls} resize-none`} />
              </div>
            )}

            {modalError && <ErrorBox>{modalError}</ErrorBox>}

            <div className="flex gap-3">
              <button type="button" onClick={() => setModal(null)} disabled={busy} className={`${btnSecondary} flex-1`}>Vazgeç</button>
              <button
                type="button"
                onClick={submitModal}
                disabled={
                  busy ||
                  (NOTE_REQUIRED.includes(modal.kind) && !note.trim()) ||
                  (modal.kind === "replace-approver" && !newApproverId)
                }
                className={`${modal.kind.endsWith("reject") ? btnDanger : btnPrimary} flex-1`}
              >
                {busy ? "…" : CONFIRM_LABELS[modal.kind]}
              </button>
            </div>
          </div>
        </Modal>
      )}
    </div>
  );
}

const MODAL_TITLES: Record<ActionModal["kind"], string> = {
  "dept-approve": "Departman Onayı",
  "dept-reject": "Reddet / Düzeltme İste",
  "accounting-approve": "Muhasebe Onayı",
  "accounting-reject": "Muhasebe Reddi / Düzeltme İste",
  "mark-paid": "Ödendi Olarak İşaretle",
  "mark-refund-received": "İade Alındı Olarak İşaretle",
  "revert-settlement": "Kapanışı Geri Al",
  "replace-approver": "Onaycıyı Değiştir",
};

const CONFIRM_LABELS: Record<ActionModal["kind"], string> = {
  "dept-approve": "Onayla",
  "dept-reject": "Reddet",
  "accounting-approve": "Onayla",
  "accounting-reject": "Reddet",
  "mark-paid": "Kaydet",
  "mark-refund-received": "Kaydet",
  "revert-settlement": "Geri Al",
  "replace-approver": "Değiştir",
};

const NOTE_LABELS: Partial<Record<ActionModal["kind"], string>> = {
  "dept-reject": "Red / Düzeltme Açıklaması",
  "accounting-reject": "Red / Düzeltme Açıklaması",
  "mark-paid": "Açıklama",
  "mark-refund-received": "Açıklama",
  "revert-settlement": "Geri Alma Gerekçesi",
};

const NOTE_REQUIRED: ActionModal["kind"][] = ["dept-reject", "accounting-reject", "revert-settlement"];
