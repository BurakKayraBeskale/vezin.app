import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "Yetkisiz" }, { status: 401 });

  if (session.user.role === "ADMIN") {
    const petitions = await prisma.petition.findMany({
      include: { user: { select: { id: true, name: true } } },
      orderBy: { createdAt: "desc" },
    });
    return NextResponse.json(petitions);
  }

  // Employee: only own non-anonymous petitions
  const petitions = await prisma.petition.findMany({
    where: { userId: session.user.id, isAnonymous: false },
    orderBy: { createdAt: "desc" },
  });
  return NextResponse.json(petitions);
}

export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "Yetkisiz" }, { status: 401 });

  const { category, message, isAnonymous } = await req.json();

  if (!category || !message?.trim()) {
    return NextResponse.json({ error: "Kategori ve mesaj gerekli" }, { status: 400 });
  }

  const validCategories = ["SUGGESTION", "COMPLAINT", "PETITION", "SITE_SUGGESTION"];
  if (!validCategories.includes(category)) {
    return NextResponse.json({ error: "Geçersiz kategori" }, { status: 400 });
  }

  const petition = await prisma.petition.create({
    data: {
      userId: isAnonymous ? null : session.user.id,
      category,
      message: message.trim(),
      isAnonymous: !!isAnonymous,
    },
  });

  return NextResponse.json(petition, { status: 201 });
}
