import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function PATCH(
  _req: NextRequest,
  { params }: { params: { id: string } }
) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "Yetkisiz" }, { status: 401 });
  if (session.user.role !== "ADMIN") return NextResponse.json({ error: "Sadece admin" }, { status: 403 });

  const petition = await prisma.petition.update({
    where: { id: params.id },
    data: { isRead: true },
  });

  return NextResponse.json(petition);
}

export async function DELETE(
  _req: NextRequest,
  { params }: { params: { id: string } }
) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "Yetkisiz" }, { status: 401 });
  if (session.user.role !== "ADMIN") return NextResponse.json({ error: "Sadece admin" }, { status: 403 });

  await prisma.petition.delete({ where: { id: params.id } });
  return NextResponse.json({ ok: true });
}
