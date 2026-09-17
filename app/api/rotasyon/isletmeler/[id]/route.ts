import { NextRequest, NextResponse } from "next/server";
import { getToken } from "next-auth/jwt";
import { prisma } from "@/lib/prisma";
import { canAccessRotasyon } from "@/lib/access";
import { isValidVknOrTckn } from "@/lib/rotasyon";

const isletmeInclude = {
  sozlesmeler: {
    include: { kadrolar: true },
    orderBy: { donem: "asc" as const },
  },
};

export async function GET(req: NextRequest, { params }: { params: { id: string } }) {
  const token = await getToken({ req, secret: process.env.NEXTAUTH_SECRET });
  if (!token) return NextResponse.json({ error: "Yetkisiz" }, { status: 401 });
  if (!canAccessRotasyon(token as any)) {
    return NextResponse.json({ error: "Bulunamadı" }, { status: 404 });
  }

  const isletme = await prisma.rotasyonIsletme.findFirst({
    where: { id: params.id, deletedAt: null },
    include: isletmeInclude,
  });
  if (!isletme) return NextResponse.json({ error: "Bulunamadı" }, { status: 404 });
  return NextResponse.json(isletme);
}

export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  const token = await getToken({ req, secret: process.env.NEXTAUTH_SECRET });
  if (!token) return NextResponse.json({ error: "Yetkisiz" }, { status: 401 });
  if (!canAccessRotasyon(token as any)) {
    return NextResponse.json({ error: "Bulunamadı" }, { status: 404 });
  }

  const existing = await prisma.rotasyonIsletme.findFirst({ where: { id: params.id, deletedAt: null } });
  if (!existing) return NextResponse.json({ error: "Bulunamadı" }, { status: 404 });

  const body = await req.json();
  const data: Record<string, unknown> = {};

  if (body.unvan !== undefined) {
    const unvan = (body.unvan as string).trim();
    if (!unvan) return NextResponse.json({ error: "Unvan zorunlu" }, { status: 400 });
    data.unvan = unvan;
  }
  if (body.vkn !== undefined) {
    const vkn = (body.vkn as string).trim();
    if (!isValidVknOrTckn(vkn)) {
      return NextResponse.json({ error: "VKN 10 haneli (VKN) veya 11 haneli (TCKN) olmalı" }, { status: 400 });
    }
    data.vkn = vkn;
  }
  if (body.oncekiDenetciIlkDonem !== undefined) {
    data.oncekiDenetciIlkDonem = body.oncekiDenetciIlkDonem != null ? Number(body.oncekiDenetciIlkDonem) : null;
  }
  if (body.oncekiDenetciSonDonem !== undefined) {
    data.oncekiDenetciSonDonem = body.oncekiDenetciSonDonem != null ? Number(body.oncekiDenetciSonDonem) : null;
  }
  if (body.not !== undefined) {
    data.not = (body.not as string | null)?.trim() || null;
  }

  try {
    const updated = await prisma.rotasyonIsletme.update({
      where: { id: params.id },
      data,
      include: isletmeInclude,
    });
    return NextResponse.json(updated);
  } catch (err: any) {
    if (err?.code === "P2002") {
      return NextResponse.json({ error: "Bu VKN ile kayıtlı bir işletme zaten var" }, { status: 409 });
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

  const existing = await prisma.rotasyonIsletme.findFirst({ where: { id: params.id, deletedAt: null } });
  if (!existing) return NextResponse.json({ error: "Bulunamadı" }, { status: 404 });

  await prisma.rotasyonIsletme.update({ where: { id: params.id }, data: { deletedAt: new Date() } });
  return NextResponse.json({ ok: true });
}
