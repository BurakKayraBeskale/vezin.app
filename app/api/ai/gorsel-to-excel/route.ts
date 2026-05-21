import { NextRequest, NextResponse } from "next/server";
import { getToken } from "next-auth/jwt";
import openai from "@/lib/openai";

const MAX_SIZE = 10 * 1024 * 1024; // 10MB

const PROMPT = `Bu görseldeki tüm verileri analiz et.
e-Devlet çıktısı, vergi levhası, banka ekstresi, SGK bildirge veya başka bir resmi belge olabilir.
Belge türünü tespit et.
İçindeki TÜM verileri tabloya dönüştür.
Başlıklar, tarihler, tutarlar, TC kimlik, vergi no gibi tüm alanları çıkar.
JSON formatında döndür:
{
  "belge_turu": "string",
  "headers": ["string"],
  "rows": [["any"]],
  "ozet": "string"
}
Türkçe karakterleri koru. Sadece JSON objesi döndür.`;

export async function POST(req: NextRequest) {
  const token = await getToken({ req, secret: process.env.NEXTAUTH_SECRET });
  if (!token) {
    return NextResponse.json({ error: "Yetkisiz erişim" }, { status: 401 });
  }

  const { role, department } = token as any;
  if (role !== "ADMIN" && department !== "BAGIMSIZ_DENETIM") {
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

  const allowedTypes = ["image/jpeg", "image/jpg", "image/png", "image/webp", "application/pdf"];
  if (!allowedTypes.includes(file.type)) {
    return NextResponse.json({ error: "Yalnızca JPG, PNG, WEBP veya PDF dosyaları desteklenmektedir" }, { status: 400 });
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
          image_url: { url: `data:${mimeType};base64,${base64}`, detail: "high" },
        },
      ];
    }

    const response = await openai.chat.completions.create({
      model: "gpt-5.4-nano",
      messages: [{ role: "user", content: messageContent }],
      response_format: { type: "json_object" },
      max_tokens: 4000,
    });

    const raw = response.choices[0].message.content ?? "{}";
    const result = JSON.parse(raw);

    if (!Array.isArray(result.headers) || !Array.isArray(result.rows)) {
      return NextResponse.json(
        { error: "Görsel analiz edildi ancak tablo yapısı çıkarılamadı. Daha net bir görsel deneyin" },
        { status: 422 }
      );
    }

    return NextResponse.json(result);
  } catch (err: any) {
    console.error("[gorsel-to-excel]", err);
    if (err?.code === "invalid_api_key") {
      return NextResponse.json({ error: "OpenAI API anahtarı geçersiz" }, { status: 500 });
    }
    return NextResponse.json(
      { error: "Görsel işlenirken bir hata oluştu. Lütfen tekrar deneyin" },
      { status: 500 }
    );
  }
}
