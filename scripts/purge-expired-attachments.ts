/**
 * Süresi dolmuş ek/dosya temizleyici — D BLOĞU
 *
 * Çalıştırma:
 *   npx tsx scripts/purge-expired-attachments.ts
 *
 * Cron (sunucuda günde bir kez — örn. sabah 03:00):
 *   0 3 * * * cd /var/www/vezin && npx tsx scripts/purge-expired-attachments.ts >> /var/log/vezin-purge.log 2>&1
 *
 * Kurallar:
 *   - retentionUntil < şimdi VE purgedAt IS NULL → işle
 *   - Yalnızca type="FILE" olan TaskAttachment kayıtları (LINK kayıtları atlanır)
 *   - File modeli: tüm kayıtlar fiziksel dosyadır
 *   - Fiziksel dosyayı sil, purgedAt'i doldur
 *   - Meta veriyi (dosya adı, kim yükledi, tarih) ASLA silme
 *   - OneDrive/SharePoint linkleri (TaskAttachment.type="LINK") hiç dokunulmaz
 */

import fs from "fs";
import path from "path";
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

function tryDeleteFile(filePath: string): boolean {
  try {
    if (fs.existsSync(filePath)) {
      fs.unlinkSync(filePath);
      return true;
    }
    return false; // dosya zaten yok — yine de purgedAt ata
  } catch (err) {
    console.error(`[purge] Fiziksel silme başarısız: ${filePath}`, err);
    return false;
  }
}

async function purgeFiles(): Promise<void> {
  const now = new Date();

  // ── 1. File modeli (fiziksel görev dosyaları) ────────────────────────────
  const expiredFiles = await prisma.file.findMany({
    where: {
      purgedAt: null,
      retentionUntil: { lte: now },
    },
    select: { id: true, path: true, filename: true },
  });

  console.log(`[purge] ${expiredFiles.length} File kaydı temizlenecek`);

  for (const file of expiredFiles) {
    const deleted = tryDeleteFile(file.path);
    await prisma.file.update({
      where: { id: file.id },
      data: { purgedAt: now },
    });
    console.log(
      `[purge] File ${file.id} (${file.filename}): fiziksel ${deleted ? "silindi" : "bulunamadı"}, purgedAt atandı`
    );
  }

  // ── 2. TaskAttachment — yalnızca type="FILE" (LINK kayıtları dokunulmaz) ─
  const expiredAttachments = await prisma.taskAttachment.findMany({
    where: {
      type: "FILE",        // OneDrive/LINK kayıtları dahil değil
      purgedAt: null,
      retentionUntil: { lte: now },
    },
    select: { id: true, storageKey: true, name: true },
  });

  console.log(`[purge] ${expiredAttachments.length} TaskAttachment (FILE) temizlenecek`);

  for (const att of expiredAttachments) {
    let deleted = false;
    if (att.storageKey) {
      // storageKey = sunucudaki göreli yol veya mutlak yol
      const absPath = path.isAbsolute(att.storageKey)
        ? att.storageKey
        : path.join(process.cwd(), att.storageKey);
      deleted = tryDeleteFile(absPath);
    }
    await prisma.taskAttachment.update({
      where: { id: att.id },
      data: { purgedAt: now },
    });
    console.log(
      `[purge] TaskAttachment ${att.id} (${att.name}): fiziksel ${deleted ? "silindi" : "bulunamadı/link"}, purgedAt atandı`
    );
  }
}

async function main() {
  console.log(`[${new Date().toISOString()}] Ek temizleyici başlatıldı`);
  try {
    await purgeFiles();
  } finally {
    await prisma.$disconnect();
  }
  console.log(`[${new Date().toISOString()}] Tamamlandı`);
}

main().catch((err) => {
  console.error("HATA:", err);
  process.exit(1);
});
