import { NextRequest, NextResponse } from "next/server";
import { getToken } from "next-auth/jwt";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

function isAllowed(role: string, department: string) {
  return role === "ADMIN" || department === "YEMINLI_MALI_MUSAVIR";
}

export async function GET(req: NextRequest) {
  const token = await getToken({ req, secret: process.env.NEXTAUTH_SECRET });
  if (!token) return NextResponse.json({ error: "Yetkisiz erişim" }, { status: 401 });
  const { role, department } = token as any;
  if (!isAllowed(role, department)) return NextResponse.json({ error: "Yetkisiz" }, { status: 403 });

  try {
    const records = await prisma.karsitInceleme.findMany({
      orderBy: { createdAt: "desc" },
    });
    return NextResponse.json(records);
  } catch (err: any) {
    console.error("[karsit-inceleme GET]", err);
    return NextResponse.json({ error: "Veri alınamadı: " + (err?.message ?? "") }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  const token = await getToken({ req, secret: process.env.NEXTAUTH_SECRET });
  if (!token) return NextResponse.json({ error: "Yetkisiz erişim" }, { status: 401 });
  const { role, department, sub } = token as any;
  if (!isAllowed(role, department)) return NextResponse.json({ error: "Yetkisiz" }, { status: 403 });

  let body: any;
  try { body = await req.json(); }
  catch { return NextResponse.json({ error: "Geçersiz istek" }, { status: 400 }); }

  const {
    mukellefUnvan, mukellefVkn, mukellefVD,
    konu, donemBas, donemBit,
    ymmAdi = "", ymmSicilNo = "", ymmVergiNo = "",
    faturalar = "[]", notlar = "",
  } = body;

  if (!mukellefUnvan || !mukellefVkn || !mukellefVD || !konu || !donemBas || !donemBit) {
    return NextResponse.json({ error: "Zorunlu alanlar eksik" }, { status: 400 });
  }

  try {
    const record = await prisma.karsitInceleme.create({
      data: {
        mukellefUnvan,
        mukellefVkn,
        mukellefVD,
        konu,
        donemBas,
        donemBit,
        ymmAdi,
        ymmSicilNo,
        ymmVergiNo,
        faturalar: typeof faturalar === "string" ? faturalar : JSON.stringify(faturalar),
        notlar,
        olusturanId: sub,
      },
    });
    return NextResponse.json(record, { status: 201 });
  } catch (err: any) {
    console.error("[karsit-inceleme POST]", err);
    return NextResponse.json({ error: "Kayıt oluşturulamadı: " + (err?.message ?? "") }, { status: 500 });
  }
}
