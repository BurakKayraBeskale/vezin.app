import { NextRequest, NextResponse } from "next/server";
import { getToken } from "next-auth/jwt";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

function isAllowed(role: string, department: string) {
  return role === "ADMIN" || department === "YEMINLI_MALI_MUSAVIR" || department === "MUHASEBE";
}

export async function PATCH(
  req: NextRequest,
  { params }: { params: { id: string } },
) {
  const token = await getToken({ req, secret: process.env.NEXTAUTH_SECRET });
  if (!token) return NextResponse.json({ error: "Yetkisiz erişim" }, { status: 401 });
  // DEBUG — gerçek token değerlerini logla (karşılaştırma tamamlanınca kaldır)
  const { email: _dbgEmail } = token as any;
  console.log('[auth] user:', _dbgEmail, '| role:', (token as any).role, '| dept:', (token as any).department, '| api:', req.nextUrl?.pathname ?? req.url);
  const { role, department } = token as any;
  if (!isAllowed(role, department)) return NextResponse.json({ error: "Yetkisiz" }, { status: 403 });

  let body: any;
  try { body = await req.json(); }
  catch { return NextResponse.json({ error: "Geçersiz istek" }, { status: 400 }); }

  const { durum, gonderimTarihi, notlar, faturalar } = body;

  const updateData: any = {};
  if (durum !== undefined) updateData.durum = durum;
  if (gonderimTarihi !== undefined) updateData.gonderimTarihi = new Date(gonderimTarihi);
  if (notlar !== undefined) updateData.notlar = notlar;
  if (faturalar !== undefined) {
    updateData.faturalar = typeof faturalar === "string" ? faturalar : JSON.stringify(faturalar);
  }

  try {
    const record = await prisma.karsitInceleme.update({
      where: { id: params.id },
      data: updateData,
    });
    return NextResponse.json(record);
  } catch (err: any) {
    console.error("[karsit-inceleme PATCH]", err);
    return NextResponse.json({ error: "Güncelleme başarısız: " + (err?.message ?? "") }, { status: 500 });
  }
}

export async function DELETE(
  req: NextRequest,
  { params }: { params: { id: string } },
) {
  const token = await getToken({ req, secret: process.env.NEXTAUTH_SECRET });
  if (!token) return NextResponse.json({ error: "Yetkisiz erişim" }, { status: 401 });
  const { role, department } = token as any;
  if (!isAllowed(role, department)) return NextResponse.json({ error: "Yetkisiz" }, { status: 403 });

  try {
    await prisma.karsitInceleme.delete({ where: { id: params.id } });
    return NextResponse.json({ ok: true });
  } catch (err: any) {
    console.error("[karsit-inceleme DELETE]", err);
    return NextResponse.json({ error: "Silme başarısız: " + (err?.message ?? "") }, { status: 500 });
  }
}
