import { NextRequest, NextResponse } from "next/server";
import { getToken } from "next-auth/jwt";
import openai from "@/lib/openai";

const MAX_SIZE = 10 * 1024 * 1024; // 10MB

const PROMPT = `Sen bir Türk vergi ve muhasebe uzmanısın.
Sana verilen belgeyi analiz et ve türünü tespit et.

BELGE TÜRLERİ VE ÇIKARILACAK ALANLAR:

1. KDV BEYANNAMESİ:
- Mükellef adı/unvanı
- Vergi kimlik numarası
- Dönem (ay/yıl)
- Teslim ve hizmetlerin karşılığını teşkil eden bedel
- Hesaplanan KDV
- İndirilecek KDV
- Ödenmesi gereken KDV
- İade edilecek KDV
- Kısmi tevkifat bilgileri

2. MUHTASAR BEYANNAMESİ:
- Mükellef bilgileri
- Dönem
- Çalışan sayısı
- Ücret ödemeleri ve stopaj
- Serbest meslek stopajı
- Kira stopajı
- Diğer stopaj kalemleri
- Ödenecek vergi tutarı

3. GELİR VERGİSİ BEYANNAMESİ:
- Mükellef bilgileri
- Vergilendirme dönemi
- Gelir unsurları (ticari, zirai, serbest meslek vb.)
- Toplam gelir
- İndirimler
- Matrah
- Hesaplanan vergi
- Mahsup edilecek vergiler
- Ödenecek/iade vergi

4. KURUMLAR VERGİSİ BEYANNAMESİ:
- Kurum bilgileri
- Hesap dönemi
- Ticari bilanço karı/zararı
- KKEG (Kanunen Kabul Edilmeyen Giderler)
- İstisnalar
- Matrah
- Hesaplanan vergi
- Mahsup edilecek vergiler
- Ödenecek vergi

5. SGK BİLDİRGESİ:
- İşyeri bilgileri
- Dönem
- Sigortalı sayısı
- Prime esas kazanç
- İşçi payı
- İşveren payı
- Toplam prim

6. DAMGA VERGİSİ:
- Mükellef bilgileri
- Dönem
- Belge türleri ve tutarları
- Ödenecek damga vergisi

Belge türünü otomatik tespit et.
Tespit edemezsen "BELİRSİZ" yaz ve gördüğün tüm verileri çıkar.

ÇIKTI FORMATI (sadece JSON döndür, başka hiçbir şey yazma):
{
  "belge_turu": "KDV BEYANNAMESİ",
  "mukellef": "...",
  "vergi_no": "...",
  "donem": "...",
  "veriler": [
    {"alan": "Hesaplanan KDV", "deger": "1000.00", "birim": "TRY"},
    {"alan": "İndirilecek KDV", "deger": "500.00", "birim": "TRY"}
  ],
  "ozet": "Kısa açıklama"
}`;

export async function POST(req: NextRequest) {
  const token = await getToken({ req, secret: process.env.NEXTAUTH_SECRET });
  if (!token) {
    return NextResponse.json({ error: "Yetkisiz erişim" }, { status: 401 });
  }

  const { role, department } = token as any;
  if (role !== "ADMIN" && department !== "YEMINLI_MALI_MUSAVIR") {
    return NextResponse.json({ error: "Bu işlem için yetkiniz yok" }, { status: 403 });
  }

  let formData: FormData;
  try {
    formData = await req.formData();
  } catch {
    return NextResponse.json({ error: "Geçersiz istek formatı" }, { status: 400 });
  }

  const file = formData.get("file") as File | null;
  if (!file) {
    return NextResponse.json({ error: "Dosya bulunamadı" }, { status: 400 });
  }
  if (file.size > MAX_SIZE) {
    return NextResponse.json({ error: "Dosya boyutu 10MB'ı geçemez" }, { status: 400 });
  }

  const allowedTypes = ["application/pdf", "image/jpeg", "image/jpg", "image/png", "image/webp"];
  if (!allowedTypes.includes(file.type)) {
    return NextResponse.json({ error: "Yalnızca PDF, JPG veya PNG dosyaları desteklenmektedir" }, { status: 400 });
  }

  try {
    const buffer = Buffer.from(await file.arrayBuffer());
    let messageContent: any[];

    if (file.type === "application/pdf") {
      const pdfParse = require("pdf-parse");
      const pdfData = await pdfParse(buffer);
      if (!pdfData.text?.trim()) {
        return NextResponse.json({ error: "PDF'den metin çıkarılamadı. Lütfen görsel olarak yükleyin" }, { status: 400 });
      }
      messageContent = [
        {
          type: "text",
          text: `${PROMPT}\n\nBelge içeriği:\n${pdfData.text.slice(0, 8000)}`,
        },
      ];
    } else {
      const base64 = buffer.toString("base64");
      const mimeType = file.type as "image/jpeg" | "image/png" | "image/webp";
      messageContent = [
        { type: "text", text: PROMPT },
        {
          type: "image_url",
          image_url: {
            url: `data:${mimeType};base64,${base64}`,
            detail: "high",
          },
        },
      ];
    }

    const response = await openai.chat.completions.create({
      model: "gpt-5.4-nano",
      messages: [{ role: "user", content: messageContent }],
      response_format: { type: "json_object" },
      max_completion_tokens: 3000,
    });

    const raw = response.choices[0].message.content ?? "{}";
    const data = JSON.parse(raw);
    return NextResponse.json({ data });
  } catch (err: any) {
    console.error("[beyanname]", err);
    if (err?.code === "invalid_api_key") {
      return NextResponse.json({ error: "OpenAI API anahtarı geçersiz" }, { status: 500 });
    }
    return NextResponse.json({ error: "Belge analiz edilirken bir hata oluştu. Lütfen tekrar deneyin" }, { status: 500 });
  }
}
