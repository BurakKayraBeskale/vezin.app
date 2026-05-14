import { NextRequest, NextResponse } from "next/server";
import { getToken } from "next-auth/jwt";
import { prisma } from "@/lib/prisma";

export async function GET(req: NextRequest, { params }: { params: { id: string } }) {
  const token = await getToken({ req, secret: process.env.NEXTAUTH_SECRET });
  if (!token) return NextResponse.json({ error: "Yetkisiz" }, { status: 401 });

  const logs = await prisma.taskLog.findMany({
    where: { taskId: params.id },
    include: { user: { select: { id: true, name: true } } },
    orderBy: { timestamp: "asc" },
  });
  return NextResponse.json(logs);
}

export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  const token = await getToken({ req, secret: process.env.NEXTAUTH_SECRET });
  if (!token) return NextResponse.json({ error: "Yetkisiz" }, { status: 401 });

  const { startedAt, completedAt } = await req.json();
  if (!startedAt || !completedAt) {
    return NextResponse.json({ error: "Başlama ve bitiş zamanı zorunlu" }, { status: 400 });
  }

  const start = new Date(startedAt);
  const end = new Date(completedAt);
  if (end <= start) {
    return NextResponse.json({ error: "Bitiş zamanı başlama zamanından sonra olmalı" }, { status: 400 });
  }

  const durationMinutes = Math.round((end.getTime() - start.getTime()) / 60000);

  const log = await prisma.taskLog.create({
    data: {
      taskId: params.id,
      userId: token.id as string,
      action: "MANUAL_TIME",
      startedAt: start,
      completedAt: end,
      durationMinutes,
      manualEntry: true,
    },
    include: { user: { select: { id: true, name: true } } },
  });

  return NextResponse.json(log, { status: 201 });
}
