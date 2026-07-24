import { NextRequest, NextResponse } from "next/server";
import { getToken } from "next-auth/jwt";
import { BYPASS_AUTH_ROLES } from "@/lib/auth-bypass";

export const dynamic = "force-dynamic";
export const maxDuration = 300;

// ── Types ──────────────────────────────────────────────────────────────────

export interface InvoiceLine {
  cins: string;
  miktar: number;
  birim: string;
  kdvHaricTutar: number;
  kdvOrani: number;
  kdvTutari: number;
}

export interface ParsedInvoice {
  id: string;
  seri: string;
  siraNo: string;
  tarihIso: string;    // YYYY-MM-DD (for sorting)
  tarihFmt: string;    // DD.MM.YYYY (for display/Excel)
  donemi: string;      // YYYY/MM
  saticiUnvan: string;
  saticiVergiNo: string;
  kdvHaricTutar: number;
  kdvTutari: number;
  kdvOrani: number;
  tevkifatTutari: number;   // WithholdingTaxTotal/TaxAmount (0 if not present)
  tevkifatKodu: string;     // TaxTypeCode from TaxScheme (e.g. "606")
  tevkifatOrani: number;    // Percent within TaxSubtotal (e.g. 90)
  isTevkifat: boolean;      // InvoiceTypeCode=TEVKIFAT veya tevkifatTutari>0
  tevkifatUyari: boolean;   // herhangi bir doğrulama uyarısı varsa true
  uyarilar: string[];       // doğrulama uyarısı mesajları
  satirlar: InvoiceLine[];
  sourceFile: string;
}

export interface ExcludedInvoice {
  id: string;
  tarihFmt: string;
  saticiUnvan: string;
  neden: string;
  sourceFile: string;
}

// ── Minimal XML helpers (no external deps, strips UBL-TR namespaces) ───────

function stripNs(raw: string): string {
  // Strip UTF-8 BOM and namespace prefixes from tags
  return raw
    .replace(/^\uFEFF/, "")
    .replace(/<([A-Za-z][A-Za-z0-9_-]*):([A-Za-z][A-Za-z0-9_-]*)/g, "<$2")
    .replace(/<\/([A-Za-z][A-Za-z0-9_-]*):([A-Za-z][A-Za-z0-9_-]*)/g, "</$2");
}

function decode(s: string): string {
  return s
    .replace(/&amp;/g, "&").replace(/&lt;/g, "<").replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"').replace(/&apos;/g, "'")
    .replace(/&#(\d+);/g, (_, n) => String.fromCharCode(+n));
}

/** Text content of first matching tag */
function firstText(xml: string, tag: string): string {
  const re = new RegExp(`<${tag}(?:\\s[^>]*)?>([^<]*)<\\/${tag}>`, "s");
  const m  = xml.match(re);
  return m ? decode(m[1].trim()) : "";
}

/** Attribute value of first matching tag */
function firstAttr(xml: string, tag: string, attr: string): string {
  const re = new RegExp(`<${tag}[^>]*\\s${attr}="([^"]*)"`, "i");
  const m  = xml.match(re);
  return m ? m[1] : "";
}

/** Content of first <tag>...</tag> block (simple, no deep nesting) */
function firstBlock(xml: string, tag: string): string {
  const si = xml.indexOf(`<${tag}`);
  if (si === -1) return "";
  // Check this is the actual tag, not a prefix (next char must be > or space/newline)
  const nc = xml[si + tag.length + 1];
  if (nc && nc !== ">" && nc !== " " && nc !== "\n" && nc !== "\r" && nc !== "/") return "";
  const ei = xml.indexOf(`</${tag}>`, si);
  if (ei === -1) return "";
  return xml.slice(si, ei + `</${tag}>`.length);
}

/** All non-nested <tag>...</tag> blocks */
function allBlocks(xml: string, tag: string): string[] {
  const blocks: string[] = [];
  const openMark  = `<${tag}`;
  const closeMark = `</${tag}>`;
  let pos = 0;

  while (pos < xml.length) {
    const si = xml.indexOf(openMark, pos);
    if (si === -1) break;

    // Verify it's this exact tag (next char must be > or whitespace or /)
    const afterName = xml[si + openMark.length];
    if (afterName && afterName !== ">" && afterName !== " " && afterName !== "\n" && afterName !== "\r" && afterName !== "/") {
      pos = si + 1;
      continue;
    }

    let depth = 1;
    let i = si + openMark.length;
    let found = false;

    while (i < xml.length && depth > 0) {
      const no = xml.indexOf(openMark, i);
      const nc = xml.indexOf(closeMark, i);
      if (nc === -1) break;

      const validOpen = no !== -1 && (() => {
        const c = xml[no + openMark.length];
        return c === ">" || c === " " || c === "\n" || c === "\r" || c === "/";
      })();

      if (validOpen && no < nc) {
        depth++;
        i = no + openMark.length;
      } else {
        depth--;
        if (depth === 0) {
          blocks.push(xml.slice(si, nc + closeMark.length));
          pos = nc + closeMark.length;
          found = true;
        } else {
          i = nc + closeMark.length;
        }
      }
    }
    if (!found) break;
  }
  return blocks;
}

function toNum(s: string): number {
  return parseFloat(s.replace(/\s/g, "").replace(",", ".")) || 0;
}

// ── KDV / tevkifat kodu sınıflandırması ────────────────────────────────────

/** 9015 ve 601–699 aralığı: tevkifat kodları. Bunlar KDV değildir. */
function isTevkifatCode(code: string): boolean {
  const c = code.trim();
  if (c === "9015") return true;
  const n = parseInt(c, 10);
  return !isNaN(n) && n >= 601 && n <= 699;
}

/**
 * TaxTotal bloğunu KDV ve eski-usul tevkifat bileşenlerine ayırır.
 *
 * UBL-TR 1.2: TaxTotal/TaxAmount = tüm TaxSubtotal'ların toplamıdır.
 * Bazı entegratörler tevkifatı WithholdingTaxTotal yerine TaxTotal içinde
 * 9015 veya 601-606 koduyla gönderir. Bu fonksiyon onları ayırt eder.
 *
 * - TaxSubtotal yoksa: TaxTotal/TaxAmount'ı doğrudan KDV say (basit eski XML).
 * - TaxSubtotal varsa:
 *     isTevkifatCode(TaxTypeCode) → legacyTevkifat
 *     diğerleri ("0015", boş, vs.)→ KDV
 */
function parseTaxTotalBreakdown(taxTotalBlock: string): {
  kdv: number; kdvOrani: number;
  legacyTevkifat: number; legacyTevkifatKodu: string; legacyTevkifatOrani: number;
} {
  const empty = { kdv: 0, kdvOrani: 0, legacyTevkifat: 0, legacyTevkifatKodu: "", legacyTevkifatOrani: 0 };
  if (!taxTotalBlock) return empty;

  const subtotals = allBlocks(taxTotalBlock, "TaxSubtotal");

  // Alt satır yoksa TaxTotal/TaxAmount = doğrudan KDV (fallback)
  if (subtotals.length === 0) {
    return { ...empty, kdv: toNum(firstText(taxTotalBlock, "TaxAmount")) };
  }

  let kdv = 0, kdvOrani = 0;
  let legacyTevkifat = 0, legacyTevkifatKodu = "", legacyTevkifatOrani = 0;

  for (const sub of subtotals) {
    const catBlock = firstBlock(sub, "TaxCategory");
    const schBlock = firstBlock(catBlock || sub, "TaxScheme");
    const typeCode = firstText(schBlock || catBlock || sub, "TaxTypeCode").trim();
    const amount   = toNum(firstText(sub, "TaxAmount"));
    const pct      = toNum(firstText(sub, "Percent"));

    if (isTevkifatCode(typeCode)) {
      // Eski usul: tevkifat TaxTotal içinde ayrı bir TaxSubtotal olarak geliyor
      legacyTevkifat += amount;
      if (!legacyTevkifatKodu) { legacyTevkifatKodu = typeCode; legacyTevkifatOrani = pct; }
    } else {
      // "0015", "" (boş), "KDV" ya da bilinmeyen → KDV olarak say
      kdv += amount;
      if (kdvOrani === 0 && pct > 0) kdvOrani = pct;
    }
  }

  return { kdv, kdvOrani, legacyTevkifat, legacyTevkifatKodu, legacyTevkifatOrani };
}

/**
 * Tek bir InvoiceLine/TaxTotal bloğundan KDV tutarını ve oranını çıkarır.
 * Tevkifat kodlu TaxSubtotal'lar KDV toplamına dahil edilmez.
 */
function parseLineKdv(lineTaxBlock: string): { kdvTutari: number; kdvOrani: number } {
  if (!lineTaxBlock) return { kdvTutari: 0, kdvOrani: 0 };
  const subtotals = allBlocks(lineTaxBlock, "TaxSubtotal");
  if (subtotals.length === 0) {
    return { kdvTutari: toNum(firstText(lineTaxBlock, "TaxAmount")), kdvOrani: 0 };
  }
  let kdvTutari = 0, kdvOrani = 0;
  for (const sub of subtotals) {
    const catBlock = firstBlock(sub, "TaxCategory");
    const schBlock = firstBlock(catBlock || sub, "TaxScheme");
    const typeCode = firstText(schBlock || catBlock || sub, "TaxTypeCode").trim();
    if (!isTevkifatCode(typeCode)) {
      kdvTutari += toNum(firstText(sub, "TaxAmount"));
      if (kdvOrani === 0) kdvOrani = toNum(firstText(sub, "Percent"));
    }
  }
  return { kdvTutari, kdvOrani };
}

function fmtDate(iso: string): string {
  const p = iso.split("-");
  return p.length === 3 ? `${p[2]}.${p[1]}.${p[0]}` : iso;
}

function kdvDonemi(iso: string): string {
  const p = iso.split("-");
  return p.length >= 2 ? `${p[0]}/${p[1]}` : iso;
}

function parseId(id: string): { seri: string; siraNo: string } {
  // e-Fatura ID'si bölünmez — seri boş, sıra no olduğu gibi kullanılır
  return { seri: "", siraNo: id };
}

// ── İhraç kayıtlı detection ────────────────────────────────────────────────

const IHRAC_CODES = new Set(["803"]);
const IHRAC_TEXTS = ["ihraç kayıtlı", "ihrac kayitli", "ihracat kayitli", "ihracat kayıtlı"];

function isIhracKayitli(xml: string): boolean {
  const lower = xml.toLowerCase();
  if (IHRAC_TEXTS.some(t => lower.includes(t))) return true;
  if (firstText(xml, "InvoiceTypeCode").toUpperCase() === "IHRACAT") return true;
  // Check AllowanceChargeReasonCode 803
  for (const block of allBlocks(xml, "AllowanceCharge")) {
    if (IHRAC_CODES.has(firstText(block, "AllowanceChargeReasonCode"))) return true;
  }
  // Check TaxExemptionReasonCode
  for (const block of allBlocks(xml, "TaxSubtotal")) {
    if (IHRAC_CODES.has(firstText(block, "TaxExemptionReasonCode"))) return true;
  }
  return false;
}

// ── WithholdingTaxTotal (tevkifat) parser ────────────────────────────────

function parseWithholdingTax(
  xml: string,
  headerPart: string,
): { tutari: number; kodu: string; orani: number } {
  // Inner helper — extract kodu+orani from any WithholdingTaxTotal block
  function wttMeta(blk: string) {
    const sub  = firstBlock(blk, "TaxSubtotal");
    const cat  = firstBlock(sub || blk, "TaxCategory");
    const sch  = firstBlock(cat || blk, "TaxScheme");
    return {
      kodu:  firstText(sch || cat || blk, "TaxTypeCode"),
      orani: toNum(firstText(sub || blk, "Percent")),
    };
  }

  // 1. Header-level WithholdingTaxTotal (before InvoiceLine) — takes precedence
  const headerWTT = firstBlock(headerPart, "WithholdingTaxTotal");
  if (headerWTT) {
    const tutari = toNum(firstText(headerWTT, "TaxAmount"));
    if (tutari > 0) return { tutari, ...wttMeta(headerWTT) };
  }

  // 2. Line-level: sum from InvoiceLine/WithholdingTaxTotal
  let tutari = 0; let kodu = ""; let orani = 0;
  for (const lb of allBlocks(xml, "InvoiceLine")) {
    const lwtt = firstBlock(lb, "WithholdingTaxTotal");
    if (!lwtt) continue;
    tutari += toNum(firstText(lwtt, "TaxAmount"));
    if (!kodu) { const m = wttMeta(lwtt); kodu = m.kodu; orani = m.orani; }
  }
  return { tutari, kodu, orani };
}

// ── Single invoice parser ──────────────────────────────────────────────────

function parseInvoice(
  xmlRaw: string,
  sourceFile: string,
): { invoice?: ParsedInvoice; excluded?: ExcludedInvoice } {
  const xml = stripNs(xmlRaw);

  const typeCode    = firstText(xml, "InvoiceTypeCode").toUpperCase();
  const id          = firstText(xml, "ID");
  const issueDate   = firstText(xml, "IssueDate");
  const tarihFmt    = fmtDate(issueDate);

  // Supplier info (within AccountingSupplierParty block)
  const supplierBlock  = firstBlock(xml, "AccountingSupplierParty");
  const partyNameBlock = firstBlock(supplierBlock, "PartyName");
  const saticiUnvan    = decode(firstText(partyNameBlock, "Name") || firstText(supplierBlock, "Name"));
  const saticiVergiNo  = firstText(supplierBlock, "CompanyID");

  const makeExcluded = (neden: string): ExcludedInvoice => ({
    id, tarihFmt, saticiUnvan, neden, sourceFile,
  });

  // ── Filter 1: İade faturası ──
  if (typeCode === "IADE") return { excluded: makeExcluded("İade Faturası") };

  // ── Header-level TaxTotal (before InvoiceLine blocks) ──
  // Find TaxTotal that appears before the first InvoiceLine
  const firstLineIdx = xml.indexOf("<InvoiceLine");
  const headerPart   = firstLineIdx > -1 ? xml.slice(0, firstLineIdx) : xml;
  const taxTotalBlock = firstBlock(headerPart, "TaxTotal") || firstBlock(xml, "TaxTotal");

  // KDV ve eski-usul tevkifatı TaxSubtotal düzeyinde ayırt et (kör toplama yok)
  const taxBreakdown = parseTaxTotalBreakdown(taxTotalBlock);
  const totalKdv     = taxBreakdown.kdv;
  const kdvOrani     = taxBreakdown.kdvOrani;

  // ── Filter 2: KDV = 0 ──
  if (totalKdv === 0) return { excluded: makeExcluded("KDV = 0") };

  // ── Filter 3: İhraç kayıtlı ──
  if (isIhracKayitli(xml)) return { excluded: makeExcluded("İhraç Kayıtlı") };

  // ── Tevkifat ─────────────────────────────────────────────────────────────
  // Önce açık WithholdingTaxTotal'a bak; yoksa TaxTotal içindeki eski usul tut.
  const wht = parseWithholdingTax(xml, headerPart);

  const tevkifatTutariRaw = wht.tutari > 0 ? wht.tutari : taxBreakdown.legacyTevkifat;
  const tevkifatKoduRaw   = wht.tutari > 0 ? wht.kodu   : taxBreakdown.legacyTevkifatKodu;
  const tevkifatOraniRaw  = wht.tutari > 0 ? wht.orani  : taxBreakdown.legacyTevkifatOrani;
  const isTevkifat        = typeCode === "TEVKIFAT" || tevkifatTutariRaw > 0;

  // ── Parse invoice lines ──
  const lineBlocks = allBlocks(xml, "InvoiceLine");
  let satirlar: InvoiceLine[] = lineBlocks.map(lb => {
    const itemBlock      = firstBlock(lb, "Item");
    const cins           = firstText(itemBlock, "Name") || firstText(lb, "Description") || "";
    const miktarStr      = firstText(lb, "InvoicedQuantity");
    const miktar         = toNum(miktarStr);
    const birim          = firstAttr(lb, "InvoicedQuantity", "unitCode");
    const kdvHaricTutar  = toNum(firstText(lb, "LineExtensionAmount"));

    const lineTaxTotal = firstBlock(lb, "TaxTotal");
    const { kdvTutari: lineKdvTutari, kdvOrani: lineKdvOrani } = parseLineKdv(lineTaxTotal);

    return { cins, miktar, birim, kdvHaricTutar, kdvOrani: lineKdvOrani, kdvTutari: lineKdvTutari };
  });

  // Fallback: if no lines parsed, create one synthetic line from header
  if (satirlar.length === 0) {
    const kdvHaricTutar = toNum(firstText(xml, "TaxExclusiveAmount"));
    satirlar = [{
      cins: "—",
      miktar: 1,
      birim: "",
      kdvHaricTutar,
      kdvOrani,
      kdvTutari: totalKdv,
    }];
  }

  const kdvHaricTutar = toNum(firstText(headerPart, "TaxExclusiveAmount")) ||
    satirlar.reduce((s, l) => s + l.kdvHaricTutar, 0);

  // ── Doğrulama kontrolleri ────────────────────────────────────────────────
  const legalBlock      = firstBlock(headerPart, "LegalMonetaryTotal");
  const taxInclusiveAmt = toNum(firstText(legalBlock, "TaxInclusiveAmount"));
  const payableAmt      = toNum(firstText(legalBlock, "PayableAmount"));
  const taxExclInLegal  = toNum(firstText(legalBlock, "TaxExclusiveAmount")) || kdvHaricTutar;

  const uyarilar: string[] = [];

  // 1. TaxInclusiveAmount − PayableAmount = tevkifat tutarı
  if (tevkifatTutariRaw > 0 && taxInclusiveAmt > 0 && payableAmt > 0) {
    const diff = Math.abs((taxInclusiveAmt - payableAmt) - tevkifatTutariRaw);
    if (diff > 0.02) {
      uyarilar.push(
        `TaxInclusiveAmount−PayableAmount (${(taxInclusiveAmt - payableAmt).toFixed(2)}) ≠ tevkifat (${tevkifatTutariRaw.toFixed(2)})`
      );
    }
  }

  // 2. KDV, faturanın toplam vergi alanını (TaxInclusiveAmt − TaxExclAmt) aşıyor
  if (taxInclusiveAmt > 0 && taxExclInLegal > 0) {
    const derivedAllTax = taxInclusiveAmt - taxExclInLegal;
    if (totalKdv > derivedAllTax + 0.5) {
      uyarilar.push(
        `KDV (${totalKdv.toFixed(2)}) toplam vergi alanını (${derivedAllTax.toFixed(2)}) aşıyor — çifte sayma riski`
      );
    }
  }

  // 3. KDV ≈ matrah × oran (tek oranlı faturalar için çapraz kontrol)
  if (kdvOrani > 0 && kdvHaricTutar > 0 && totalKdv > 0) {
    const expectedKdv = kdvHaricTutar * (kdvOrani / 100);
    const tolerance   = Math.max(0.5, totalKdv * 0.02);
    if (Math.abs(totalKdv - expectedKdv) > tolerance) {
      uyarilar.push(
        `KDV (${totalKdv.toFixed(2)}) matrah×oran beklentisiyle (${expectedKdv.toFixed(2)}) uyuşmuyor — karma oran veya hata`
      );
    }
  }

  const tevkifatUyari = uyarilar.length > 0;

  const { seri, siraNo } = parseId(id);

  return {
    invoice: {
      id, seri, siraNo,
      tarihIso: issueDate,
      tarihFmt,
      donemi: kdvDonemi(issueDate),
      saticiUnvan, saticiVergiNo,
      kdvHaricTutar,
      kdvTutari: totalKdv,
      kdvOrani,
      tevkifatTutari: tevkifatTutariRaw,
      tevkifatKodu:   tevkifatKoduRaw,
      tevkifatOrani:  tevkifatOraniRaw,
      isTevkifat,
      tevkifatUyari,
      uyarilar,
      satirlar,
      sourceFile,
    },
  };
}

// ── XML sources extraction (handles ZIP) ──────────────────────────────────

async function collectXmlSources(
  files: File[],
): Promise<Array<{ name: string; content: string }>> {
  const sources: Array<{ name: string; content: string }> = [];

  for (const file of files) {
    const lc = file.name.toLowerCase();

    if (lc.endsWith(".xml")) {
      const buf  = Buffer.from(await file.arrayBuffer());
      sources.push({ name: file.name, content: buf.toString("utf8") });
    } else if (lc.endsWith(".zip")) {
      const JSZip = require("jszip");
      const buf   = Buffer.from(await file.arrayBuffer());
      const zip   = await JSZip.loadAsync(buf);
      for (const [path, entry] of Object.entries(zip.files) as Array<[string, any]>) {
        if (!entry.dir && path.match(/\.xml$/i)) {
          const content = await entry.async("string");
          sources.push({ name: path.split("/").pop() || path, content });
        }
      }
    }
  }

  return sources;
}

// ── Route ─────────────────────────────────────────────────────────────────

export async function POST(req: NextRequest) {
  const token = await getToken({ req, secret: process.env.NEXTAUTH_SECRET });
  if (!token) return NextResponse.json({ error: "Yetkisiz erişim" }, { status: 401 });
  // DEBUG — gerçek token değerlerini logla (karşılaştırma tamamlanınca kaldır)
  const { email: _dbgEmail } = token as any;
  console.log('[auth] user:', _dbgEmail, '| role:', (token as any).role, '| dept:', (token as any).department, '| api:', req.nextUrl?.pathname ?? req.url);
  const { role } = token as any;
  if (!BYPASS_AUTH_ROLES && role !== "ADMIN") return NextResponse.json({ error: "Bu işlem için yetkiniz yok" }, { status: 403 });

  let formData: FormData;
  try { formData = await req.formData(); }
  catch { return NextResponse.json({ error: "Geçersiz istek formatı" }, { status: 400 }); }

  const files = formData.getAll("files[]") as File[];
  if (!files || files.length === 0)
    return NextResponse.json({ error: "En az bir dosya yükleyin" }, { status: 400 });

  for (const file of files) {
    const lc = file.name.toLowerCase();
    if (!lc.endsWith(".xml") && !lc.endsWith(".zip")) {
      return NextResponse.json({ error: `"${file.name}" desteklenmiyor (XML veya ZIP gerekli)` }, { status: 400 });
    }
    if (file.size > 50 * 1024 * 1024) {
      return NextResponse.json({ error: `"${file.name}" 50MB sınırını aşıyor` }, { status: 400 });
    }
  }

  try {
    const sources = await collectXmlSources(files);
    if (sources.length === 0)
      return NextResponse.json({ error: "İçinde XML dosyası bulunamadı" }, { status: 400 });

    const invoices: ParsedInvoice[]    = [];
    const excluded: ExcludedInvoice[]  = [];

    for (const { name, content } of sources) {
      // Quick check: is this actually an invoice XML?
      if (!content.includes("Invoice")) {
        excluded.push({ id: name, tarihFmt: "—", saticiUnvan: "—", neden: "Fatura değil", sourceFile: name });
        continue;
      }
      const { invoice, excluded: ex } = parseInvoice(content, name);
      if (invoice) invoices.push(invoice);
      if (ex)      excluded.push(ex);
    }

    // Sort by date ascending
    invoices.sort((a, b) => a.tarihIso.localeCompare(b.tarihIso));

    const totalKdvHaric = invoices.reduce((s, i) => s + i.kdvHaricTutar, 0);
    const totalKdv      = invoices.reduce((s, i) => s + i.kdvTutari, 0);

    return NextResponse.json({
      invoices,
      excluded,
      stats: {
        invoiceCount:  invoices.length,
        excludedCount: excluded.length,
        totalKdvHaric,
        totalKdv,
        tevkifatCount: invoices.filter(i => i.isTevkifat).length,
        totalTevkifat: invoices.reduce((s, i) => s + i.tevkifatTutari, 0),
        uyariCount:    invoices.filter(i => i.tevkifatUyari).length,
      },
    });
  } catch (err: any) {
    console.error("[kdv-iade/indirilecek-liste]", err);
    return NextResponse.json({ error: "İşlem hatası: " + (err?.message ?? "Bilinmeyen hata") }, { status: 500 });
  }
}
