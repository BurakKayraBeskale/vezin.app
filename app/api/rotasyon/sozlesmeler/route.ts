import { NextRequest, NextResponse } from "next/server";
import { getToken } from "next-auth/jwt";
import { prisma } from "@/lib/prisma";
import { canAccessRotasyon } from "@/lib/access";
import { ROTASYON_SOZLESME_TURLERI, parseKadroInput } from "@/lib/rotasyon";

const sozlesmeInclude = {
  isletme: { select: { id: true, unvan: true, vkn: true } },
  kadrolar: true,
};

export async function GET(req: NextRequest) {
  const token = await getToken({ req, secret: process.env.NEXTAUTH_SECRET });
  if (!token) return NextResponse.json({ error: "Yetkisiz" }, { status: 401 });
  if (!canAccessRotasyon(token as any)) {
    return NextResponse.json({ error: "Bulunamadı" }, { status: 404 });
  }

  const sozlesmeler = await prisma.rotasyonSozlesme.findMany({
    include: sozlesmeInclude,
    orderBy: [{ isletmeId: "asc" }, { donem: "asc" }],
  });
  return NextResponse.json(sozlesmeler);
}

export async function POST(req: NextRequest) {
  const token = await getToken({ req, secret: process.env.NEXTAUTH_SECRET });
  if (!token) return NextResponse.json({ error: "Yetkisiz" }, { status: 401 });
  if (!canAccessRotasyon(token as any)) {
    return NextResponse.json({ error: "Bulunamadı" }, { status: 404 });
  }

  const body = await req.json();
  const isletmeId = body.isletmeId as string | undefined;
  const sozlesmeNo = (body.sozlesmeNo as string | undefined)?.trim();
  const donem = Number(body.donem);
  const tur = body.tur as string | undefined;
  const not = (body.not as string | undefined)?.trim() || null;

  if (!isletmeId) return NextResponse.json({ error: "İşletme zorunlu" }, { status: 400 });
  if (!sozlesmeNo) return NextResponse.json({ error: "Sözleşme no zorunlu" }, { status: 400 });
  if (!Number.isInteger(donem) || donem < 1900 || donem > 2200) {
    return NextResponse.json({ error: "Geçersiz dönem" }, { status: 400 });
  }
  if (!tur || !(ROTASYON_SOZLESME_TURLERI as readonly string[]).includes(tur)) {
    return NextResponse.json({ error: "Geçersiz sözleşme türü" }, { status: 400 });
  }

  const kadroResult = parseKadroInput(body.kadrolar);
  if ("error" in kadroResult) return NextResponse.json({ error: kadroResult.error }, { status: 400 });

  const isletme = await prisma.rotasyonIsletme.findFirst({ where: { id: isletmeId, deletedAt: null } });
  if (!isletme) return NextResponse.json({ error: "İşletme bulunamadı" }, { status: 404 });

  try {
    const sozlesme = await prisma.rotasyonSozlesme.create({
      data: {
        isletmeId,
        sozlesmeNo,
        donem,
        tur,
        not,
        kadrolar: { create: kadroResult.data },
      },
      include: sozlesmeInclude,
    });
    return NextResponse.json(sozlesme, { status: 201 });
  } catch (err: any) {
    if (err?.code === "P2002") {
      return NextResponse.json({ error: `Bu işletme için ${donem} döneminde zaten bir sözleşme var` }, { status: 409 });
    }
    throw err;
  }
}
