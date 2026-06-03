import { NextRequest, NextResponse } from "next/server";
import { getToken } from "next-auth/jwt";
import { getOpenAI } from "@/lib/openai";
import { getAiPrompt } from "@/lib/ai-prompts";

export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  const token = await getToken({ req, secret: process.env.NEXTAUTH_SECRET });
  if (!token) return NextResponse.json({ error: "Yetkisiz" }, { status: 401 });

  const { konu, not: kisaNot, ton } = await req.json();
  if (!konu?.trim()) return NextResponse.json({ error: "Konu zorunlu" }, { status: 400 });

  const userName = (token as any).name ?? "";
  const basePrompt = await getAiPrompt("MAIL_TASLAGI");
  const systemPrompt = `${basePrompt}\n\nMailin sonuna şu imzayı ekle, başka hiçbir placeholder kullanma:\n\nSaygılarımla,\n${userName}\nVezin Vergi · Denetim · Danışmanlık`;

  const userMessage = [
    `Ton: ${ton || "Resmi"}`,
    `Konu: ${konu.trim()}`,
    kisaNot?.trim() ? `Kısa Not: ${kisaNot.trim()}` : null,
  ]
    .filter(Boolean)
    .join("\n");

  const openai = getOpenAI();
  const completion = await openai.chat.completions.create({
    model: "gpt-5.4-nano",
    messages: [
      { role: "system", content: systemPrompt },
      { role: "user",   content: userMessage },
    ],
    temperature: 0.4,
    max_completion_tokens: 1000,
  });

  const result = completion.choices[0]?.message?.content?.trim() ?? "";
  return NextResponse.json({ result });
}
