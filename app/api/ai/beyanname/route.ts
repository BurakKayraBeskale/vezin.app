import { NextRequest, NextResponse } from "next/server";
import { getToken } from "next-auth/jwt";
import { getOpenAI } from "@/lib/openai";
import { getAiPrompt } from "@/lib/ai-prompts";

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

  const allowedTypes = ["application/pdf", "image/jpeg", "image/jpg", "image/png", "image/webp"];
  if (!allowedTypes.includes(file.type)) {
    return NextResponse.json({ error: "Yalnızca PDF, JPG veya PNG dosyaları desteklenmektedir" }, { status: 400 });
  }

  const prompt = await getAiPrompt("BEYANNAME") + "\n\nYanıtını JSON formatında ver.";

  try {
    const base64 = Buffer.from(await file.arrayBuffer()).toString("base64");
    const mimeType = file.type as "application/pdf" | "image/jpeg" | "image/png" | "image/webp";
    const messageContent: any[] = [
      {
        type: "image_url",
        image_url: { url: `data:${mimeType};base64,${base64}` },
      },
      { type: "text", text: prompt },
    ];

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
