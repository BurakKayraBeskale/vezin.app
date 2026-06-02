import { NextRequest, NextResponse } from "next/server";
import { getToken } from "next-auth/jwt";
import { getOpenAI } from "@/lib/openai";
import { getAiPrompt } from "@/lib/ai-prompts";
import { extractText } from "unpdf";

export const dynamic = "force-dynamic";

const MAX_SIZE = 10 * 1024 * 1024; // 10MB

export async function POST(req: NextRequest) {
  const openai = getOpenAI();

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

  if (file.type !== "application/pdf") {
    return NextResponse.json({ error: "Yalnızca PDF dosyaları desteklenmektedir" }, { status: 400 });
  }

  const prompt = await getAiPrompt("BEYANNAME") + "\n\nYanıtını JSON formatında ver.";

  try {
    const bytes = await file.arrayBuffer();
    const buffer = new Uint8Array(bytes);
    const { text } = await extractText(buffer, { mergePages: true });

    if (!text?.trim()) {
      return NextResponse.json({ error: "PDF'den metin çıkarılamadı." }, { status: 400 });
    }

    const response = await openai.chat.completions.create({
      model: "gpt-5.4-nano",
      messages: [
        {
          role: "user",
          content: `${prompt}\n\nBelge içeriği:\n${text.slice(0, 8000)}`,
        },
      ],
      response_format: { type: "json_object" },
      temperature: 0,
      max_completion_tokens: 16000,
    });

    const raw = response.choices[0].message.content ?? "{}";
    console.log("[beyanname] Ham içerik:", raw?.slice(0, 500));

    let parsed: any;
    try {
      parsed = JSON.parse(raw);
    } catch {
      const cleaned = raw
        .replace(/[\x00-\x1F\x7F]/g, " ")
        .replace(/\n/g, "\\n")
        .replace(/\r/g, "\\r")
        .replace(/\t/g, "\\t");
      try {
        parsed = JSON.parse(cleaned);
      } catch {
        const match = raw.match(/\{[\s\S]*\}/);
        if (match) parsed = JSON.parse(match[0]);
        else throw new Error("JSON parse edilemedi");
      }
    }

    return NextResponse.json({ data: parsed });
  } catch (err: any) {
    console.error(
      "[beyanname] Hata:",
      err?.status, err?.code, err?.message,
      JSON.stringify(err?.error ?? err)
    );
    return NextResponse.json(
      {
        error: "Belge analiz edilirken bir hata oluştu.",
        debug: {
          status:  err?.status  ?? null,
          code:    err?.code    ?? null,
          message: err?.message ?? "Bilinmeyen hata",
          detail:  err?.error   ?? null,
        },
      },
      { status: err?.status ?? 500 }
    );
  }
}
