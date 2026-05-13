import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "Yetkisiz" }, { status: 401 });
  const role = (session.user as any).role;
  if (role !== "ADMIN" && role !== "MANAGER") return NextResponse.json({ error: "Yetkisiz" }, { status: 403 });

  const templates = await prisma.taskTemplate.findMany({
    include: { createdBy: { select: { id: true, name: true } } },
    orderBy: { createdAt: "desc" },
  });
  return NextResponse.json(templates);
}

export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "Yetkisiz" }, { status: 401 });
  const role = (session.user as any).role;
  if (role !== "ADMIN" && role !== "MANAGER") return NextResponse.json({ error: "Yetkisiz" }, { status: 403 });

  const body = await req.json();
  const { title, description, priority, estimatedDays, department } = body;
  if (!title?.trim()) return NextResponse.json({ error: "Başlık zorunlu" }, { status: 400 });

  const template = await prisma.taskTemplate.create({
    data: {
      title: title.trim(),
      description: description?.trim() || null,
      priority: priority || "MEDIUM",
      estimatedDays: estimatedDays ? Number(estimatedDays) : null,
      department: department || null,
      createdById: (session.user as any).id,
    },
    include: { createdBy: { select: { id: true, name: true } } },
  });
  return NextResponse.json(template, { status: 201 });
}
