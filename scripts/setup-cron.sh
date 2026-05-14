#!/bin/bash
# Cron job kurulum script'i — sunucuda bir kez çalıştır
# Kullanım: sudo bash /var/www/vezin/scripts/setup-cron.sh

SCRIPT="/var/www/vezin/scripts/backup-db.sh"
CRON_LINE="0 2 * * 6 ${SCRIPT} >> /var/log/vezin-backup.log 2>&1"
LOG_DIR="/var/log"
BACKUP_DIR="/var/www/vezin/prisma/backup"

echo "=== Vezin Cron Kurulumu ==="

# Script'i çalıştırılabilir yap
chmod +x "${SCRIPT}"
echo "✔ backup-db.sh çalıştırılabilir yapıldı"

# Yedek klasörü oluştur
mkdir -p "${BACKUP_DIR}"
echo "✔ Yedek klasörü: ${BACKUP_DIR}"

# Cron job mevcut mu kontrol et
if crontab -l 2>/dev/null | grep -qF "${SCRIPT}"; then
  echo "✔ Cron job zaten mevcut, atlandı"
else
  # Mevcut cron'a ekle
  (crontab -l 2>/dev/null; echo "${CRON_LINE}") | crontab -
  echo "✔ Cron job eklendi: ${CRON_LINE}"
fi

echo ""
echo "Mevcut cron tablosu:"
crontab -l 2>/dev/null || echo "(boş)"

echo ""
echo "=== Kurulum tamamlandı ==="
echo "Yedekler her Cumartesi 02:00'de alınacak."
echo "Log: /var/log/vezin-backup.log"
