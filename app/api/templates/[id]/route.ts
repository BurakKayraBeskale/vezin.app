import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "Yetkisiz" }, { status: 401 });
  const role = (session.user as any).role;
  if (role !== "ADMIN" && role !== "MANAGER") return NextResponse.json({ error: "Yetkisiz" }, { status: 403 });

  const body = await req.json();
  const { title, description, priority, estimatedDays, department } = body;

  const data: Record<string, unknown> = {};
  if (title !== undefined) data.title = title.trim();
  if (description !== undefined) data.description = description?.trim() || null;
  if (priority !== undefined) data.priority = priority;
  if (estimatedDays !== undefined) data.estimatedDays = estimatedDays ? Number(estimatedDays) : null;
  if (department !== undefined) data.department = department || null;

  const template = await prisma.taskTemplate.update({
    where: { id: params.id },
    data,
    include: { createdBy: { select: { id: true, name: true } } },
  });
  return NextResponse.json(template);
}

export async function DELETE(_req: NextRequest, { params }: { params: { id: string } }) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "Yetkisiz" }, { status: 401 });
  const role = (session.user as any).role;
  if (role !== "ADMIN" && role !== "MANAGER") return NextResponse.json({ error: "Yetkisiz" }, { status: 403 });

  await prisma.taskTemplate.delete({ where: { id: params.id } });
  return NextResponse.json({ ok: true });
}
