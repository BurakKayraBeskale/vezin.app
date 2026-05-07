import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { readFile } from "fs/promises";
import path from "path";

export async function GET(_: NextRequest, { params }: { params: { id: string } }) {
  const session = await getServerSession(authOptions);
  if (!session) return new NextResponse("Yetkisiz", { status: 401 });

  const file = await prisma.file.findUnique({ where: { id: params.id } });
  if (!file) return new NextResponse("Dosya bulunamadı", { status: 404 });

  try {
    const filePath = path.join(process.cwd(), "uploads", file.path);
    const buffer = await readFile(filePath);

    return new NextResponse(buffer, {
      headers: {
        "Content-Disposition": `attachment; filename*=UTF-8''${encodeURIComponent(file.filename)}`,
        "Content-Type": "application/octet-stream",
        "Content-Length": buffer.length.toString(),
      },
    });
  } catch {
    return new NextResponse("Dosya diskte bulunamadı", { status: 404 });
  }
}
