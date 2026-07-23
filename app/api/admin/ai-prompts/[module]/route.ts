import { NextRequest, NextResponse } from "next/server";
import { getToken } from "next-auth/jwt";
import { prisma } from "@/lib/prisma";
import { DEFAULT_PROMPTS, AiModule } from "@/lib/ai-prompts";
import { BYPASS_AUTH_ROLES } from "@/lib/auth-bypass";

const VALID_MODULES: AiModule[] = ["BEYANNAME", "TXT_EXCEL", "KARSILASTIRMA", "TARAYICI", "METIN_DUZENLEME", "MAIL_TASLAGI", "BELGE_OZETI"];

export async function PATCH(
  req: NextRequest,
  { params }: { params: { module: string } }
) {
  const token = await getToken({ req, secret: process.env.NEXTAUTH_SECRET });
  if (!token || (token as any).role !== "ADMIN") {
    return NextResponse.json({ error: "Yetkisiz erişim" }, { status: 401 });
  }

  const module = params.module as AiModule;
  if (!VALID_MODULES.includes(module)) {
    return NextResponse.json({ error: "Geçersiz modül" }, { status: 400 });
  }

  const body = await req.json().catch(() => ({}));
  const prompt = body.prompt as string | undefined;
  if (!prompt?.trim()) {
    return NextResponse.json({ error: "Prompt boş olamaz" }, { status: 400 });
  }

  const record = await prisma.aiPrompt.upsert({
    where: { module },
    update: { prompt: prompt.trim(), updatedBy: (token as any).id },
    create: { module, prompt: prompt.trim(), updatedBy: (token as any).id },
  });

  return NextResponse.json(record);
}

/** Varsayılan prompt'a sıfırla */
export async function DELETE(
  req: NextRequest,
  { params }: { params: { module: string } }
) {
  const token = await getToken({ req, secret: process.env.NEXTAUTH_SECRET });
  if (!token || (token as any).role !== "ADMIN") {
    return NextResponse.json({ error: "Yetkisiz erişim" }, { status: 401 });
  }

  const module = params.module as AiModule;
  if (!VALID_MODULES.includes(module)) {
    return NextResponse.json({ error: "Geçersiz modül" }, { status: 400 });
  }

  await prisma.aiPrompt.deleteMany({ where: { module } });
  return NextResponse.json({ prompt: DEFAULT_PROMPTS[module], isCustom: false });
}
