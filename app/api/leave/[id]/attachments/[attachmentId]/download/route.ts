/**
 * GET /api/leave/[id]/attachments/[attachmentId]/download
 *
 * Yalnızca talep sahibi, kapsamındaki onaylayıcı veya ADMIN indirebilir —
 * aksi halde 404 (#8).
 */
import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { getLeaveViewScope } from "@/lib/access";
import { readFile } from "fs/promises";
import path from "path";

export async function GET(
  _req: NextRequest,
  { params }: { params: { id: string; attachmentId: string } }
) {
  const session = await getServerSession(authOptions);
  if (!session) return new NextResponse("Yetkisiz", { status: 401 });
  const userId = (session.user as any).id as string;
  const role = (session.user as any).role as string;
  const email = session.user.email ?? null;

  const request = await prisma.leaveRequest.findUnique({
    where: { id: params.id },
    include: { user: { select: { department: true } } },
  });
  if (!request) return new NextResponse("Bulunamadı", { status: 404 });

  const isOwner = request.userId === userId;
  const scope = getLeaveViewScope({ role, email });
  const canSee = isOwner || scope === "ALL" || scope.includes(request.user.department);
  if (!canSee) return new NextResponse("Bulunamadı", { status: 404 });

  const attachment = await prisma.leaveAttachment.findUnique({ where: { id: params.attachmentId } });
  if (!attachment || attachment.leaveRequestId !== params.id || !attachment.storageKey) {
    return new NextResponse("Dosya bulunamadı", { status: 404 });
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
