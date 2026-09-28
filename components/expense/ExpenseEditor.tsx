"use client";

/**
 * Harcama formu düzenleyici — yalnız form sahibi, yalnız Taslak / Düzeltme
 * Bekliyor. Yeni form (mode="create") ilk kayıtta oluşturulur; Form No sunucu
 * tarafından atanır. Toplam/net burada yalnız önizleme için hesaplanır —
 * kaydedilen değerleri sunucu yeniden hesaplar.
 */

import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { computeExpenseTotals, formatAmountPlain, formatTRY, parseAmountInput } from "@/lib/expense/calc";
import { EXPENSE_PDF_MAX_BYTES, expenseDepartmentLabel } from "@/lib/expense/constants";
import { validateExpenseForSubmission } from "@/lib/expense/validation";
import ConfirmModal from "@/components/ConfirmModal";
import type { ExpenseDetailDTO, ExpenseHeaderInfo } from "./types";
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
  formatCreatedDate,
  formatDateTime,
  inputCls,
  readError,
} from "./ui";

interface RowState {
  key: string;
  date: string;
  subject: string;
  vendor: string;
  description: string;
  clientProject: string;
  amount: string;
}

let rowSeq = 0;
function emptyRow(): RowState {
  rowSeq += 1;
  return { key: `r${rowSeq}`, date: "", subject: "", vendor: "", description: "", clientProject: "", amount: "" };
}

function toRow(i: ExpenseDetailDTO["items"][number]): RowState {
  rowSeq += 1;
  return {
    key: `r${rowSeq}`,
    date: i.date ? i.date.slice(0, 10) : "",
    subject: i.subject,
    vendor: i.vendor,
    description: i.description,
    clientProject: i.clientProject ?? "",
    amount: i.amount ? formatAmountPlain(i.amount) : "",
  };
}

const cellInput =
  "w-full px-2 py-1.5 text-sm border border-gray-200 rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-[#F57C28]/30 focus:border-[#F57C28]";

interface Props {
  mode: "create" | "edit";
  header: ExpenseHeaderInfo;
  detail?: ExpenseDetailDTO;
  onDetail?: (d: ExpenseDetailDTO) => void;
}

export default function ExpenseEditor({ mode, header, detail, onDetail }: Props) {
  const router = useRouter();
  const [formId, setFormId] = useState<string | null>(detail?.id ?? null);
  const [rows, setRows] = useState<RowState[]>(() =>
    detail && detail.items.length ? detail.items.map(toRow) : [emptyRow()]
  );
  const [cashAdvance, setCashAdvance] = useState(() => formatAmountPlain(detail?.cashAdvance ?? 0));
  const [note, setNote] = useState(detail?.note ?? "");
  const [pendingFile, setPendingFile] = useState<File | null>(null);
  const [busy, setBusy] = useState<null | "save" | "upload" | "submit" | "delete" | "cancel">(null);
  const [error, setError] = useState("");
  const [dirty, setDirty] = useState(false);
  const [preview, setPreview] = useState<ExpenseDetailDTO | null>(null);
  const [submitError, setSubmitError] = useState("");
  const [confirm, setConfirm] = useState<null | "delete" | "cancel">(null);
  const [toast, setToast] = useState("");
  const fileInput = useRef<HTMLInputElement>(null);

  const isRevision = detail?.status === "REVISION";

  useEffect(() => {
    if (!dirty) return;
    const h = (e: BeforeUnloadEvent) => {
      e.preventDefault();
      e.returnValue = "";
    };
    window.addEventListener("beforeunload", h);
    return () => window.removeEventListener("beforeunload", h);
  }, [dirty]);

  function flash(msg: string) {
    setToast(msg);
    setTimeout(() => setToast(""), 2500);
  }

  const parsedAmounts = rows.map((r) => parseAmountInput(r.amount));
  const parsedAdvance = parseAmountInput(cashAdvance);
  const totals = useMemo(
    () => computeExpenseTotals(parsedAmounts.map((a) => ({ amount: a ?? 0 })), parsedAdvance ?? 0),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [rows, cashAdvance]
  );

  function updateRow(key: string, patch: Partial<RowState>) {
    setDirty(true);
    setRows((prev) => prev.map((r) => (r.key === key ? { ...r, ...patch } : r)));
  }
  function addRow() {
    setDirty(true);
    setRows((prev) => [...prev, emptyRow()]);
  }
  function removeRow(key: string) {
    setDirty(true);
    setRows((prev) => (prev.length === 1 ? [emptyRow()] : prev.filter((r) => r.key !== key)));
  }

  function buildPayload(): object | null {
    if (parsedAmounts.some((a, i) => a === null && rows[i].amount.trim() !== "")) {
      setError("Geçersiz tutar var. Tutarları 1.234,56 biçiminde girin.");
      return null;
    }
    if (parsedAdvance === null) {
      setError("Nakit avans geçerli bir tutar değil.");
      return null;
    }
    return {
      note: note.trim() || null,
      cashAdvance: parsedAdvance,
      items: rows.map((r, i) => ({
        date: r.date || null,
        subject: r.subject,
        vendor: r.vendor,
        description: r.description,
        clientProject: r.clientProject || null,
        amount: parsedAmounts[i] ?? 0,
      })),
    };
  }

  async function uploadFile(id: string, file: File): Promise<ExpenseDetailDTO | null> {
    const fd = new FormData();
    fd.append("file", file);
    const res = await fetch(`/api/expenses/${id}/document`, { method: "POST", body: fd });
    if (!res.ok) {
      setError(await readError(res));
      return null;
    }
    return res.json();
  }

  /** Taslağı kaydeder (yoksa oluşturur); güncel detay döner. */
  async function save(): Promise<ExpenseDetailDTO | null> {
    setError("");
    const payload = buildPayload();
    if (!payload) return null;
    let current: ExpenseDetailDTO;
    if (!formId) {
      const res = await fetch("/api/expenses", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      if (!res.ok) {
        setError(await readError(res));
        return null;
      }
      current = await res.json();
      setFormId(current.id);
      if (pendingFile) {
        const uploaded = await uploadFile(current.id, pendingFile);
        if (!uploaded) {
          // Form oluştu ama PDF yüklenemedi → detaya geç, kullanıcı oradan tekrar yükler
          router.replace(`/harcama/${current.id}`);
          return null;
        }
        current = uploaded;
        setPendingFile(null);
      }
    } else {
      const res = await fetch(`/api/expenses/${formId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      if (!res.ok) {
        setError(await readError(res));
        return null;
      }
      current = await res.json();
    }
    setDirty(false);
    return current;
  }

  async function handleSave() {
    setBusy("save");
    try {
      const saved = await save();
      if (!saved) return;
      if (mode === "create") router.replace(`/harcama/${saved.id}`);
      else {
        onDetail?.(saved);
        flash("Taslak kaydedildi");
      }
    } finally {
      setBusy(null);
    }
  }

  function pickFile(file: File | undefined) {
    if (!file) return;
    setError("");
    if (!file.name.toLowerCase().endsWith(".pdf") && file.type !== "application/pdf") {
      setError("Yalnızca PDF dosyası yüklenebilir.");
      return;
    }
    if (file.size > EXPENSE_PDF_MAX_BYTES) {
      setError("PDF en fazla 20 MB olabilir.");
      return;
    }
    if (!formId) {
      setPendingFile(file);
      setDirty(true);
      return;
    }
    setBusy("upload");
    uploadFile(formId, file)
      .then((d) => {
        if (d) {
          onDetail?.(d);
          flash("PDF yüklendi");
        }
      })
      .finally(() => setBusy(null));
  }

  async function handleSubmitClick() {
    setError("");
    const itemsForCheck = rows
      .map((r, i) => ({
        date: r.date ? new Date(r.date) : null,
        subject: r.subject,
        vendor: r.vendor,
        description: r.description,
        amount: parsedAmounts[i] ?? 0,
        empty: !r.date && !r.subject.trim() && !r.vendor.trim() && !r.description.trim() && !r.clientProject.trim() && !r.amount.trim(),
      }))
      .filter((r) => !r.empty);
    const hasPdf = !!pendingFile || !!detail?.activeDocument;
    const errors = validateExpenseForSubmission({
      cashAdvance: parsedAdvance ?? 0,
      items: itemsForCheck,
      activeDocument: hasPdf ? { mimeType: "application/pdf" } : null,
    });
    if (errors.length) {
      setError(errors.join("\n"));
      return;
    }
    setBusy("save");
    try {
      const saved = await save();
      if (saved) {
        setSubmitError("");
        setPreview(saved);
      }
    } finally {
      setBusy(null);
    }
  }

  async function confirmSubmit() {
    if (!preview) return;
    setBusy("submit");
    setSubmitError("");
    try {
      const res = await fetch(`/api/expenses/${preview.id}/actions`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "submit" }),
      });
      if (!res.ok) {
        setSubmitError(await readError(res));
        return;
      }
      const d: ExpenseDetailDTO = await res.json();
      setPreview(null);
      if (mode === "create") router.replace(`/harcama/${d.id}`);
      else onDetail?.(d);
    } finally {
      setBusy(null);
    }
  }

  async function doConfirm() {
    if (!detail || !confirm) return;
    setBusy(confirm);
    setError("");
    try {
      if (confirm === "delete") {
        const res = await fetch(`/api/expenses/${detail.id}`, { method: "DELETE" });
        if (!res.ok) {
          setError(await readError(res));
          return;
        }
        setDirty(false);
        router.push("/harcama");
      } else {
        const res = await fetch(`/api/expenses/${detail.id}/actions`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ action: "cancel", version: detail.version }),
        });
        if (!res.ok) {
          setError(await readError(res));
          return;
        }
        setDirty(false);
        onDetail?.(await res.json());
      }
    } finally {
      setBusy(null);
      setConfirm(null);
    }
  }

  const docName = pendingFile?.name ?? detail?.activeDocument?.name ?? null;

  return (
    <div className="space-y-4">
      {toast && (
        <div className="fixed bottom-6 right-6 z-50 bg-gray-900 text-white text-sm font-medium px-4 py-2.5 rounded-xl shadow-xl">{toast}</div>
      )}

      {isRevision && detail?.lastRejection && (
        <div className="bg-red-50 border border-red-200 rounded-2xl px-5 py-4">
          <p className="text-sm font-bold text-red-600">
            Düzeltme istendi — {detail.lastRejection.stage === "ACCOUNTING" ? "Muhasebe" : "Departman onayı"}
          </p>
          <p className="text-sm text-gray-700 mt-1 whitespace-pre-line">{detail.lastRejection.note}</p>
          <p className="text-xs text-gray-400 mt-1.5">
            {detail.lastRejection.byName ?? "—"} · {formatDateTime(detail.lastRejection.at)}
          </p>
          <p className="text-xs text-gray-500 mt-2">
            Formu düzeltip yeniden gönderdiğinizde departman onayı baştan başlar.
          </p>
        </div>
      )}

      {/* Üst bilgiler */}
      <Card
        title={
          <span className="flex items-center gap-2">
            {header.formNo ?? "Yeni Harcama Formu"}
            {detail && <ExpenseStatusBadge status={detail.status} />}
          </span>
        }
      >
        <div className="p-5 grid grid-cols-2 md:grid-cols-5 gap-4">
          <Field label="Form No">{header.formNo ?? <span className="text-gray-400">Kaydedildiğinde atanır</span>}</Field>
          <Field label="Personel">{header.ownerName}</Field>
          <Field label="Departman">{expenseDepartmentLabel(header.department)}</Field>
          <Field label="Ünvan">{header.title || "—"}</Field>
          <Field label="Oluşturma Tarihi">{formatCreatedDate(header.createdAt ?? new Date().toISOString())}</Field>
        </div>
        <div className="px-5 pb-5">
          <label className="block text-[11px] font-semibold text-gray-400 uppercase tracking-wide mb-1">
            Genel Açıklama / Not <span className="normal-case font-normal">(opsiyonel)</span>
          </label>
          <textarea
            value={note}
            onChange={(e) => {
              setNote(e.target.value);
              setDirty(true);
            }}
            rows={2}
            maxLength={2000}
            className={`${inputCls} resize-none`}
            placeholder="Örn. Eylül ayı İstanbul saha çalışması masrafları"
          />
        </div>
      </Card>

      {/* Harcama satırları */}
      <Card
        title="Harcama Satırları"
        right={
          <button type="button" onClick={addRow} className="text-xs font-semibold text-[#F57C28] hover:text-[#D96A1A]">
            + Satır Ekle
          </button>
        }
      >
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-[11px] font-semibold text-gray-400 uppercase tracking-wide">
                <th className="pl-5 pr-1 py-2 w-8">#</th>
                <th className="px-1 py-2 w-36">Tarih</th>
                <th className="px-1 py-2 min-w-[150px]">Harcama Konusu</th>
                <th className="px-1 py-2 min-w-[150px]">Firma / Harcama Yeri</th>
                <th className="px-1 py-2 min-w-[200px]">Açıklama</th>
                <th className="px-1 py-2 min-w-[140px]">Müşteri / Proje</th>
                <th className="px-1 py-2 w-36 text-right">Tutar (₺)</th>
                <th className="pl-1 pr-4 py-2 w-8" />
              </tr>
            </thead>
            <tbody>
              {rows.map((r, idx) => {
                const badAmount = parsedAmounts[idx] === null && r.amount.trim() !== "";
                return (
                  <tr key={r.key} className="align-top">
                    <td className="pl-5 pr-1 py-1.5 text-xs text-gray-400 pt-3.5">{idx + 1}</td>
                    <td className="px-1 py-1.5">
                      <input type="date" value={r.date} onChange={(e) => updateRow(r.key, { date: e.target.value })} className={cellInput} />
                    </td>
                    <td className="px-1 py-1.5">
                      <input value={r.subject} maxLength={500} onChange={(e) => updateRow(r.key, { subject: e.target.value })} className={cellInput} placeholder="Yemek, yol, konaklama…" />
                    </td>
                    <td className="px-1 py-1.5">
                      <input value={r.vendor} maxLength={500} onChange={(e) => updateRow(r.key, { vendor: e.target.value })} className={cellInput} />
                    </td>
                    <td className="px-1 py-1.5">
                      <input value={r.description} maxLength={500} onChange={(e) => updateRow(r.key, { description: e.target.value })} className={cellInput} />
                    </td>
                    <td className="px-1 py-1.5">
                      <input value={r.clientProject} maxLength={500} onChange={(e) => updateRow(r.key, { clientProject: e.target.value })} className={cellInput} placeholder="Opsiyonel" />
                    </td>
                    <td className="px-1 py-1.5">
                      <input
                        value={r.amount}
                        inputMode="decimal"
                        onChange={(e) => updateRow(r.key, { amount: e.target.value })}
                        onBlur={() => {
                          const n = parsedAmounts[idx];
                          if (n !== null && r.amount.trim() !== "") updateRow(r.key, { amount: formatAmountPlain(n) });
                        }}
                        onKeyDown={(e) => {
                          if (e.key === "Enter" && idx === rows.length - 1) {
                            e.preventDefault();
                            addRow();
                          }
                        }}
                        className={`${cellInput} text-right tabular-nums ${badAmount ? "!border-red-400" : ""}`}
                        placeholder="0,00"
                      />
                    </td>
                    <td className="pl-1 pr-4 py-1.5">
                      <button
                        type="button"
                        onClick={() => removeRow(r.key)}
                        className="p-1.5 mt-0.5 rounded-lg text-gray-300 hover:text-red-500 hover:bg-red-50 transition-colors"
                        aria-label="Satırı sil"
                      >
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
                          <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                        </svg>
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
        <p className="px-5 py-2.5 text-[11px] text-gray-400 border-t border-gray-100">
          Farklı aylara ait harcamalar aynı formda yer alabilir. Son satırın tutarında Enter yeni satır ekler.
        </p>
      </Card>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Belge */}
        <Card title="Harcama Belgeleri (PDF)">
          <div className="p-5 space-y-3">
            <p className="text-xs text-gray-500">
              Tüm fiş/faturaları <strong>tek bir PDF</strong> olarak yükleyin. Taslakta zorunlu değildir, onaya göndermek için gereklidir.
            </p>
            {docName ? (
              <div className="flex items-center justify-between gap-3 bg-gray-50 rounded-xl px-3 py-2.5">
                <div className="min-w-0">
                  <p className="text-sm font-medium text-gray-700 truncate">{docName}</p>
                  <p className="text-[11px] text-gray-400">{pendingFile ? "Kaydedildiğinde yüklenecek" : `Yükleyen: ${detail?.activeDocument?.uploadedByName}`}</p>
                </div>
                {!pendingFile && detail?.activeDocument && (
                  <a
                    href={`/api/expenses/${detail.id}/document/${detail.activeDocument.id}`}
                    target="_blank"
                    rel="noreferrer"
                    className="text-xs font-semibold text-[#F57C28] hover:underline flex-shrink-0"
                  >
                    Görüntüle
                  </a>
                )}
              </div>
            ) : (
              <p className="text-sm text-gray-400">Henüz PDF yüklenmedi.</p>
            )}
            <input
              ref={fileInput}
              type="file"
              accept="application/pdf,.pdf"
              className="hidden"
              onChange={(e) => {
                pickFile(e.target.files?.[0]);
                e.target.value = "";
              }}
            />
            <button type="button" onClick={() => fileInput.current?.click()} disabled={busy !== null} className={btnSecondary}>
              {busy === "upload" ? "Yükleniyor…" : docName ? "PDF'i Değiştir" : "PDF Yükle"}
            </button>
          </div>
        </Card>

        {/* Toplamlar */}
        <Card title="Toplamlar">
          <div className="p-5 space-y-3 text-sm">
            <div className="flex items-center justify-between">
              <span className="text-gray-500">Genel Toplam</span>
              <span className="font-semibold tabular-nums text-gray-800">{formatTRY(totals.totalAmount)}</span>
            </div>
            <div className="flex items-center justify-between gap-3">
              <span className="text-gray-500">
                Nakit Avans <span className="text-[11px] text-gray-400">(aldığınız avans)</span>
              </span>
              <input
                value={cashAdvance}
                inputMode="decimal"
                onChange={(e) => {
                  setCashAdvance(e.target.value);
                  setDirty(true);
                }}
                onBlur={() => parsedAdvance !== null && setCashAdvance(formatAmountPlain(parsedAdvance))}
                className={`${cellInput} !w-36 text-right tabular-nums ${parsedAdvance === null ? "!border-red-400" : ""}`}
              />
            </div>
            <div className="flex items-center justify-between border-t border-gray-100 pt-3">
              <span className="font-semibold text-gray-700">Net Durum</span>
              <NetAmount amount={totals.netAmount} withLabel className="text-base" />
            </div>
            <p className="text-[11px] text-gray-400">
              {totals.totalAmount === 0 && totals.cashAdvance === 0
                ? "Satır ekledikçe toplamlar hesaplanır."
                : totals.netAmount > 0
                ? "Onaylanırsa bu tutar size ödenecek."
                : totals.netAmount < 0
                  ? "Onaylanırsa bu tutarı Vezin'e iade etmeniz gerekecek."
                  : "Avans harcamaya eşit — onaylanırsa mahsuplaşır."}
            </p>
          </div>
        </Card>
      </div>

      {error && <ErrorBox>{error}</ErrorBox>}

      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div className="flex gap-2">
          {detail?.permissions.canDelete && (
            <button type="button" onClick={() => setConfirm("delete")} disabled={busy !== null} className={btnDanger}>
              Taslağı Sil
            </button>
          )}
          {detail?.permissions.canCancel && (
            <button type="button" onClick={() => setConfirm("cancel")} disabled={busy !== null} className={btnDanger}>
              Formu İptal Et
            </button>
          )}
        </div>
        <div className="flex gap-2">
          <button type="button" onClick={handleSave} disabled={busy !== null} className={btnSecondary}>
            {busy === "save" ? "Kaydediliyor…" : "Taslak Kaydet"}
          </button>
          <button type="button" onClick={handleSubmitClick} disabled={busy !== null} className={btnPrimary}>
            {isRevision ? "Yeniden Gönder" : "Onaya Gönder"}
          </button>
        </div>
      </div>

      {preview && (
        <Modal title={isRevision ? "Yeniden Gönder" : "Onaya Gönder"} onClose={() => busy !== "submit" && setPreview(null)}>
          <div className="space-y-2.5 text-sm">
            <div className="flex justify-between"><span className="text-gray-500">Form No</span><span className="font-semibold text-gray-800">{preview.formNo}</span></div>
            <div className="flex justify-between"><span className="text-gray-500">Harcama satırı</span><span className="text-gray-800">{preview.items.length}</span></div>
            <div className="flex justify-between"><span className="text-gray-500">Genel Toplam</span><span className="tabular-nums text-gray-800">{formatTRY(preview.totalAmount)}</span></div>
            <div className="flex justify-between"><span className="text-gray-500">Nakit Avans</span><span className="tabular-nums text-gray-800">{formatTRY(preview.cashAdvance)}</span></div>
            <div className="flex justify-between border-t border-gray-100 pt-2.5"><span className="font-semibold text-gray-700">Net Durum</span><NetAmount amount={preview.netAmount} withLabel /></div>
            <div className="flex justify-between gap-3"><span className="text-gray-500">PDF</span><span className="text-gray-800 truncate">{preview.activeDocument?.name ?? "—"}</span></div>
          </div>
          <p className="mt-4 text-xs text-gray-500 bg-gray-50 rounded-xl px-3 py-2.5">
            Gönderdikten sonra formu düzenleyemez, satır/PDF/avans değiştiremez ve geri çekemezsiniz. Hata varsa onaycı reddeder, siz düzeltirsiniz.
          </p>
          {submitError && <div className="mt-3"><ErrorBox>{submitError}</ErrorBox></div>}
          <div className="flex gap-3 mt-5">
            <button type="button" onClick={() => setPreview(null)} disabled={busy === "submit"} className={`${btnSecondary} flex-1`}>Vazgeç</button>
            <button type="button" onClick={confirmSubmit} disabled={busy === "submit"} className={`${btnPrimary} flex-1`}>
              {busy === "submit" ? "Gönderiliyor…" : isRevision ? "Yeniden Gönder" : "Onaya Gönder"}
            </button>
          </div>
        </Modal>
      )}

      {confirm && (
        <ConfirmModal
          title={confirm === "delete" ? "Taslağı Sil" : "Formu İptal Et"}
          message={
            confirm === "delete"
              ? "Bu taslak kalıcı olarak silinecek. Emin misiniz?"
              : "Form iptal edilecek ve bir daha açılamayacak. Emin misiniz?"
          }
          confirmLabel={confirm === "delete" ? "Sil" : "İptal Et"}
          danger
          loading={busy === confirm}
          onConfirm={doConfirm}
          onCancel={() => setConfirm(null)}
        />
      )}
    </div>
  );
}
