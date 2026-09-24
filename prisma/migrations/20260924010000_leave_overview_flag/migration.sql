-- 20260924010000_leave_overview_flag
-- /izin-durumu personel listesinden gizlenecek hesaplar için alan (showInPerformance'tan ayrı, bağımsız bayrak).
ALTER TABLE "User" ADD COLUMN "showInLeaveOverview" BOOLEAN NOT NULL DEFAULT true;
