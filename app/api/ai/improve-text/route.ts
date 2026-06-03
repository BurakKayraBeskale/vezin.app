import { NextRequest, NextResponse } from "next/server";
import { getToken } from "next-auth/jwt";
import { getOpenAI } from "@/lib/openai";

export const dynamic = "force-dynamic";

const SYSTEM_PROMPT = `Sen bir profesyonel metin editörüsün. Sana verilen görev açıklamasını:
- Türkçe noktalama ve yazım kurallarına uygun hale getir
- Daha profesyonel ve net bir dil kullan
- Anlam ve içeriği değiştirme, sadece ifadeyi düzelt
- Madde madde yazılmışsa madde yapısını koru
- Sadece düzenlenmiş metni döndür, açıklama veya yorum ekleme`;

export async function POST(req: NextRequest) {
  const token = await getToken({ req, secret: process.env.NEXTAUTH_SECRET });
  if (!token) return NextResponse.json({ error: "Yetkisiz" }, { status: 401 });

  const { text } = await req.json();
  if (!text?.trim()) return NextResponse.json({ error: "Metin boş olamaz" }, { status: 400 });

  const openai = getOpenAI();
  const completion = await openai.chat.completions.create({
    model: "gpt-5.4-nano",
    messages: [
      { role: "system", content: SYSTEM_PROMPT },
      { role: "user",   content: text },
    ],
    temperature: 0.3,
    max_completion_tokens: 1024,
  });

  const result = completion.choices[0]?.message?.content?.trim() ?? text;
  return NextResponse.json({ result });
}
