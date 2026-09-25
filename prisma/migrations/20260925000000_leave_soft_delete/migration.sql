-- 20260925000000_leave_soft_delete
-- İptal edilen (CANCELLED) izin taleplerini listelerden gizlemek için soft-delete alanı.
-- Kayıt fiziksel olarak silinmez — denetim izi korunur, yalnızca gizlenir.
ALTER TABLE "LeaveRequest" ADD COLUMN "deletedAt" DATETIME;
