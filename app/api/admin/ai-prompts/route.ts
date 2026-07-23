import { NextRequest, NextResponse } from "next/server";
import { getToken } from "next-auth/jwt";
import { prisma } from "@/lib/prisma";
import { DEFAULT_PROMPTS, AiModule, MODULE_LABELS } from "@/lib/ai-prompts";
import { BYPASS_AUTH_ROLES } from "@/lib/auth-bypass";

export const dynamic = "force-dynamic";

const MODULES: AiModule[] = ["BEYANNAME", "TXT_EXCEL", "KARSILASTIRMA", "TARAYICI"];

export async function GET(req: NextRequest) {
  const token = await getToken({ req, secret: process.env.NEXTAUTH_SECRET });
  if (!token || (token as any).role !== "ADMIN") {
    return NextResponse.json({ error: "Yetkisiz erişim" }, { status: 401 });
  }

  const records = await prisma.aiPrompt.findMany();
  const byModule = Object.fromEntries(records.map((r) => [r.module, r]));

  const result = MODULES.map((module) => ({
    module,
    label: MODULE_LABELS[module],
    prompt: byModule[module]?.prompt ?? DEFAULT_PROMPTS[module],
    updatedAt: byModule[module]?.updatedAt ?? null,
    updatedBy: byModule[module]?.updatedBy ?? null,
    isCustom: !!byModule[module],
  }));

  return NextResponse.json(result);
}
