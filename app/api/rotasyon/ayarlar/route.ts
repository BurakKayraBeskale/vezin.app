import { NextRequest, NextResponse } from "next/server";
import { getToken } from "next-auth/jwt";
import { prisma } from "@/lib/prisma";
import { canAccessRotasyon } from "@/lib/access";
import { VARSAYILAN_ROTASYON_AYARLARI } from "@/lib/rotasyon";

export async function GET(req: NextRequest) {
  const token = await getToken({ req, secret: process.env.NEXTAUTH_SECRET });
  if (!token) return NextResponse.json({ error: "Yetkisiz" }, { status: 401 });
  if (!canAccessRotasyon(token as any)) {
    return NextResponse.json({ error: "Bulunamadı" }, { status: 404 });
  }

  const ayar = await prisma.rotasyonAyar.upsert({
    where: { id: "singleton" },
    update: {},
    create: { id: "singleton", ...VARSAYILAN_ROTASYON_AYARLARI },
  });
  return NextResponse.json(ayar);
}

export async function PUT(req: NextRequest) {
  const token = await getToken({ req, secret: process.env.NEXTAUTH_SECRET });
  if (!token) return NextResponse.json({ error: "Yetkisiz" }, { status: 401 });
  if (!canAccessRotasyon(token as any)) {
    return NextResponse.json({ error: "Bulunamadı" }, { status: 404 });
  }

  const body = await req.json();
  const cariDonem = Number(body.cariDonem);
  const azamiSure = Number(body.azamiSure);
  const zorunluAra = Number(body.zorunluAra);
  const uyariEsigi = Number(body.uyariEsigi);

  if (!Number.isInteger(cariDonem) || cariDonem < 1900 || cariDonem > 2200) {
    return NextResponse.json({ error: "Geçersiz cari hesap dönemi" }, { status: 400 });
  }
  if (!Number.isInteger(azamiSure) || azamiSure < 1) {
    return NextResponse.json({ error: "Azami süre en az 1 yıl olmalı" }, { status: 400 });
  }
  if (!Number.isInteger(zorunluAra) || zorunluAra < 0) {
    return NextResponse.json({ error: "Zorunlu ara negatif olamaz" }, { status: 400 });
  }
  if (!Number.isInteger(uyariEsigi) || uyariEsigi < 1 || uyariEsigi > 4) {
    return NextResponse.json({ error: "Uyarı eşiği 1 ile 4 arasında olmalı" }, { status: 400 });
  }

  const ayar = await prisma.rotasyonAyar.upsert({
    where: { id: "singleton" },
    update: { cariDonem, azamiSure, zorunluAra, uyariEsigi },
    create: { id: "singleton", cariDonem, azamiSure, zorunluAra, uyariEsigi },
  });
  return NextResponse.json(ayar);
}
