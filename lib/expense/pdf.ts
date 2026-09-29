/**
 * Personel Harcama Formu — PDF çıktıları (YALNIZ sunucu).
 *
 *   renderExpenseFormPdf(detail)                → sistemin ürettiği form PDF'i
 *   renderExpenseFormPdf(detail, { documentPdf }) → form + personelin yüklediği
 *                                                  harcama belgeleri, TEK PDF
 *
 * Birleşik PDF talep anında üretilir, storage'a YAZILMAZ.
 *
 * Mevcut altyapı: jsPDF + jspdf-autotable (form), pdf-to-img (belge sayfaları).
 * Yeni kütüphane eklenmedi; bu yüzden belge sayfaları jsPDF'e görüntü olarak
 * (sayfa boyutu korunarak) eklenir — metin seçilebilirliği kaybolur, görünüm aynıdır.
 *
 * Türkçe karakterler için jsPDF'in standart fontları yetmez (ğ/ş/ı yok); pdfjs-dist
 * ile gelen Liberation Sans (SIL OFL) kullanılır. Bulunamazsa Helvetica'ya düşülür
 * ve Türkçe'ye özgü harfler ASCII karşılıklarına çevrilir.
 */

import { readFile } from "fs/promises";
import path from "path";
import { jsPDF } from "jspdf";
import autoTable, { type RowInput } from "jspdf-autotable";
import { formatAmountPlain, netDirection } from "./calc";
import {
  APPROVAL_STATUS_LABELS,
  EXPENSE_DOCUMENT_ARCHIVED_MESSAGE,
  EXPENSE_STATUS_LABELS,
  ROUND_STATUS_LABELS,
  SETTLEMENT_TYPE_LABELS,
  expenseDepartmentLabel,
  type ExpenseStatus,
} from "./constants";
import type { ExpenseDetail } from "./data";
import { ExpenseError } from "./validation";

type RGB = [number, number, number];

const ORANGE: RGB = [245, 124, 40];
const ORANGE_SOFT: RGB = [255, 243, 233];
const INK: RGB = [31, 41, 55];
const MUTED: RGB = [107, 114, 128];
const LINE: RGB = [229, 231, 235];
const SOFT: RGB = [249, 250, 251];

const M = 40; // sayfa kenar boşluğu (pt)
const HEADER_H = 68; // başlık alt çizgisinin y'si
const FOOTER_SPACE = 48;
/** Belge sayfalarının işlenme çözünürlüğü: 2 → 144 dpi */
const RENDER_SCALE = 2;

// ── Kaynaklar (süreç boyunca bir kez okunur) ─────────────────────────────────

interface Fonts {
  regular: string;
  bold: string;
}

let fontsPromise: Promise<Fonts | null> | null = null;

function loadFonts(): Promise<Fonts | null> {
  fontsPromise ??= (async () => {
    const dir = path.join(process.cwd(), "node_modules", "pdfjs-dist", "standard_fonts");
    try {
      const [regular, bold] = await Promise.all([
        readFile(path.join(dir, "LiberationSans-Regular.ttf")),
        readFile(path.join(dir, "LiberationSans-Bold.ttf")),
      ]);
      return { regular: regular.toString("base64"), bold: bold.toString("base64") };
    } catch {
      return null;
    }
  })();
  return fontsPromise;
}

/**
 * Vezin işareti — logodaki üç eğik çubuk, vektör olarak (public/ altındaki
 * logolar 1024×1024 kare ve geniş boşluklu; PDF'e raster gömmek boyutu şişirir).
 * Koordinatlar logo görselinin 1024'lük ızgarasından alındı.
 */
const VEZIN_MARK: { color: RGB; points: [number, number][] }[] = [
  { color: [95, 95, 95], points: [[187, 440], [242, 367], [270, 384], [213, 478]] },
  { color: [213, 15, 26], points: [[220, 490], [322, 350], [365, 378], [252, 532]] },
  { color: [243, 138, 26], points: [[270, 565], [425, 350], [490, 376], [312, 618]] },
];
const VEZIN_GRAY: RGB = [85, 85, 85];

function drawVezinMark(doc: jsPDF, x: number, y: number, height: number) {
  const [minX, minY, maxY] = [187, 350, 618];
  const s = height / (maxY - minY);
  for (const bar of VEZIN_MARK) {
    const [first, ...rest] = bar.points.map(([px, py]) => [x + (px - minX) * s, y + (py - minY) * s] as const);
    const segments = rest.map(([px, py], i) => {
      const prev = i === 0 ? first : rest[i - 1];
      return [px - prev[0], py - prev[1]];
    });
    doc.setFillColor(...bar.color);
    doc.lines(segments, first[0], first[1], [1, 1], "F", true);
  }
}

// ── Biçimlendirme ────────────────────────────────────────────────────────────

const ASCII_FALLBACK: Record<string, string> = { ğ: "g", Ğ: "G", ş: "s", Ş: "S", ı: "i", İ: "I" };

function money(amount: number): string {
  return `${formatAmountPlain(amount)} TL`;
}

/** Satır / işlem tarihi — DB'de UTC gece yarısı, gün kaymasın diye UTC gösterilir. */
function fmtDay(d: Date | null | undefined): string {
  if (!d) return "—";
  return d.toLocaleDateString("tr-TR", { timeZone: "UTC", day: "2-digit", month: "2-digit", year: "numeric" });
}

function fmtDate(d: Date | null | undefined): string {
  if (!d) return "—";
  return d.toLocaleDateString("tr-TR", { timeZone: "Europe/Istanbul", day: "2-digit", month: "2-digit", year: "numeric" });
}

function fmtDateTime(d: Date | null | undefined): string {
  if (!d) return "—";
  return d.toLocaleString("tr-TR", {
    timeZone: "Europe/Istanbul",
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function netLabel(net: number): string {
  const dir = netDirection(net);
  if (dir === "RECEIVABLE") return "Vezin personele ödeyecek";
  if (dir === "REFUND") return "Personel Vezin'e iade edecek";
  return "Mahsup — ödeme/iade yok";
}

function lastY(doc: jsPDF): number {
  return (doc as unknown as { lastAutoTable: { finalY: number } }).lastAutoTable.finalY;
}

// ── Form PDF'i ───────────────────────────────────────────────────────────────

async function drawForm(doc: jsPDF, detail: ExpenseDetail): Promise<number> {
  const fonts = await loadFonts();
  let font = "helvetica";
  if (fonts) {
    doc.addFileToVFS("LiberationSans-Regular.ttf", fonts.regular);
    doc.addFont("LiberationSans-Regular.ttf", "LiberationSans", "normal");
    doc.addFileToVFS("LiberationSans-Bold.ttf", fonts.bold);
    doc.addFont("LiberationSans-Bold.ttf", "LiberationSans", "bold");
    font = "LiberationSans";
  }
  const t = (s: string) => (fonts ? s : s.replace(/[ğĞşŞıİ]/g, (c) => ASCII_FALLBACK[c]));

  const pageW = doc.internal.pageSize.getWidth();
  const pageH = doc.internal.pageSize.getHeight();
  const contentW = pageW - 2 * M;
  const tableBase = {
    theme: "grid" as const,
    margin: { left: M, right: M, top: M, bottom: FOOTER_SPACE },
    styles: { font, fontSize: 8.5, cellPadding: 4, textColor: INK, lineColor: LINE, lineWidth: 0.5, overflow: "linebreak" as const },
    headStyles: { fillColor: ORANGE, textColor: 255, fontStyle: "bold" as const },
  };
  const tr = (rows: string[][]): RowInput[] => rows.map((r) => r.map(t));

  // ── Kurumsal başlık: Vezin işareti (vektör) + unvan, sağda form başlığı
  drawVezinMark(doc, M, 20, 36);
  doc.setFont(font, "normal");
  doc.setFontSize(22);
  doc.setTextColor(...VEZIN_GRAY);
  doc.text(t("VEZİN"), M + 50, 44, { charSpace: 2.5 });
  doc.setFontSize(7.5);
  doc.setTextColor(...MUTED);
  doc.text(t("Vergi · Denetim · Danışmanlık"), M + 50, 56);
  doc.setFont(font, "bold");
  doc.setFontSize(14);
  doc.setTextColor(...INK);
  doc.text(t("PERSONEL HARCAMA FORMU"), pageW - M, 36, { align: "right" });
  doc.setFontSize(10.5);
  doc.setTextColor(...ORANGE);
  doc.text(detail.formNo, pageW - M, 53, { align: "right" });
  doc.setDrawColor(...ORANGE);
  doc.setLineWidth(2);
  doc.line(M, HEADER_H, pageW - M, HEADER_H);

  // ── Form bilgileri
  const status = EXPENSE_STATUS_LABELS[detail.status as ExpenseStatus] ?? detail.status;
  autoTable(doc, {
    ...tableBase,
    startY: HEADER_H + 20,
    body: tr([
      ["Form No", detail.formNo, "Form Tarihi", fmtDate(detail.createdAt)],
      ["Personel", detail.ownerName, "Departman", expenseDepartmentLabel(detail.department)],
      ["Ünvan", detail.title || "—", "Form Durumu", status],
      ["İlk Gönderim", fmtDateTime(detail.firstSubmittedAt), "Son İşlem", fmtDateTime(detail.lastActionAt)],
    ]),
    columnStyles: {
      0: { cellWidth: 80, fillColor: SOFT, textColor: MUTED },
      1: { fontStyle: "bold" },
      2: { cellWidth: 80, fillColor: SOFT, textColor: MUTED },
      3: { fontStyle: "bold" },
    },
  });
  let y = lastY(doc);

  const sectionTitle = (title: string, needed = 60) => {
    if (y + needed > pageH - FOOTER_SPACE) {
      doc.addPage();
      y = M - 10;
    }
    y += 22;
    doc.setFillColor(...ORANGE);
    doc.rect(M, y - 8, 3, 10, "F");
    doc.setFont(font, "bold");
    doc.setFontSize(10.5);
    doc.setTextColor(...INK);
    doc.text(t(title), M + 8, y);
    y += 6;
  };

  if (detail.note) {
    sectionTitle("Genel Açıklama / Not");
    doc.setFont(font, "normal");
    doc.setFontSize(9);
    doc.setTextColor(...INK);
    const lines = doc.splitTextToSize(t(detail.note), contentW) as string[];
    for (const line of lines) {
      if (y + 12 > pageH - FOOTER_SPACE) {
        doc.addPage();
        y = M;
      }
      y += 12;
      doc.text(line, M, y);
    }
  }

  // ── Harcama satırları
  sectionTitle(`Harcama Satırları (${detail.items.length})`, 80);
  autoTable(doc, {
    ...tableBase,
    startY: y + 4,
    head: tr([["#", "Tarih", "Harcama Konusu", "Firma / Harcama Yeri", "Açıklama", "Müşteri / Proje", "Tutar"]]),
    body: detail.items.map((i, idx) =>
      [String(idx + 1), fmtDay(i.date), i.subject, i.vendor, i.description, i.clientProject || "—", money(i.amount)].map(t)
    ),
    foot: [[{ content: t("Genel Toplam"), colSpan: 6, styles: { halign: "right" } }, { content: money(detail.totalAmount), styles: { halign: "right" } }]],
    didParseCell: (data) => {
      if (data.section === "head" && data.column.index === 6) data.cell.styles.halign = "right";
    },
    showFoot: "lastPage",
    footStyles: { fillColor: ORANGE_SOFT, textColor: INK, fontStyle: "bold" },
    alternateRowStyles: { fillColor: [252, 252, 253] },
    columnStyles: {
      0: { cellWidth: 20, halign: "center", textColor: MUTED },
      1: { cellWidth: 56 },
      6: { cellWidth: 74, halign: "right" },
    },
  });
  y = lastY(doc);

  // ── Toplamlar
  sectionTitle("Toplamlar", 90);
  const totalsW = 300;
  autoTable(doc, {
    ...tableBase,
    startY: y + 4,
    margin: { ...tableBase.margin, left: pageW - M - totalsW },
    tableWidth: totalsW,
    body: [
      [t("Genel Toplam"), money(detail.totalAmount)],
      [t("Nakit Avans"), money(detail.cashAdvance)],
      [t("Net Sonuç"), `${money(detail.netAmount)}\n${t(netLabel(detail.netAmount))}`],
    ],
    columnStyles: {
      0: { cellWidth: 110, fillColor: SOFT, textColor: MUTED },
      1: { halign: "right", fontStyle: "bold" },
    },
    didParseCell: (data) => {
      if (data.section === "body" && data.row.index === 2) {
        data.cell.styles.fillColor = ORANGE_SOFT;
        data.cell.styles.fontStyle = "bold";
        data.cell.styles.textColor = INK;
      }
    },
  });
  y = lastY(doc);

  // ── Departman onayı (güncel tur)
  sectionTitle("Departman Onayı", 70);
  const round = detail.rounds[detail.rounds.length - 1];
  if (!round) {
    doc.setFont(font, "normal");
    doc.setFontSize(9);
    doc.setTextColor(...MUTED);
    y += 14;
    doc.text(t("Form henüz onaya gönderilmedi."), M, y);
  } else if (round.bypassed) {
    autoTable(doc, {
      ...tableBase,
      startY: y + 4,
      body: tr([
        [
          `Tur ${round.roundNumber}`,
          "Departman onayı atlandı — gönderen, departmanın tanımlı onaycısı",
          fmtDateTime(round.submittedAt),
        ],
      ]),
      columnStyles: { 0: { cellWidth: 50, textColor: MUTED }, 2: { cellWidth: 100 } },
    });
    y = lastY(doc);
  } else {
    const rows: string[][] = round.approvals
      .filter((a) => a.status !== "REPLACED")
      .map((a) => [a.approverName, APPROVAL_STATUS_LABELS[a.status] ?? a.status, fmtDateTime(a.decidedAt)]);
    if (round.adminOverride && round.closedAt) {
      rows.push([
        `${round.closedByName ?? "Admin"} (Admin)`,
        round.status === "APPROVED" ? "Departman aşamasını onayladı" : "Departman aşamasını reddetti",
        fmtDateTime(round.closedAt),
      ]);
    }
    autoTable(doc, {
      ...tableBase,
      startY: y + 4,
      head: tr([
        [
          `Onaycı — Tur ${round.roundNumber} · ${round.approvedCount}/${round.requiredCount} · ${ROUND_STATUS_LABELS[round.status] ?? round.status}`,
          "Durum",
          "Tarih",
        ],
      ]),
      body: tr(rows),
      columnStyles: { 1: { cellWidth: 110 }, 2: { cellWidth: 100 } },
    });
    y = lastY(doc);
  }

  // ── Muhasebe, ödeme/iade, belge
  sectionTitle("Muhasebe ve Kapanış", 90);
  let accounting = "—";
  if (round?.accountingStatus === "APPROVED") {
    accounting = `Onaylandı — ${round.accountingByName ?? "—"} · ${fmtDateTime(round.accountingAt)}`;
  } else if (round?.accountingStatus === "REJECTED") {
    accounting = `Reddedildi — ${round.accountingByName ?? "—"} · ${fmtDateTime(round.accountingAt)}${round.accountingNote ? `\n"${round.accountingNote}"` : ""}`;
  } else if (detail.status === "ACCOUNTING_APPROVAL") {
    accounting = "Muhasebe onayı bekleniyor";
  }

  const settlement = [...detail.settlements].reverse().find((s) => !s.revertedAt) ?? null;
  let settlementText: string | null = null;
  if (settlement) {
    settlementText =
      `${SETTLEMENT_TYPE_LABELS[settlement.type] ?? settlement.type} — ${money(settlement.amount)} · ` +
      `İşlem tarihi ${fmtDay(settlement.transactionDate)} · ${settlement.createdByName}` +
      (settlement.note ? `\n${settlement.note}` : "");
  } else if (detail.status === "PAYMENT_PENDING") {
    settlementText = `Ödeme bekleniyor — ${money(detail.netAmount)}`;
  } else if (detail.status === "REFUND_PENDING") {
    settlementText = `İade bekleniyor — ${money(-detail.netAmount)}`;
  }

  const archived = detail.archivedDocuments.find((d) => !d.replacedAt) ?? detail.archivedDocuments[0] ?? null;
  let documentText = "—";
  if (detail.activeDocument) {
    const d = detail.activeDocument;
    documentText = `${d.name} — yükleyen ${d.uploadedByName} · ${fmtDateTime(d.createdAt)}`;
  } else if (archived) {
    documentText =
      `${EXPENSE_DOCUMENT_ARCHIVED_MESSAGE}\n${archived.name} — yükleyen ${archived.uploadedByName} · ${fmtDateTime(archived.createdAt)}; ` +
      `kaldıran ${archived.deletedByName ?? "—"} · ${fmtDateTime(archived.deletedAt)}`;
  }

  const closing: string[][] = [["Muhasebe Onayı", accounting]];
  if (settlementText) closing.push(["Ödeme / İade", settlementText]);
  closing.push(["Harcama Belgesi", documentText]);
  autoTable(doc, {
    ...tableBase,
    startY: y + 4,
    body: tr(closing),
    columnStyles: { 0: { cellWidth: 110, fillColor: SOFT, textColor: MUTED } },
  });

  // ── Alt bilgi (yalnız form sayfaları)
  const formPages = doc.getNumberOfPages();
  const generated = fmtDateTime(new Date());
  for (let i = 1; i <= formPages; i++) {
    doc.setPage(i);
    doc.setDrawColor(...LINE);
    doc.setLineWidth(0.5);
    doc.line(M, pageH - 34, pageW - M, pageH - 34);
    doc.setFont(font, "normal");
    doc.setFontSize(7.5);
    doc.setTextColor(...MUTED);
    doc.text(t(`Vezin · Personel Harcama Formu · ${detail.formNo} · Oluşturulma ${generated}`), M, pageH - 22);
    doc.text(t(`Sayfa ${i} / ${formPages}`), pageW - M, pageH - 22, { align: "right" });
  }
  return formPages;
}

// ── Belge sayfalarını ekleme ─────────────────────────────────────────────────

/**
 * Yüklenen PDF'in her sayfasını, kendi boyutunda yeni bir sayfa olarak ekler.
 * Okunamayan/bozuk PDF → 422 (birleşik PDF üretilemez; form PDF'i ayrıca alınabilir).
 */
async function appendPdfPages(doc: jsPDF, pdfBuffer: Buffer): Promise<number> {
  const { pdf } = await import("pdf-to-img");
  let source: Awaited<ReturnType<typeof pdf>>;
  try {
    source = await pdf(pdfBuffer, { scale: RENDER_SCALE, renderParams: { background: "white" } });
  } catch {
    throw new ExpenseError(422, "Harcama belgesi PDF'i okunamadı; birleşik PDF oluşturulamadı. Form PDF'ini ayrıca indirebilirsiniz.");
  }
  try {
    for (let p = 1; p <= source.length; p++) {
      const png = await source.getPage(p);
      // PNG IHDR: genişlik/yükseklik 16. ve 20. bayttan başlar (piksel)
      const w = png.readUInt32BE(16) / RENDER_SCALE;
      const h = png.readUInt32BE(20) / RENDER_SCALE;
      doc.addPage([w, h], w > h ? "landscape" : "portrait");
      doc.addImage(png, "PNG", 0, 0, w, h, undefined, "FAST");
    }
    return source.length;
  } catch (e) {
    if (e instanceof ExpenseError) throw e;
    throw new ExpenseError(422, "Harcama belgesi PDF'i okunamadı; birleşik PDF oluşturulamadı. Form PDF'ini ayrıca indirebilirsiniz.");
  } finally {
    await source.destroy().catch(() => {});
  }
}

export interface ExpensePdfResult {
  buffer: Buffer;
  formPages: number;
  documentPages: number;
}

export async function renderExpenseFormPdf(
  detail: ExpenseDetail,
  opts: { documentPdf?: Buffer | null } = {}
): Promise<ExpensePdfResult> {
  const doc = new jsPDF({ unit: "pt", format: "a4", compress: true });
  doc.setProperties({
    title: `Personel Harcama Formu ${detail.formNo}`,
    subject: "Personel Harcama Formu",
    author: "Vezin",
    creator: "Vezin",
  });
  const formPages = await drawForm(doc, detail);
  const documentPages = opts.documentPdf ? await appendPdfPages(doc, opts.documentPdf) : 0;
  return { buffer: Buffer.from(doc.output("arraybuffer")), formPages, documentPages };
}
