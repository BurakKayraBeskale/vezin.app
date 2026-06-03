import { NextRequest, NextResponse } from "next/server";
import { getToken } from "next-auth/jwt";
import { getOpenAI } from "@/lib/openai";
import { getAiPrompt } from "@/lib/ai-prompts";

export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  const token = await getToken({ req, secret: process.env.NEXTAUTH_SECRET });
  if (!token) return NextResponse.json({ error: "Yetkisiz" }, { status: 401 });

  const { text } = await req.json();
  if (!text?.trim()) return NextResponse.json({ error: "Metin boş olamaz" }, { status: 400 });

  const systemPrompt = await getAiPrompt("METIN_DUZENLEME");

  const openai = getOpenAI();
  const completion = await openai.chat.completions.create({
    model: "gpt-5.4-nano",
    messages: [
      { role: "system", content: systemPrompt },
      { role: "user",   content: text },
    ],
    temperature: 0.3,
    max_completion_tokens: 1024,
  });

  const raw = completion.choices[0]?.message?.content?.trim() ?? "";

  // Prompt JSON döndürüyor — parse et; başarısız olursa ham metni döndür
  try {
    const parsed = JSON.parse(raw);
    return NextResponse.json({ baslik: parsed.baslik ?? null, aciklama: parsed.aciklama ?? null, result: raw });
  } catch {
    return NextResponse.json({ result: raw });
  }
}
