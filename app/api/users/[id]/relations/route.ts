import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

const VALID_TYPES = ["SUPERIOR", "PEER", "SUBORDINATE"];

export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "Yetkisiz" }, { status: 401 });
  if (session.user.role !== "ADMIN") return NextResponse.json({ error: "Sadece admin" }, { status: 403 });

  const { subordinateId, relationType } = await req.json();

  if (!subordinateId || typeof subordinateId !== "string") {
    return NextResponse.json({ error: "subordinateId gerekli" }, { status: 400 });
  }

  // Self-reference guard
  if (subordinateId === params.id) {
    return NextResponse.json({ error: "Kendi kendinizle ilişki kurulamaz" }, { status: 400 });
  }

  // relationType null / empty → delete relation
  if (!relationType) {
    await prisma.userRelation.deleteMany({
      where: { managerId: params.id, subordinateId },
    });
    return NextResponse.json({ ok: true, action: "deleted" });
  }

  if (!VALID_TYPES.includes(relationType)) {
    return NextResponse.json({ error: "Geçersiz ilişki türü" }, { status: 400 });
  }

  // Upsert relation
  await prisma.userRelation.upsert({
    where: { managerId_subordinateId: { managerId: params.id, subordinateId } },
    create: { managerId: params.id, subordinateId, relationType },
    update: { relationType },
  });

  return NextResponse.json({ ok: true, action: "upserted" });
}
