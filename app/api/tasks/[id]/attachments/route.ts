/**
 * POST /api/tasks/[id]/attachments — bir inceleme turuna (TaskReviewRound) dosya eki ekler.
 *
 * Link ekleri submit_review/request_revision PATCH aksiyonlarının gövdesine
 * (attachmentUrl/attachmentName) gömülüdür — JSON'da taşınabildiği için ayrı
 * uç gerekmez. Bu uç yalnızca DOSYA ekleri için var (multipart gerektirir).
 *
 * Yetki (canManageTaskSource'tan BAĞIMSIZ — kaynaklar bölümüyle karıştırılmamalı):
 *   kind:"SUBMISSION" → yalnızca o turu gönderen kişi (round.submittedById)
 *   kind:"FEEDBACK"   → canReviewTask
 */
import { NextRequest, NextResponse } from "next/server";
import { getToken } from "next-auth/jwt";
import { prisma } from "@/lib/prisma";
import { buildTaskVisibilityWhereForUser } from "@/lib/task-visibility";
import { canReviewTask, WorkflowUser } from "@/lib/task-permissions";
import { writeFile, mkdir } from "fs/promises";
import path from "path";

export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  const token = await getToken({ req, secret: process.env.NEXTAUTH_SECRET });
  if (!token) return NextResponse.json({ error: "Yetkisiz" }, { status: 401 });
  const userId = token.id as string;

  const visUser = {
    id: userId,
    role: (token as any).role as string,
    canViewAllProjects: ((token as any).canViewAllProjects as boolean) ?? false,
    overseesDepartment: ((token as any).overseesDepartment as string | null) ?? null,
    department: ((token as any).department as string) ?? "",
    seniorityLevel: ((token as any).seniorityLevel as number) ?? 0,
  };

  const task = await prisma.task.findFirst({
    where: { AND: [{ id: params.id }, buildTaskVisibilityWhereForUser(visUser) as any] },
    select: { id: true, assignedToId: true, reviewOwnerId: true },
  });
  if (!task) return NextResponse.json({ error: "Görev bulunamadı" }, { status: 404 });

  const formData = await req.formData();
  const roundId = formData.get("roundId") as string | null;
  const kind = formData.get("kind") as string | null;
  const file = formData.get("file") as File | null;

  if (!roundId || !kind) {
    return NextResponse.json({ error: "roundId ve kind zorunludur" }, { status: 400 });
  }
  if (kind !== "SUBMISSION" && kind !== "FEEDBACK") {
    return NextResponse.json({ error: "Geçersiz kind" }, { status: 400 });
  }
  if (!file) {
    return NextResponse.json({ error: "Dosya bulunamadı" }, { status: 400 });
  }

  const round = await prisma.taskReviewRound.findUnique({
    where: { id: roundId },
    select: { id: true, taskId: true, submittedById: true },
  });
  if (!round || round.taskId !== params.id) {
    return NextResponse.json({ error: "İnceleme turu bulunamadı" }, { status: 404 });
  }

  const wfUser: WorkflowUser = {
    id: userId,
    role: visUser.role,
    seniorityLevel: visUser.seniorityLevel,
    canViewAllProjects: visUser.canViewAllProjects,
    overseesDepartment: visUser.overseesDepartment,
    department: visUser.department,
  };

  if (kind === "SUBMISSION") {
    if (round.submittedById !== userId) {
      return NextResponse.json({ error: "Yalnızca gönderimi yapan kişi ek dosya ekleyebilir" }, { status: 403 });
    }
  } else if (!canReviewTask(wfUser, task)) {
    return NextResponse.json({ error: "İnceleme yetkisi yok" }, { status: 403 });
  }

  const bytes = await file.arrayBuffer();
  const buffer = Buffer.from(bytes);

  const uploadsDir = path.join(process.cwd(), "uploads");
  await mkdir(uploadsDir, { recursive: true });
  const uniqueName = `${Date.now()}_${file.name.replace(/[^a-zA-Z0-9._-]/g, "_")}`;
  await writeFile(path.join(uploadsDir, uniqueName), buffer);

  const attachment = await prisma.taskAttachment.create({
    data: {
      taskId: params.id,
      reviewRoundId: roundId,
      kind,
      type: "FILE",
      name: file.name,
      storageKey: uniqueName,
      size: buffer.length,
      uploadedById: userId,
    },
    include: { uploadedBy: { select: { id: true, name: true } } },
  });

  return NextResponse.json(attachment, { status: 201 });
}
