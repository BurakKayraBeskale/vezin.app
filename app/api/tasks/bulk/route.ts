import { NextRequest, NextResponse } from "next/server";
import { getToken } from "next-auth/jwt";
import { prisma } from "@/lib/prisma";

export async function POST(req: NextRequest) {
  const token = await getToken({ req, secret: process.env.NEXTAUTH_SECRET });
  if (!token) return NextResponse.json({ error: "Yetkisiz" }, { status: 401 });
  if (token.role !== "ADMIN") return NextResponse.json({ error: "Sadece admin" }, { status: 403 });

  const body = await req.json();
  const { ids, action, assignedToId, status } = body;

  if (!Array.isArray(ids) || ids.length === 0) {
    return NextResponse.json({ error: "Görev seçilmedi" }, { status: 400 });
  }

  if (action === "assign") {
    await prisma.task.updateMany({
      where: { id: { in: ids } },
      data: { assignedToId: assignedToId || null },
    });

    if (assignedToId) {
      const tasks = await prisma.task.findMany({ where: { id: { in: ids } }, select: { id: true, title: true } });
      for (const t of tasks) {
        try {
          await prisma.notification.create({
            data: {
              userId: assignedToId,
              type: "TASK_ASSIGNED",
              message: `"${t.title}" görevi size atandı.`,
              relatedId: t.id,
            },
          });
        } catch { /* ignore */ }
      }
    }
  } else if (action === "status") {
    if (!status) return NextResponse.json({ error: "Durum gerekli" }, { status: 400 });
    await prisma.task.updateMany({
      where: { id: { in: ids } },
      data: { status },
    });
  } else {
    return NextResponse.json({ error: "Geçersiz işlem" }, { status: 400 });
  }

  const updated = await prisma.task.findMany({
    where: { id: { in: ids } },
    include: {
      assignedTo: { select: { id: true, name: true, email: true } },
      createdBy: { select: { id: true, name: true } },
      files: { include: { uploadedBy: { select: { id: true, name: true } } }, orderBy: { createdAt: "desc" } },
      feedbacks: { include: { fromUser: { select: { id: true, name: true, role: true } } }, orderBy: { createdAt: "asc" } },
      logs: { include: { user: { select: { id: true, name: true } } }, orderBy: { timestamp: "asc" } },
    },
  });

  return NextResponse.json(updated);
}
