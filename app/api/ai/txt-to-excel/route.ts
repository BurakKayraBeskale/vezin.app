import { NextRequest, NextResponse } from "next/server";
import { getToken } from "next-auth/jwt";
import openai from "@/lib/openai";

export const maxDuration = 60; // saniye — büyük dosyalar için timeout uzatma

const MAX_SIZE = 10 * 1024 * 1024; // 10MB
const CHUNK_SIZE = 10_000; // karakter başına chunk boyutu

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

/** Metni satır sınırlarına göre chunk'lara böl */
function splitIntoChunks(text: string, maxChars: number): string[] {
  if (text.length <= maxChars) return [text];

  const lines = text.split("\n");
  const chunks: string[] = [];
  let current = "";

  for (const line of lines) {
    // +1 for the newline character
    if (current.length > 0 && current.length + line.length + 1 > maxChars) {
      chunks.push(current);
      current = line;
    } else {
      current = current ? `${current}\n${line}` : line;
    }
  }
  if (current.trim()) chunks.push(current);

  return chunks;
}

/** OpenAI çağrısı — JSON parse hatası olursa conversation retry ile düzeltir */
async function callOpenAI(messages: { role: "user" | "assistant"; content: string }[]): Promise<any> {
  const response = await openai.chat.completions.create({
    model: "gpt-5.4-nano",
    messages,
    response_format: { type: "json_object" },
    max_completion_tokens: 16000,
  });

  const raw = response.choices[0].message.content ?? "{}";

  try {
    return JSON.parse(raw);
  } catch {
    // JSON geçersiz — modele conversation üzerinden düzeltme iste
    const retryResponse = await openai.chat.completions.create({
      model: "gpt-5.4-nano",
      messages: [
        ...messages,
        { role: "assistant", content: raw },
        {
          role: "user",
          content: "Verdiğin yanıt geçerli JSON değil. Sadece geçerli bir JSON objesi döndür, hiçbir açıklama veya markdown ekleme.",
        },
      ],
      response_format: { type: "json_object" },
      max_completion_tokens: 16000,
    });
    return JSON.parse(retryResponse.choices[0].message.content ?? "{}");
  }
}

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
    const chunks = splitIntoChunks(text, CHUNK_SIZE);
    let headers: string[] = [];
    let allRows: any[][] = [];

    for (let i = 0; i < chunks.length; i++) {
      const chunk = chunks[i];

      if (i === 0) {
        // İlk chunk: headers + rows birlikte belirle
        const result = await callOpenAI([
          { role: "user", content: `${PROMPT}\n\nMetin içeriği:\n${chunk}` },
        ]);

        if (!Array.isArray(result.headers) || !Array.isArray(result.rows)) {
          return NextResponse.json(
            { error: "Metin tablo formatına dönüştürülemedi. Daha yapılandırılmış bir metin deneyin" },
            { status: 422 }
          );
        }

        headers = result.headers;
        allRows = result.rows;
      } else {
        // Sonraki chunklar: aynı headerları kullan, sadece rows döndür
        const continuationPrompt = `Sen bir Türk muhasebe uzmanısın.
Aşağıdaki metin daha önce işlemeye başladığın mizanın devamıdır.
Sütun başlıkları zaten belirlendi: ${JSON.stringify(headers)}

Bu metin parçasındaki satırları aynı sütun sırasına göre dönüştür.
JSON formatında döndür: {"rows": [...]}
Sadece JSON döndür, başka açıklama yazma.`;

        const result = await callOpenAI([
          { role: "user", content: `${continuationPrompt}\n\nMetin devamı:\n${chunk}` },
        ]);

        if (Array.isArray(result.rows) && result.rows.length > 0) {
          allRows = [...allRows, ...result.rows];
        }
      }
    }

    if (!headers.length) {
      return NextResponse.json(
        { error: "Başlıklar çıkarılamadı. Dosya içeriğini kontrol edin" },
        { status: 422 }
      );
    }

    return NextResponse.json({ headers, rows: allRows });
  } catch (err: any) {
    console.error("[txt-to-excel]", err);
    if (err?.code === "invalid_api_key") {
      return NextResponse.json({ error: "OpenAI API anahtarı geçersiz" }, { status: 500 });
    }
    return NextResponse.json(
      { error: "Dönüştürme sırasında bir hata oluştu. Lütfen tekrar deneyin" },
      { status: 500 }
    );
  }
}
