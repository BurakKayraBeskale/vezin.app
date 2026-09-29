-- 20260929000000_dashboard_task_indexes
-- Dashboard (A bloğu) sayaç sorguları için Task indeksleri — YALNIZCA indeks ekler.
-- Veri/sütun değişikliği yok; canlı veriye dokunmaz. Görev Takip filtreleri de yararlanır:
--   atanan + durum (Açık / Geciken / Bu Hafta Tamamlanan / Dağılım / Yaklaşan)
--   inceleme sahibi + durum (İncelemesinde Bekleyenler)
--   proje + durum (Öne Çıkan Projeler)

-- CreateIndex
CREATE INDEX "Task_assignedToId_status_idx" ON "Task"("assignedToId", "status");

-- CreateIndex
CREATE INDEX "Task_reviewOwnerId_status_idx" ON "Task"("reviewOwnerId", "status");

-- CreateIndex
CREATE INDEX "Task_projectId_status_idx" ON "Task"("projectId", "status");
