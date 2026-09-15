import { NextRequest, NextResponse } from "next/server";
import { getToken } from "next-auth/jwt";
import { prisma } from "@/lib/prisma";
import { buildTaskVisibilityWhereForUser } from "@/lib/task-visibility";
import { readFile } from "fs/promises";
import path from "path";

export async function GET(
  req: NextRequest,
  { params }: { params: { id: string; attachmentId: string } }
) {
  const token = await getToken({ req, secret: process.env.NEXTAUTH_SECRET });
  if (!token) return new NextResponse("Yetkisiz", { status: 401 });

  const visUser = {
    id: token.id as string,
    role: (token as any).role as string,
    canViewAllProjects: ((token as any).canViewAllProjects as boolean) ?? false,
    overseesDepartment: ((token as any).overseesDepartment as string | null) ?? null,
    department: ((token as any).department as string) ?? "",
    seniorityLevel: ((token as any).seniorityLevel as number) ?? 0,
  };

  // Görevi görebilen herkes, incelemeye eklenen dosyayı indirebilir —
  // canManageTaskSource ile karıştırılmamalı (o yalnızca "Kaynaklar" bölümünü kısıtlar).
  const task = await prisma.task.findFirst({
    where: { AND: [{ id: params.id }, buildTaskVisibilityWhereForUser(visUser) as any] },
    select: { id: true },
  });
  if (!task) return new NextResponse("Görev bulunamadı", { status: 404 });

  const attachment = await prisma.taskAttachment.findUnique({ where: { id: params.attachmentId } });
  if (!attachment || attachment.taskId !== params.id || attachment.type !== "FILE" || !attachment.storageKey) {
    return new NextResponse("Dosya bulunamadı", { status: 404 });
  }
  if (attachment.purgedAt) {
    return new NextResponse("Saklama süresi dolduğu için fiziksel dosya kaldırılmıştır", { status: 410 });
  }

  try {
    const filePath = path.join(process.cwd(), "uploads", attachment.storageKey);
    const buffer = await readFile(filePath);
    return new NextResponse(buffer, {
      headers: {
        "Content-Disposition": `attachment; filename*=UTF-8''${encodeURIComponent(attachment.name)}`,
        "Content-Type": "application/octet-stream",
        "Content-Length": buffer.length.toString(),
      },
    });
  } catch {
    return new NextResponse("Dosya diskte bulunamadı", { status: 404 });
  }
}
