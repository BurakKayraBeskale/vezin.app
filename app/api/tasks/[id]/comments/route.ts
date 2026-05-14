import { NextRequest, NextResponse } from "next/server";
import { getToken } from "next-auth/jwt";
import { prisma } from "@/lib/prisma";

async function auth(req: NextRequest) {
  return getToken({ req, secret: process.env.NEXTAUTH_SECRET });
}

export async function GET(req: NextRequest, { params }: { params: { id: string } }) {
  const token = await auth(req);
  if (!token) return NextResponse.json({ error: "Yetkisiz" }, { status: 401 });

  const comments = await prisma.taskComment.findMany({
    where: { taskId: params.id },
    include: { user: { select: { id: true, name: true, role: true } } },
    orderBy: { createdAt: "asc" },
  });
  return NextResponse.json(comments);
}

export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  const token = await auth(req);
  if (!token) return NextResponse.json({ error: "Yetkisiz" }, { status: 401 });

  const body = await req.json();
  const { content } = body;
  if (!content?.trim()) return NextResponse.json({ error: "İçerik boş olamaz" }, { status: 400 });

  const userId = token.id as string;

  const comment = await prisma.taskComment.create({
    data: { taskId: params.id, userId, content: content.trim() },
    include: { user: { select: { id: true, name: true, role: true } } },
  });

  // Notify task owner (assignedTo) if different from commenter
  const task = await prisma.task.findUnique({
    where: { id: params.id },
    select: { assignedToId: true, createdById: true, title: true },
  });

  if (task) {
    const notifyIds = new Set<string>();
    if (task.assignedToId && task.assignedToId !== userId) notifyIds.add(task.assignedToId);
    if (task.createdById && task.createdById !== userId) notifyIds.add(task.createdById);

    for (const uid of Array.from(notifyIds)) {
      try {
        await prisma.notification.create({
          data: {
            userId: uid,
            type: "COMMENTED",
            message: `"${task.title}" görevine yeni yorum eklendi.`,
            relatedId: params.id,
          },
        });
      } catch { /* ignore */ }
    }

    // Handle @mentions — extract @Name from content and notify
    const mentionPattern = /@([A-Za-zÇçĞğİıÖöŞşÜü][A-Za-zÇçĞğİıÖöŞşÜü\s]+)/g;
    const matches = [...content.matchAll(mentionPattern)];
    if (matches.length > 0) {
      const mentionedNames = matches.map((m) => m[1].trim());
      for (const name of mentionedNames) {
        try {
          const mentioned = await prisma.user.findFirst({ where: { name: { contains: name } }, select: { id: true } });
          if (mentioned && mentioned.id !== userId) {
            await prisma.notification.create({
              data: {
                userId: mentioned.id,
                type: "MENTIONED",
                message: `"${task.title}" görevinde bahsedildiniz.`,
                relatedId: params.id,
              },
            });
          }
        } catch { /* ignore */ }
      }
    }
  }

  return NextResponse.json(comment, { status: 201 });
}
