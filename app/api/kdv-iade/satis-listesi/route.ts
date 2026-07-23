import { NextRequest, NextResponse } from "next/server";
import { getToken } from "next-auth/jwt";
import { BYPASS_AUTH_ROLES } from "@/lib/auth-bypass";

export const dynamic = "force-dynamic";

// ── Types ──────────────────────────────────────────────────────────────────

export interface SatisInvoiceLine {
  cins: string;
  miktar: number;
  birim: string;
  kdvHaricTutar: number;
  kdvOrani: number;
  kdvTutari: number;
}

export interface SatisInvoice {
  id: string;
  seri: string;
  siraNo: string;
  tarihIso: string;
  tarihFmt: string;
  donemi: string;
  aliciUnvan: string;
  aliciVergiNo: string;
  kdvHaricTutar: number;
  kdvTutari: number;
  kdvOrani: number;
  tur: "Normal" | "İhraç Kayıtlı" | "KDV İstisnası";
  satirlar: SatisInvoiceLine[];
  sourceFile: string;
}

// ── XML Helpers (same approach as indirilecek-liste) ──────────────────────

function stripNs(raw: string): string {
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

function firstText(xml: string, tag: string): string {
  const re = new RegExp(`<${tag}(?:\\s[^>]*)?>([^<]*)<\\/${tag}>`, "s");
  const m  = xml.match(re);
  return m ? decode(m[1].trim()) : "";
}

function firstAttr(xml: string, tag: string, attr: string): string {
  const re = new RegExp(`<${tag}[^>]*\\s${attr}="([^"]*)"`, "i");
  const m  = xml.match(re);
  return m ? m[1] : "";
}

function firstBlock(xml: string, tag: string): string {
  const si = xml.indexOf(`<${tag}`);
  if (si === -1) return "";
  const nc = xml[si + tag.length + 1];
  if (nc && nc !== ">" && nc !== " " && nc !== "\n" && nc !== "\r" && nc !== "/") return "";
  const ei = xml.indexOf(`</${tag}>`, si);
  if (ei === -1) return "";
  return xml.slice(si, ei + `</${tag}>`.length);
}

function allBlocks(xml: string, tag: string): string[] {
  const blocks: string[] = [];
  const openMark  = `<${tag}`;
  const closeMark = `</${tag}>`;
  let pos = 0;
  while (pos < xml.length) {
    const si = xml.indexOf(openMark, pos);
    if (si === -1) break;
    const afterName = xml[si + openMark.length];
    if (afterName && afterName !== ">" && afterName !== " " && afterName !== "\n" && afterName !== "\r" && afterName !== "/") {
      pos = si + 1; continue;
    }
    let depth = 1, i = si + openMark.length, found = false;
    while (i < xml.length && depth > 0) {
      const no = xml.indexOf(openMark, i);
      const nc = xml.indexOf(closeMark, i);
      if (nc === -1) break;
      const validOpen = no !== -1 && (() => {
        const c = xml[no + openMark.length];
        return c === ">" || c === " " || c === "\n" || c === "\r" || c === "/";
      })();
      if (validOpen && no < nc) { depth++; i = no + openMark.length; }
      else {
        depth--;
        if (depth === 0) { blocks.push(xml.slice(si, nc + closeMark.length)); pos = nc + closeMark.length; found = true; }
        else { i = nc + closeMark.length; }
      }
    }
    if (!found) break;
  }
  return blocks;
}

function toNum(s: string): number {
  return parseFloat(s.replace(/\s/g, "").replace(",", ".")) || 0;
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
  const m = id.match(/^([A-Za-z]{1,3})(\d+)$/);
  if (m) return { seri: m[1].toUpperCase(), siraNo: m[2] };
  return { seri: "", siraNo: id };
}

const IHRAC_CODES = new Set(["803"]);
const IHRAC_TEXTS = ["ihraç kayıtlı", "ihrac kayitli", "ihracat kayitli", "ihracat kayıtlı"];

function isIhracKayitli(xml: string): boolean {
  const lower = xml.toLowerCase();
  if (IHRAC_TEXTS.some(t => lower.includes(t))) return true;
  if (firstText(xml, "InvoiceTypeCode").toUpperCase() === "IHRACAT") return true;
  for (const block of allBlocks(xml, "AllowanceCharge")) {
    if (IHRAC_CODES.has(firstText(block, "AllowanceChargeReasonCode"))) return true;
  }
  for (const block of allBlocks(xml, "TaxSubtotal")) {
    if (IHRAC_CODES.has(firstText(block, "TaxExemptionReasonCode"))) return true;
  }
  return false;
}

function isIstisna(xml: string, totalKdv: number): boolean {
  if (totalKdv > 0) return false;
  // KDV=0 — check if there's an exemption reason (not 803)
  for (const block of allBlocks(xml, "TaxSubtotal")) {
    const code = firstText(block, "TaxExemptionReasonCode");
    if (code && !IHRAC_CODES.has(code)) return true;
  }
  // KDV=0 with no specific reason code → treat as istisna
  return true;
}

// ── Sales invoice parser ──────────────────────────────────────────────────

function parseSatisInvoice(
  xmlRaw: string,
  sourceFile: string,
): SatisInvoice | null {
  const xml = stripNs(xmlRaw);

  const id        = firstText(xml, "ID");
  const issueDate = firstText(xml, "IssueDate");
  const tarihFmt  = fmtDate(issueDate);

  // Buyer info (AccountingCustomerParty)
  const customerBlock  = firstBlock(xml, "AccountingCustomerParty");
  const partyNameBlock = firstBlock(customerBlock, "PartyName");
  const aliciUnvan     = decode(firstText(partyNameBlock, "Name") || firstText(customerBlock, "Name"));
  const aliciVergiNo   = firstText(customerBlock, "CompanyID");

  // Header-level TaxTotal
  const firstLineIdx     = xml.indexOf("<InvoiceLine");
  const headerPart       = firstLineIdx > -1 ? xml.slice(0, firstLineIdx) : xml;
  const taxTotalBlock    = firstBlock(headerPart, "TaxTotal") || firstBlock(xml, "TaxTotal");
  const taxSubtotalBlock = firstBlock(taxTotalBlock, "TaxSubtotal");

  const totalKdv = toNum(firstText(taxTotalBlock, "TaxAmount"));
  const kdvOrani = toNum(firstText(taxSubtotalBlock, "Percent"));

  // Classification
  const ihrac   = isIhracKayitli(xml);
  const istisna = !ihrac && isIstisna(xml, totalKdv);
  const tur: SatisInvoice["tur"] = ihrac
    ? "İhraç Kayıtlı"
    : istisna
    ? "KDV İstisnası"
    : "Normal";

  // Lines
  const lineBlocks = allBlocks(xml, "InvoiceLine");
  let satirlar: SatisInvoiceLine[] = lineBlocks.map(lb => {
    const itemBlock     = firstBlock(lb, "Item");
    const cins          = firstText(itemBlock, "Name") || firstText(lb, "Description") || "";
    const miktarStr     = firstText(lb, "InvoicedQuantity");
    const miktar        = toNum(miktarStr);
    const birim         = firstAttr(lb, "InvoicedQuantity", "unitCode");
    const kdvHaricTutar = toNum(firstText(lb, "LineExtensionAmount"));
    const lineTaxTotal  = firstBlock(lb, "TaxTotal");
    const lineKdvTutari = toNum(firstText(lineTaxTotal, "TaxAmount"));
    const lineTaxSub    = firstBlock(lineTaxTotal, "TaxSubtotal");
    const lineKdvOrani  = toNum(firstText(lineTaxSub, "Percent"));
    return { cins, miktar, birim, kdvHaricTutar, kdvOrani: lineKdvOrani, kdvTutari: lineKdvTutari };
  });

  if (satirlar.length === 0) {
    const kdvHaricTutar = toNum(firstText(xml, "TaxExclusiveAmount"));
    satirlar = [{ cins: "—", miktar: 1, birim: "", kdvHaricTutar, kdvOrani, kdvTutari: totalKdv }];
  }

  const kdvHaricTutar = toNum(firstText(headerPart, "TaxExclusiveAmount")) ||
    satirlar.reduce((s, l) => s + l.kdvHaricTutar, 0);

  const { seri, siraNo } = parseId(id);

  return {
    id, seri, siraNo,
    tarihIso: issueDate, tarihFmt,
    donemi: kdvDonemi(issueDate),
    aliciUnvan, aliciVergiNo,
    kdvHaricTutar, kdvTutari: totalKdv, kdvOrani,
    tur, satirlar, sourceFile,
  };
}

// ── XML source collection ─────────────────────────────────────────────────

async function collectXmlSources(
  files: File[],
): Promise<Array<{ name: string; content: string }>> {
  const sources: Array<{ name: string; content: string }> = [];
  for (const file of files) {
    const lc = file.name.toLowerCase();
    if (lc.endsWith(".xml")) {
      const buf = Buffer.from(await file.arrayBuffer());
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
    if (!lc.endsWith(".xml") && !lc.endsWith(".zip"))
      return NextResponse.json({ error: `"${file.name}" desteklenmiyor (XML veya ZIP gerekli)` }, { status: 400 });
    if (file.size > 50 * 1024 * 1024)
      return NextResponse.json({ error: `"${file.name}" 50MB sınırını aşıyor` }, { status: 400 });
  }

  try {
    const sources = await collectXmlSources(files);
    if (sources.length === 0)
      return NextResponse.json({ error: "İçinde XML dosyası bulunamadı" }, { status: 400 });

    const invoices: SatisInvoice[] = [];
    const skipped: { name: string; reason: string }[] = [];

    for (const { name, content } of sources) {
      if (!content.includes("Invoice")) {
        skipped.push({ name, reason: "Fatura değil" });
        continue;
      }
      const inv = parseSatisInvoice(content, name);
      if (inv) invoices.push(inv);
      else skipped.push({ name, reason: "Ayrıştırılamadı" });
    }

    invoices.sort((a, b) => a.tarihIso.localeCompare(b.tarihIso));

    const totalKdvHaric = invoices.reduce((s, i) => s + i.kdvHaricTutar, 0);
    const totalKdv      = invoices.reduce((s, i) => s + i.kdvTutari, 0);

    return NextResponse.json({
      invoices,
      skipped,
      stats: {
        invoiceCount:   invoices.length,
        skippedCount:   skipped.length,
        ihracCount:     invoices.filter(i => i.tur === "İhraç Kayıtlı").length,
        istisnaCount:   invoices.filter(i => i.tur === "KDV İstisnası").length,
        totalKdvHaric,
        totalKdv,
      },
    });
  } catch (err: any) {
    console.error("[kdv-iade/satis-listesi]", err);
    return NextResponse.json({ error: "İşlem hatası: " + (err?.message ?? "") }, { status: 500 });
  }
}
