import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "Yetkisiz" }, { status: 401 });

  const tasks = await prisma.task.findMany({
    include: {
      assignedTo: { select: { id: true, name: true, email: true } },
      createdBy: { select: { id: true, name: true } },
      files: { include: { uploadedBy: { select: { id: true, name: true } } }, orderBy: { createdAt: "desc" } },
      feedbacks: { include: { fromUser: { select: { id: true, name: true, role: true } } }, orderBy: { createdAt: "asc" } },
    },
    orderBy: { createdAt: "desc" },
  });

  return NextResponse.json(tasks);
}

export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "Yetkisiz" }, { status: 401 });
  if (session.user.role !== "ADMIN") return NextResponse.json({ error: "Sadece admin" }, { status: 403 });

  const body = await req.json();
  const { title, description, priority, assignedToId, dueDate } = body;

  if (!title?.trim()) return NextResponse.json({ error: "Başlık gerekli" }, { status: 400 });

  const task = await prisma.task.create({
    data: {
      title: title.trim(),
      description: description?.trim() || null,
      priority: priority || "MEDIUM",
      assignedToId: assignedToId || null,
      dueDate: dueDate ? new Date(dueDate) : null,
      createdById: session.user.id,
    },
    include: {
      assignedTo: { select: { id: true, name: true, email: true } },
      createdBy: { select: { id: true, name: true } },
      files: { include: { uploadedBy: { select: { id: true, name: true } } } },
      feedbacks: { include: { fromUser: { select: { id: true, name: true, role: true } } } },
      logs: { include: { user: { select: { id: true, name: true } } }, orderBy: { timestamp: "asc" as const } },
    },
  });

  // Bildirim: görev atandı
  if (assignedToId && assignedToId !== session.user.id) {
    try {
      await (prisma as any).notification.create({
        data: {
          userId: assignedToId,
          type: "TASK_ASSIGNED",
          message: `"${task.title}" görevi size atandı.`,
          relatedId: task.id,
        },
      });
    } catch { /* bildirim hatası görevi etkilemesin */ }
  }

  return NextResponse.json(task, { status: 201 });
}
