import { NextRequest, NextResponse } from "next/server";
import { getToken } from "next-auth/jwt";

export const dynamic = "force-dynamic";

interface KarsitFatura {
  id: string;
  seri: string;
  siraNo: string;
  tarihFmt: string;
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

function fmtTR(num: number): string {
  return num.toLocaleString("tr-TR", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function todayFormatted(): string {
  const d = new Date();
  const dd = String(d.getDate()).padStart(2, "0");
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const yy = d.getFullYear();
  return `${dd}.${mm}.${yy}`;
}

function buildHtml(body: any): string {
  const {
    mukellefUnvan = "",
    mukellefVkn   = "",
    mukellefVD    = "",
    ymmAdi        = "",
    ymmSicilNo    = "",
    ymmVergiNo    = "",
    konu          = "KDV_IADE",
    donemBas      = "",
    donemBit      = "",
    faturalar     = [] as KarsitFatura[],
  } = body;

  const konuLabel = konu === "TAM_TASDIK" ? "Tam Tasdik" : "KDV İadesi";

  const toplamKdvHaric = faturalar.reduce((s: number, f: KarsitFatura) => s + (f.kdvHaricTutar || 0), 0);
  const toplamKdv      = faturalar.reduce((s: number, f: KarsitFatura) => s + (f.kdvTutari || 0), 0);
  const genelToplam    = faturalar.reduce((s: number, f: KarsitFatura) => s + (f.toplam || 0), 0);

  const faturaRows = faturalar.map((f: KarsitFatura, i: number) => `
    <tr>
      <td style="text-align:center;">${i + 1}</td>
      <td>${f.tarihFmt || ""}</td>
      <td>${f.seri || ""}${f.siraNo || ""}</td>
      <td>${f.unvan || ""}</td>
      <td>${f.vergiNo || ""}</td>
      <td>${f.cins || ""}</td>
      <td>${f.miktar || ""}</td>
      <td style="text-align:right;">${fmtTR(f.kdvHaricTutar || 0)}</td>
      <td style="text-align:center;">${f.kdvOrani || 0}</td>
      <td style="text-align:right;">${fmtTR(f.kdvTutari || 0)}</td>
      <td style="text-align:right;">${fmtTR(f.toplam || 0)}</td>
    </tr>`).join("");

  return `<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <style>
    body {
      font-family: "Times New Roman", Times, serif;
      font-size: 11pt;
      margin: 2cm 2.5cm;
      color: #000;
    }
    h1 {
      text-align: center;
      font-size: 14pt;
      text-transform: uppercase;
      letter-spacing: 1px;
      margin-bottom: 6pt;
    }
    h2 {
      font-size: 11pt;
      margin-top: 18pt;
      margin-bottom: 4pt;
      border-bottom: 1px solid #000;
      padding-bottom: 2pt;
    }
    p, li {
      margin: 3pt 0;
      line-height: 1.5;
    }
    table.fatura-table {
      width: 100%;
      border-collapse: collapse;
      font-size: 9pt;
      margin-top: 8pt;
    }
    table.fatura-table th {
      background-color: #1F3864;
      color: #fff;
      padding: 4pt 3pt;
      text-align: center;
      border: 1px solid #ccc;
      font-size: 8pt;
    }
    table.fatura-table td {
      padding: 3pt 3pt;
      border: 1px solid #ccc;
      vertical-align: top;
    }
    table.fatura-table tr:nth-child(even) td {
      background-color: #f5f5f5;
    }
    table.fatura-table tr.toplam-row td {
      background-color: #F57C28;
      color: #fff;
      font-weight: bold;
      border: 1px solid #E06020;
    }
    .info-table {
      width: 100%;
      border-collapse: collapse;
      margin: 4pt 0 8pt 0;
    }
    .info-table td {
      padding: 2pt 4pt;
      vertical-align: top;
    }
    .info-table td:first-child {
      width: 220pt;
      font-weight: bold;
    }
    .imza-section {
      margin-top: 40pt;
      width: 100%;
    }
    .imza-box {
      display: inline-block;
      width: 45%;
      text-align: center;
      border-top: 1px solid #000;
      padding-top: 4pt;
      margin-top: 50pt;
    }
    .center { text-align: center; }
    .subtitle { text-align: center; font-size: 10pt; color: #444; margin-bottom: 20pt; }
    @page { size: A4 landscape; margin: 1.5cm 2cm; }
  </style>
</head>
<body>
  <h1>Karşıt İnceleme Tutanağı</h1>
  <p class="subtitle">Düzenleme Tarihi: ${todayFormatted()}</p>

  <h2>1. Nezdinde İnceleme Yapılan Mükellef</h2>
  <table class="info-table">
    <tr><td>Unvan:</td><td>${mukellefUnvan}</td></tr>
    <tr><td>Vergi Kimlik Numarası:</td><td>${mukellefVkn}</td></tr>
    <tr><td>Vergi Dairesi:</td><td>${mukellefVD}</td></tr>
  </table>

  <h2>2. İncelemeyi Yapan Yeminli Mali Müşavir</h2>
  <table class="info-table">
    <tr><td>Adı Soyadı:</td><td>${ymmAdi}</td></tr>
    <tr><td>Sicil No:</td><td>${ymmSicilNo}</td></tr>
    <tr><td>Vergi / TC Kimlik No:</td><td>${ymmVergiNo}</td></tr>
  </table>

  <h2>3. İncelemenin Konusu ve Dönemi</h2>
  <table class="info-table">
    <tr><td>Konu:</td><td>${konuLabel}</td></tr>
    <tr><td>İnceleme Dönemi:</td><td>${donemBas} — ${donemBit}</td></tr>
  </table>

  <h2>4. İncelemede Kullanılan Belgeler</h2>
  <table class="fatura-table">
    <thead>
      <tr>
        <th>Sıra No</th>
        <th>Fatura Tarihi</th>
        <th>Fatura No</th>
        <th>Düzenleyenin Unvanı</th>
        <th>VKN/TCKN</th>
        <th>Mal/Hizmet Cinsi</th>
        <th>Miktar</th>
        <th>KDV Hariç Tutar</th>
        <th>KDV Oranı (%)</th>
        <th>KDV Tutarı</th>
        <th>Toplam Tutar</th>
      </tr>
    </thead>
    <tbody>
      ${faturaRows}
      <tr class="toplam-row">
        <td colspan="7" style="text-align:right;">TOPLAM</td>
        <td style="text-align:right;">${fmtTR(toplamKdvHaric)} TL</td>
        <td></td>
        <td style="text-align:right;">${fmtTR(toplamKdv)} TL</td>
        <td style="text-align:right;">${fmtTR(genelToplam)} TL</td>
      </tr>
    </tbody>
  </table>

  <h2>5. Sonuç</h2>
  <table class="info-table">
    <tr><td>Toplam Fatura Sayısı:</td><td>${faturalar.length}</td></tr>
    <tr><td>KDV Hariç Toplam Tutar:</td><td>${fmtTR(toplamKdvHaric)} TL</td></tr>
    <tr><td>Toplam KDV Tutarı:</td><td>${fmtTR(toplamKdv)} TL</td></tr>
    <tr><td>Genel Toplam:</td><td>${fmtTR(genelToplam)} TL</td></tr>
  </table>

  <p style="margin-top:14pt;">
    Yukarıda belirtilen dönem ve konu kapsamında yapılan karşıt inceleme sonucunda
    alınan bilgiler tutanağa bağlanmıştır.
  </p>

  <table class="imza-section">
    <tr>
      <td style="width:50%; text-align:center; padding-top:60pt;">
        <div style="border-top:1px solid #000; padding-top:4pt; display:inline-block; min-width:200pt;">
          <strong>Yeminli Mali Müşavir</strong><br/>
          ${ymmAdi}<br/>
          Sicil No: ${ymmSicilNo}
        </div>
      </td>
      <td style="width:50%; text-align:center; padding-top:60pt;">
        <div style="border-top:1px solid #000; padding-top:4pt; display:inline-block; min-width:200pt;">
          <strong>Mükellef / Yetkili</strong><br/>
          ${mukellefUnvan}
        </div>
      </td>
    </tr>
  </table>
</body>
</html>`;
}

// ── Route ─────────────────────────────────────────────────────────────────

export async function POST(req: NextRequest) {
  const token = await getToken({ req, secret: process.env.NEXTAUTH_SECRET });
  if (!token) return NextResponse.json({ error: "Yetkisiz erişim" }, { status: 401 });
  const { role, department } = token as any;
  if (role !== "ADMIN" && department !== "YEMINLI_MALI_MUSAVIR" && department !== "MUHASEBE") {
    return NextResponse.json({ error: "Yetkisiz" }, { status: 403 });
  }

  let body: any;
  try { body = await req.json(); }
  catch { return NextResponse.json({ error: "Geçersiz istek" }, { status: 400 }); }

  try {
    const html = buildHtml(body);

    return new NextResponse(html, {
      status: 200,
      headers: {
        "Content-Type":        "application/msword",
        "Content-Disposition": 'attachment; filename="karsit-inceleme-tutanagi.doc"',
      },
    });
  } catch (err: any) {
    console.error("[karsit-inceleme/export-word]", err);
    return NextResponse.json({ error: "Belge oluşturulamadı: " + (err?.message ?? "") }, { status: 500 });
  }
}
