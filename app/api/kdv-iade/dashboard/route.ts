import { NextRequest, NextResponse } from "next/server";
import { getToken } from "next-auth/jwt";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const token = await getToken({ req, secret: process.env.NEXTAUTH_SECRET });
  if (!token) return NextResponse.json({ error: "Yetkisiz erişim" }, { status: 401 });

  try {
    const records = await prisma.kdvIadeKayit.findMany({
      orderBy: { createdAt: "desc" },
      take: 100,
    });

    const stats = {
      indirilen: { sayi: 0, kdv: 0 },
      yuklenilen: { sayi: 0, kdv: 0 },
      satis:     { sayi: 0, kdv: 0 },
    };

    for (const r of records) {
      const key = r.tur as keyof typeof stats;
      if (stats[key]) {
        stats[key].sayi += r.faturaSayisi;
        stats[key].kdv  += r.toplamKdv;
      }
    }

    return NextResponse.json({ records, stats });
  } catch (err: any) {
    console.error("[kdv-iade/dashboard GET]", err);
    return NextResponse.json({ error: err?.message ?? "Hata" }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  const token = await getToken({ req, secret: process.env.NEXTAUTH_SECRET });
  if (!token) return NextResponse.json({ error: "Yetkisiz erişim" }, { status: 401 });

  const body = await req.json().catch(() => ({}));
  const { tur, faturaSayisi, toplamKdv, haricTutulan } = body;

  if (!tur || faturaSayisi == null || toplamKdv == null)
    return NextResponse.json({ error: "Eksik alan" }, { status: 400 });

  try {
    const record = await prisma.kdvIadeKayit.create({
      data: {
        tur,
        faturaSayisi: Number(faturaSayisi),
        toplamKdv:    Number(toplamKdv),
        haricTutulan: Number(haricTutulan ?? 0),
      },
    });
    return NextResponse.json(record);
  } catch (err: any) {
    console.error("[kdv-iade/dashboard POST]", err);
    return NextResponse.json({ error: err?.message ?? "Hata" }, { status: 500 });
  }
}
