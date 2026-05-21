import { NextRequest, NextResponse } from "next/server";
import { getToken } from "next-auth/jwt";
import openai from "@/lib/openai";

const MAX_SIZE = 10 * 1024 * 1024; // 10MB

const PROMPT = `Bu metin dosyasındaki verileri analiz et ve yapılandırılmış tablo formatına dönüştür.
Sütun başlıklarını belirle, verileri satırlara yerleştir.
JSON formatında döndür: {"headers": ["Sütun1", "Sütun2", ...], "rows": [["değer1", "değer2", ...], ...]}
Sadece JSON objesi döndür, başka açıklama ekleme.`;

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
