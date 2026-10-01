import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

// Feedback modülü (tablo adı Petition olarak korunuyor).
// Gönderen her zaman kayda yazılır — anonim gönderim kaldırıldı. Eski anonim
// kayıtlar (isAnonymous=true, userId=null) olduğu gibi kalır ve "Anonim" görünür.
// category kolonu artık formda yok; şema değişmesin diye boş string yazılır.
const userSelect = { select: { id: true, name: true } } as const;

export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "Yetkisiz" }, { status: 401 });

  if (session.user.role === "ADMIN") {
    const petitions = await prisma.petition.findMany({
      include: { user: userSelect },
      orderBy: { createdAt: "desc" },
    });
    return NextResponse.json(petitions);
  }

  // Employee: only own non-anonymous feedback
  const petitions = await prisma.petition.findMany({
    where: { userId: session.user.id, isAnonymous: false },
    include: { user: userSelect },
    orderBy: { createdAt: "desc" },
  });
  return NextResponse.json(petitions);
}

export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "Yetkisiz" }, { status: 401 });

  const body = await req.json().catch(() => null);
  const message = typeof body?.message === "string" ? body.message.trim() : "";

  if (!message) {
    return NextResponse.json({ error: "Feedback metni boş olamaz" }, { status: 400 });
  }

  const petition = await prisma.petition.create({
    data: {
      userId: session.user.id,
      category: "",
      message,
      isAnonymous: false,
    },
    include: { user: userSelect },
  });

  return NextResponse.json(petition, { status: 201 });
}
