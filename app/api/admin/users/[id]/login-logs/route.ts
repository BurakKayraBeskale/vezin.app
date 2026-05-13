import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function GET(_req: NextRequest, { params }: { params: { id: string } }) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "Yetkisiz" }, { status: 401 });
  if ((session.user as any).role !== "ADMIN") return NextResponse.json({ error: "Sadece admin" }, { status: 403 });

  const logs = await prisma.loginLog.findMany({
    where: { userId: params.id },
    orderBy: { createdAt: "desc" },
    take: 20,
  });
  return NextResponse.json(logs);
}
