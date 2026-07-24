import { NextRequest, NextResponse } from "next/server";
import { getToken } from "next-auth/jwt";
import { BYPASS_AUTH_ROLES } from "@/lib/auth-bypass";

export const dynamic = "force-dynamic";
export const maxDuration = 300;

export interface KarsitFatura {
  id: string;
  seri: string;
  siraNo: string;
  tarihFmt: string;   // DD.MM.YYYY
  tarihIso: string;   // YYYY-MM-DD
  unvan: string;
  vergiNo: string;
  cins: string;
  miktar: string;
  kdvHaricTutar: number;
  kdvOrani: number;
  kdvTutari: number;
  toplam: number;
  sourceFile: string;
}

// ── XML helpers (reused from indirilecek-liste) ────────────────────────────

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

function fmtDate(iso: string): string {
  const p = iso.split("-");
  return p.length === 3 ? `${p[2]}.${p[1]}.${p[0]}` : iso;
}

function parseId(id: string): { seri: string; siraNo: string } {
  const m = id.match(/^([A-Za-z]{1,3})(\d+)$/);
  if (m) return { seri: m[1].toUpperCase(), siraNo: m[2] };
  return { seri: "", siraNo: id };
}

// ── Parse single invoice (no filtering — include everything) ──────────────

function parseInvoice(xmlRaw: string, sourceFile: string): KarsitFatura | null {
  const xml = stripNs(xmlRaw);

  const id        = firstText(xml, "ID");
  const issueDate = firstText(xml, "IssueDate");
  if (!id || !issueDate) return null;

  // Supplier info
  const supplierBlock  = firstBlock(xml, "AccountingSupplierParty");
  const partyNameBlock = firstBlock(supplierBlock, "PartyName");
  const unvan          = decode(firstText(partyNameBlock, "Name") || firstText(supplierBlock, "Name"));
  const vergiNo        = firstText(supplierBlock, "CompanyID");

  // Header-level KDV
  const firstLineIdx    = xml.indexOf("<InvoiceLine");
  const headerPart      = firstLineIdx > -1 ? xml.slice(0, firstLineIdx) : xml;
  const taxTotalBlock   = firstBlock(headerPart, "TaxTotal") || firstBlock(xml, "TaxTotal");
  const taxSubtotalBlock = firstBlock(taxTotalBlock, "TaxSubtotal");
  const totalKdv        = toNum(firstText(taxTotalBlock, "TaxAmount"));
  const kdvOrani        = toNum(firstText(taxSubtotalBlock, "Percent"));

  // Invoice lines
  const lineBlocks = allBlocks(xml, "InvoiceLine");

  let cins: string;
  let miktar: string;

  if (lineBlocks.length === 0) {
    cins   = firstText(xml, "Description") || "—";
    miktar = "1 adet";
  } else if (lineBlocks.length === 1) {
    const lb        = lineBlocks[0];
    const itemBlock = firstBlock(lb, "Item");
    cins            = firstText(itemBlock, "Name") || firstText(lb, "Description") || "—";
    const miktarVal = firstText(lb, "InvoicedQuantity");
    const birim     = firstAttr(lb, "InvoicedQuantity", "unitCode");
    miktar          = `${toNum(miktarVal) || 1}${birim ? " " + birim : " adet"}`;
  } else {
    // multiple lines — collect cins from all, show "N kalem"
    const cinsList = lineBlocks.map(lb => {
      const itemBlock = firstBlock(lb, "Item");
      return firstText(itemBlock, "Name") || firstText(lb, "Description") || "";
    }).filter(Boolean);
    cins   = cinsList[0] || "—";
    miktar = `${lineBlocks.length} kalem`;
  }

  const kdvHaricTutar = toNum(firstText(headerPart, "TaxExclusiveAmount")) ||
    (lineBlocks.length > 0
      ? lineBlocks.reduce((s, lb) => s + toNum(firstText(lb, "LineExtensionAmount")), 0)
      : 0);

  const { seri, siraNo } = parseId(id);

  return {
    id,
    seri,
    siraNo,
    tarihFmt: fmtDate(issueDate),
    tarihIso: issueDate,
    unvan,
    vergiNo,
    cins,
    miktar,
    kdvHaricTutar,
    kdvOrani,
    kdvTutari: totalKdv,
    toplam: kdvHaricTutar + totalKdv,
    sourceFile,
  };
}

// ── Collect XML from files / ZIPs ─────────────────────────────────────────

async function collectXmlSources(files: File[]): Promise<Array<{ name: string; content: string }>> {
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
  const { role, department } = token as any;
  if (role !== "ADMIN" && department !== "YEMINLI_MALI_MUSAVIR" && department !== "MUHASEBE") {
    return NextResponse.json({ error: "Yetkisiz" }, { status: 403 });
  }

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

    const faturalar: KarsitFatura[] = [];
    const hatalar: string[] = [];

    for (const { name, content } of sources) {
      if (!content.includes("Invoice")) {
        hatalar.push(`${name}: Fatura değil`);
        continue;
      }
      try {
        const f = parseInvoice(content, name);
        if (f) {
          faturalar.push(f);
        } else {
          hatalar.push(`${name}: Ayrıştırılamadı`);
        }
      } catch (e: any) {
        hatalar.push(`${name}: ${e?.message ?? "Hata"}`);
      }
    }

    faturalar.sort((a, b) => a.tarihIso.localeCompare(b.tarihIso));

    return NextResponse.json({
      faturalar,
      hatalar,
      stats: {
        toplam: faturalar.length,
        hataliCount: hatalar.length,
        toplamKdvHaric: faturalar.reduce((s, f) => s + f.kdvHaricTutar, 0),
        toplamKdv: faturalar.reduce((s, f) => s + f.kdvTutari, 0),
      },
    });
  } catch (err: any) {
    console.error("[karsit-inceleme/parse-xml]", err);
    return NextResponse.json({ error: "İşlem hatası: " + (err?.message ?? "") }, { status: 500 });
  }
}
