import { NextRequest, NextResponse } from "next/server";
import { getToken } from "next-auth/jwt";
import openai from "@/lib/openai";

const MAX_SIZE = 10 * 1024 * 1024; // 10MB

const PROMPT = `Sen bir Türk muhasebe uzmanısın.
Sana verilen TXT dosyası bir mizan (trial balance) veya muhasebe raporu içeriyor.

ÇIKTI KURALLARI:
1. Sütun başlıklarını Türkçe yaz:
   - Hesap kodu → "Hesap Kodu"
   - Hesap adı/açıklaması → "Hesap Adı"
   - Tip (BASLIK/HESAP/ARA TOPLAM) → "Tip"
   - Seviye → "Seviye"
   - Para birimi → "Para"
   - Açılış bakiyesi → "Açılış Bakiyesi"
   - Borç/Debit → "Borç (Debit) TRY"
   - Alacak/Credit → "Alacak (Credit) TRY"
   - Kapanış bakiyesi/Total → "Kapanış Bakiyesi"

2. Türkçe karakterleri koru (ş,ğ,ü,ö,ç,ı)
3. Sayısal değerleri tam olarak al, kısaltma
4. BASLIK satırları: sadece Hesap Kodu ve Hesap Adı dolu
5. ARA TOPLAM satırları: "TOTAL XXX" formatında
6. Negatif değerleri eksi işaretiyle göster

JSON formatında döndür:
{
  "headers": ["Hesap Kodu", "Hesap Adı", "Tip", "Seviye", "Para", "Açılış Bakiyesi", "Borç (Debit) TRY", "Alacak (Credit) TRY", "Kapanış Bakiyesi"],
  "rows": [...]
}

Sadece JSON döndür, başka açıklama yazma.`;

export async function POST(req: NextRequest) {
  const token = await getToken({ req, secret: process.env.NEXTAUTH_SECRET });
  if (!token) {
    return NextResponse.json({ error: "Yetkisiz erişim" }, { status: 401 });
  }

  const { role, department } = token as any;
  if (role !== "ADMIN" && department !== "MUHASEBE") {
    return NextResponse.json({ error: "Bu işlem için yetkiniz yok" }, { status: 403 });
  }

  let text = "";

  const contentType = req.headers.get("content-type") ?? "";

  if (contentType.includes("multipart/form-data")) {
    let formData: FormData;
    try {
      formData = await req.formData();
    } catch {
      return NextResponse.json({ error: "Geçersiz istek formatı" }, { status: 400 });
    }

    const file = formData.get("file") as File | null;
    const rawText = formData.get("text") as string | null;

    if (file) {
      if (file.size > MAX_SIZE) {
        return NextResponse.json({ error: "Dosya boyutu 10MB'ı geçemez" }, { status: 400 });
      }
      text = await file.text();
    } else if (rawText) {
      text = rawText;
    } else {
      return NextResponse.json({ error: "Dosya veya metin bulunamadı" }, { status: 400 });
    }
  } else {
    const body = await req.json().catch(() => ({}));
    text = body.text ?? "";
  }

  if (!text.trim()) {
    return NextResponse.json({ error: "Metin içeriği boş" }, { status: 400 });
  }

  try {
    const response = await openai.chat.completions.create({
      model: "gpt-5.4-nano",
      messages: [
        {
          role: "user",
          content: `${PROMPT}\n\nMetin içeriği:\n${text.slice(0, 8000)}`,
        },
      ],
      response_format: { type: "json_object" },
      max_completion_tokens: 3000,
    });

    const raw = response.choices[0].message.content ?? "{}";
    const result = JSON.parse(raw);

    if (!Array.isArray(result.headers) || !Array.isArray(result.rows)) {
      return NextResponse.json({ error: "Metin tablo formatına dönüştürülemedi. Daha yapılandırılmış bir metin deneyin" }, { status: 422 });
    }

    return NextResponse.json(result);
  } catch (err: any) {
    console.error("[txt-to-excel]", err);
    if (err?.code === "invalid_api_key") {
      return NextResponse.json({ error: "OpenAI API anahtarı geçersiz" }, { status: 500 });
    }
    return NextResponse.json({ error: "Dönüştürme sırasında bir hata oluştu. Lütfen tekrar deneyin" }, { status: 500 });
  }
}
