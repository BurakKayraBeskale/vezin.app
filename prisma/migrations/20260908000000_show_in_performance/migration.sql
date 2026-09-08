-- 20260908000000_show_in_performance
-- Performans listesinden gizlenecek hesaplar için alan.
ALTER TABLE "User" ADD COLUMN "showInPerformance" BOOLEAN NOT NULL DEFAULT true;
