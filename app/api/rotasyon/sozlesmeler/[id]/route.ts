import { NextRequest, NextResponse } from "next/server";
import { getToken } from "next-auth/jwt";
import { prisma } from "@/lib/prisma";
import { canAccessRotasyon } from "@/lib/access";
import { ROTASYON_SOZLESME_TURLERI, parseKadroInput, RotasyonKadroInput } from "@/lib/rotasyon";

const sozlesmeInclude = {
  isletme: { select: { id: true, unvan: true, vkn: true } },
  kadrolar: true,
};

export async function GET(req: NextRequest, { params }: { params: { id: string } }) {
  const token = await getToken({ req, secret: process.env.NEXTAUTH_SECRET });
  if (!token) return NextResponse.json({ error: "Yetkisiz" }, { status: 401 });
  if (!canAccessRotasyon(token as any)) {
    return NextResponse.json({ error: "Bulunamadı" }, { status: 404 });
  }

  const sozlesme = await prisma.rotasyonSozlesme.findUnique({
    where: { id: params.id },
    include: sozlesmeInclude,
  });
  if (!sozlesme) return NextResponse.json({ error: "Bulunamadı" }, { status: 404 });
  return NextResponse.json(sozlesme);
}

export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  const token = await getToken({ req, secret: process.env.NEXTAUTH_SECRET });
  if (!token) return NextResponse.json({ error: "Yetkisiz" }, { status: 401 });
  if (!canAccessRotasyon(token as any)) {
    return NextResponse.json({ error: "Bulunamadı" }, { status: 404 });
  }

  const existing = await prisma.rotasyonSozlesme.findUnique({ where: { id: params.id } });
  if (!existing) return NextResponse.json({ error: "Bulunamadı" }, { status: 404 });

  const body = await req.json();
  const data: Record<string, unknown> = {};

  if (body.sozlesmeNo !== undefined) {
    const sozlesmeNo = (body.sozlesmeNo as string).trim();
    if (!sozlesmeNo) return NextResponse.json({ error: "Sözleşme no zorunlu" }, { status: 400 });
    data.sozlesmeNo = sozlesmeNo;
  }
  if (body.donem !== undefined) {
    const donem = Number(body.donem);
    if (!Number.isInteger(donem) || donem < 1900 || donem > 2200) {
      return NextResponse.json({ error: "Geçersiz dönem" }, { status: 400 });
    }
    data.donem = donem;
  }
  if (body.tur !== undefined) {
    if (!(ROTASYON_SOZLESME_TURLERI as readonly string[]).includes(body.tur)) {
      return NextResponse.json({ error: "Geçersiz sözleşme türü" }, { status: 400 });
    }
    data.tur = body.tur;
  }
  if (body.not !== undefined) {
    data.not = (body.not as string | null)?.trim() || null;
  }

  let kadroData: RotasyonKadroInput[] | undefined;
  if (body.kadrolar !== undefined) {
    const result = parseKadroInput(body.kadrolar);
    if ("error" in result) return NextResponse.json({ error: result.error }, { status: 400 });
    kadroData = result.data;
  }

  try {
    const updated = await prisma.$transaction(async (tx) => {
      if (Object.keys(data).length > 0) {
        await tx.rotasyonSozlesme.update({ where: { id: params.id }, data });
      }
      if (kadroData) {
        await tx.rotasyonKadro.deleteMany({ where: { sozlesmeId: params.id } });
        await tx.rotasyonKadro.createMany({
          data: kadroData.map((k) => ({ ...k, sozlesmeId: params.id })),
        });
      }
      return tx.rotasyonSozlesme.findUnique({ where: { id: params.id }, include: sozlesmeInclude });
    });
    return NextResponse.json(updated);
  } catch (err: any) {
    if (err?.code === "P2002") {
      return NextResponse.json({ error: "Bu işletme için bu dönemde zaten bir sözleşme var" }, { status: 409 });
    }
    throw err;
  }
}

export async function DELETE(req: NextRequest, { params }: { params: { id: string } }) {
  const token = await getToken({ req, secret: process.env.NEXTAUTH_SECRET });
  if (!token) return NextResponse.json({ error: "Yetkisiz" }, { status: 401 });
  if (!canAccessRotasyon(token as any)) {
    return NextResponse.json({ error: "Bulunamadı" }, { status: 404 });
  }

  const existing = await prisma.rotasyonSozlesme.findUnique({ where: { id: params.id } });
  if (!existing) return NextResponse.json({ error: "Bulunamadı" }, { status: 404 });

  // RotasyonKadro.sozlesmeId onDelete:Cascade — kadrolar otomatik silinir
  await prisma.rotasyonSozlesme.delete({ where: { id: params.id } });
  return NextResponse.json({ ok: true });
}
