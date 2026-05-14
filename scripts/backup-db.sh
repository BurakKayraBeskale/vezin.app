#!/bin/bash
# Vezin veritabanı yedekleme script'i
# Cron: 0 2 * * 6  (Her Cumartesi 02:00)
#
# Kurulum:
#   chmod +x /var/www/vezin/scripts/backup-db.sh
#   crontab -e
#   0 2 * * 6 /var/www/vezin/scripts/backup-db.sh >> /var/log/vezin-backup.log 2>&1

set -euo pipefail

DB_PATH="/var/www/vezin/prisma/dev.db"
BACKUP_DIR="/var/www/vezin/prisma/backup"
DATE=$(date +%Y%m%d_%H%M%S)
BACKUP_FILE="${BACKUP_DIR}/dev.db.${DATE}"
KEEP_DAYS=30   # 30 günden eski yedekleri sil

# Yedek klasörü yoksa oluştur
mkdir -p "${BACKUP_DIR}"

# Veritabanı var mı kontrol et
if [ ! -f "${DB_PATH}" ]; then
  echo "[$(date '+%Y-%m-%d %H:%M:%S')] HATA: Veritabanı bulunamadı: ${DB_PATH}"
  exit 1
fi

# SQLite WAL checkpoint (tutarlı yedek için)
sqlite3 "${DB_PATH}" "PRAGMA wal_checkpoint(FULL);" 2>/dev/null || true

# Yedek al
cp "${DB_PATH}" "${BACKUP_FILE}"
echo "[$(date '+%Y-%m-%d %H:%M:%S')] TAMAM: ${BACKUP_FILE} ($(du -h "${BACKUP_FILE}" | cut -f1))"

# 30 günden eski yedekleri temizle
find "${BACKUP_DIR}" -name "dev.db.*" -mtime +${KEEP_DAYS} -delete
REMAINING=$(ls -1 "${BACKUP_DIR}"/dev.db.* 2>/dev/null | wc -l)
echo "[$(date '+%Y-%m-%d %H:%M:%S')] Toplam yedek sayısı: ${REMAINING}"
