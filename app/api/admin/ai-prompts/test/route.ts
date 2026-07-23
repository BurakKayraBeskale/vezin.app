import { NextRequest, NextResponse } from "next/server";
import { getToken } from "next-auth/jwt";
import { getOpenAI } from "@/lib/openai";
import { BYPASS_AUTH_ROLES } from "@/lib/auth-bypass";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

export async function POST(req: NextRequest) {
  const openai = getOpenAI();
  const token = await getToken({ req, secret: process.env.NEXTAUTH_SECRET });
  if (!token || (token as any).role !== "ADMIN") {
    return NextResponse.json({ error: "Yetkisiz erişim" }, { status: 401 });
  }

  const body = await req.json().catch(() => ({}));
  const { prompt, text } = body as { prompt?: string; text?: string };

  if (!prompt?.trim()) {
    return NextResponse.json({ error: "Prompt boş olamaz" }, { status: 400 });
  }
  if (!text?.trim()) {
    return NextResponse.json({ error: "Test metni boş olamaz" }, { status: 400 });
  }

  try {
    const response = await openai.chat.completions.create({
      model: "gpt-5.4-nano",
      messages: [
        { role: "user", content: `${prompt}\n\nYanıtını JSON formatında ver.\n\nTest içeriği:\n${text.slice(0, 4000)}` },
      ],
      response_format: { type: "json_object" },
      max_completion_tokens: 2000,
    });

    const raw = response.choices[0].message.content ?? "{}";
    try {
      return NextResponse.json({ result: JSON.parse(raw) });
    } catch {
      return NextResponse.json({ result: raw });
    }
  } catch (err: any) {
    return NextResponse.json(
      { error: err?.message ?? "GPT isteği başarısız" },
      { status: 500 }
    );
  }
}
