import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "Yetkisiz" }, { status: 401 });

  const role = (session.user as any).role;
  const department = (session.user as any).department as string;

  // ADMIN: all templates; others: own dept + global (null dept)
  const templates =
    role === "ADMIN"
      ? await prisma.taskTemplate.findMany({
          include: { createdBy: { select: { id: true, name: true } } },
          orderBy: { createdAt: "desc" },
        })
      : await prisma.taskTemplate.findMany({
          where: { OR: [{ department: null }, { department: department }] },
          include: { createdBy: { select: { id: true, name: true } } },
          orderBy: { createdAt: "desc" },
        });

  return NextResponse.json(templates);
}

export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "Yetkisiz" }, { status: 401 });

  const role = (session.user as any).role;
  const userDept = (session.user as any).department as string;
  if (role === "EMPLOYEE") return NextResponse.json({ error: "Yetki gerekli" }, { status: 403 });

  const body = await req.json();
  const { title, description, priority, estimatedDays, department } = body;
  if (!title?.trim()) return NextResponse.json({ error: "Başlık zorunlu" }, { status: 400 });

  // MANAGER can only create for own department
  const templateDept = role === "ADMIN" ? (department || null) : userDept;

  const template = await prisma.taskTemplate.create({
    data: {
      title: title.trim(),
      description: description?.trim() || null,
      priority: priority || "MEDIUM",
      estimatedDays: estimatedDays ? Number(estimatedDays) : null,
      department: templateDept,
      createdById: (session.user as any).id,
    },
    include: { createdBy: { select: { id: true, name: true } } },
  });
  return NextResponse.json(template, { status: 201 });
}
