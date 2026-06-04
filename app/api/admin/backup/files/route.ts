import { NextRequest, NextResponse } from "next/server";
import { getToken } from "next-auth/jwt";
import { prisma } from "@/lib/prisma";
import archiver from "archiver";
import path from "path";
import fs from "fs";
import { PassThrough } from "stream";

export const dynamic = "force-dynamic";

/** Replace filesystem-unsafe characters */
function sanitize(name: string): string {
  return name.replace(/[<>:"/\\|?*\x00-\x1f]/g, "_").trim() || "Bilinmeyen";
}

export async function GET(req: NextRequest) {
  const token = await getToken({ req, secret: process.env.NEXTAUTH_SECRET });
  if (!token || (token as any).role !== "ADMIN") {
    return NextResponse.json({ error: "Yetkisiz erişim" }, { status: 401 });
  }

  const { searchParams } = new URL(req.url);
  const startDate = searchParams.get("startDate");
  const endDate   = searchParams.get("endDate");

  const dateFilter: any = {};
  if (startDate) dateFilter.gte = new Date(startDate);
  if (endDate) {
    const end = new Date(endDate);
    end.setHours(23, 59, 59, 999);
    dateFilter.lte = end;
  }

  const files = await prisma.file.findMany({
    where: Object.keys(dateFilter).length ? { createdAt: dateFilter } : undefined,
    include: {
      task: {
        select: {
          title: true,
          createdBy: { select: { department: true } },
        },
      },
    },
    orderBy: { createdAt: "asc" },
  });

  if (files.length === 0) {
    return NextResponse.json(
      { error: "Seçili tarih aralığında yüklenmiş dosya bulunamadı" },
      { status: 404 }
    );
  }

  const uploadsDir  = path.join(process.cwd(), "uploads");
  const dateLabel   = new Date().toISOString().split("T")[0];
  const rootFolder  = `Vezin_Dosya_Yedegi_${dateLabel}`;

  // Build archive in memory via PassThrough → Web ReadableStream
  const passThrough = new PassThrough();
  const archive     = archiver("zip", { zlib: { level: 6 } });

  archive.on("error", (err) => passThrough.destroy(err));
  archive.pipe(passThrough);

  for (const file of files) {
    const diskPath = path.join(uploadsDir, file.path);
    if (!fs.existsSync(diskPath)) continue;

    const dept     = sanitize(file.task.createdBy.department || "Genel");
    const taskName = sanitize(file.task.title);
    // Prefix with file id slice to avoid name collisions within same task folder
    const entryName = `${rootFolder}/${dept}/${taskName}/${file.filename}`;

    archive.file(diskPath, { name: entryName });
  }

  await archive.finalize();

  const webStream = new ReadableStream({
    start(controller) {
      passThrough.on("data",  (chunk: Buffer) => controller.enqueue(new Uint8Array(chunk)));
      passThrough.on("end",   ()              => controller.close());
      passThrough.on("error", (err)           => controller.error(err));
    },
    cancel() {
      archive.abort();
    },
  });

  return new Response(webStream, {
    headers: {
      "Content-Type":        "application/zip",
      "Content-Disposition": `attachment; filename="${rootFolder}.zip"`,
      "Cache-Control":       "no-store",
    },
  });
}
