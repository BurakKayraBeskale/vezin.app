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

export async function GET(req: NextRequest) {
  const token = await getToken({ req, secret: process.env.NEXTAUTH_SECRET });
  if (!token) return NextResponse.json({ error: "Yetkisiz" }, { status: 401 });
  // Erişim kontrolü — kıdem/departman/e-postadan ASLA türetilmez, yalnızca ADMIN veya canAccessRotasyon
  if (!canAccessRotasyon(token as any)) {
    return NextResponse.json({ error: "Bulunamadı" }, { status: 404 });
  }

  const isletmeler = await prisma.rotasyonIsletme.findMany({
    where: { deletedAt: null },
    include: isletmeInclude,
    orderBy: { unvan: "asc" },
  });
  return NextResponse.json(isletmeler);
}

export async function POST(req: NextRequest) {
  const token = await getToken({ req, secret: process.env.NEXTAUTH_SECRET });
  if (!token) return NextResponse.json({ error: "Yetkisiz" }, { status: 401 });
  if (!canAccessRotasyon(token as any)) {
    return NextResponse.json({ error: "Bulunamadı" }, { status: 404 });
  }

  const body = await req.json();
  const unvan = (body.unvan as string | undefined)?.trim();
  const vkn = (body.vkn as string | undefined)?.trim();
  const oncekiDenetciIlkDonem = body.oncekiDenetciIlkDonem != null ? Number(body.oncekiDenetciIlkDonem) : null;
  const oncekiDenetciSonDonem = body.oncekiDenetciSonDonem != null ? Number(body.oncekiDenetciSonDonem) : null;
  const not = (body.not as string | undefined)?.trim() || null;

  if (!unvan) return NextResponse.json({ error: "Unvan zorunlu" }, { status: 400 });
  if (!vkn || !isValidVknOrTckn(vkn)) {
    return NextResponse.json({ error: "VKN 10 haneli (VKN) veya 11 haneli (TCKN) olmalı" }, { status: 400 });
  }

  try {
    const isletme = await prisma.rotasyonIsletme.create({
      data: { unvan, vkn, oncekiDenetciIlkDonem, oncekiDenetciSonDonem, not },
      include: isletmeInclude,
    });
    return NextResponse.json(isletme, { status: 201 });
  } catch (err: any) {
    if (err?.code === "P2002") {
      return NextResponse.json({ error: "Bu VKN ile kayıtlı bir işletme zaten var" }, { status: 409 });
    }
    throw err;
  }
}
