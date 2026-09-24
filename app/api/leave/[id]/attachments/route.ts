/**
 * POST /api/leave/[id]/attachments — izin talebine ek dosya ekler.
 *
 * Yalnızca talep sahibi, yalnızca talep PENDING iken ekleyebilir (bkz. #4/#8:
 * "Talep oluştururken ve sonradan eklenebilsin" — APPROVED/REJECTED/CANCELLED
 * talep düzenlenemez kuralı ekler için de geçerlidir). Mevcut dosya yükleme
 * altyapısıyla aynı desen (bkz. app/api/tasks/[id]/attachments) — blob DB'de
 * tutulmaz, yalnızca uploads/ altına yazılıp storageKey saklanır.
 */
import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { writeFile, mkdir } from "fs/promises";
import path from "path";

export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "Yetkisiz" }, { status: 401 });
  const userId = (session.user as any).id as string;

  const existing = await prisma.leaveRequest.findUnique({ where: { id: params.id } });
  if (!existing) return NextResponse.json({ error: "Bulunamadı" }, { status: 404 });
  if (existing.userId !== userId) {
    return NextResponse.json({ error: "Yalnızca talep sahibi ek dosya ekleyebilir" }, { status: 403 });
  }
  if (existing.status !== "PENDING") {
    return NextResponse.json({ error: "Yalnızca bekleyen talebe ek eklenebilir" }, { status: 400 });
  }

  const formData = await req.formData();
  const file = formData.get("file") as File | null;
  if (!file) return NextResponse.json({ error: "Dosya bulunamadı" }, { status: 400 });

  const bytes = await file.arrayBuffer();
  const buffer = Buffer.from(bytes);

  const uploadsDir = path.join(process.cwd(), "uploads");
  await mkdir(uploadsDir, { recursive: true });
  const uniqueName = `${Date.now()}_${file.name.replace(/[^a-zA-Z0-9._-]/g, "_")}`;
  await writeFile(path.join(uploadsDir, uniqueName), buffer);

  const attachment = await prisma.leaveAttachment.create({
    data: {
      leaveRequestId: params.id,
      name: file.name,
      storageKey: uniqueName,
      size: buffer.length,
      uploadedById: userId,
    },
    include: { uploadedBy: { select: { id: true, name: true } } },
  });

  return NextResponse.json(attachment, { status: 201 });
}
