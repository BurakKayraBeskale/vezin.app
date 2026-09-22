-- TaskLog'a genel amaçlı önce/sonra metin anlık görüntüsü ekler.
-- Kullanım alanı: görev yeniden atama (action="REASSIGNED": fromValue/toValue = eski/yeni
-- atanan kişinin adı) ve proje taşıma (action="PROJECT_CHANGED": fromValue/toValue = eski/yeni
-- proje adı ya da "Projesiz"). fromStatus/toStatus alanları yalnızca Task.status değerleri
-- içindir; isim gibi serbest metinler için ayrı sütunlar gerekiyordu.

-- AlterTable
ALTER TABLE "TaskLog" ADD COLUMN "fromValue" TEXT;
ALTER TABLE "TaskLog" ADD COLUMN "toValue" TEXT;
