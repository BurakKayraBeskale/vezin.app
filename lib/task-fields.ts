/**
 * Görev formu alan tanımları — tek doğru kaynak.
 *
 * TaskForm (create + edit ortak bileşeni) ve her yerde görev önceliği/departman
 * etiketi gösteren bileşenler buradan okur. Yeni bir öncelik değeri veya
 * departman eklendiğinde tek yerden güncellenir; iki formun birbirinden
 * bağımsız enum kopyaları olmaz.
 *
 * Bu dosya client component'lerden import edilir — prisma İÇERMEZ.
 */

/** Task.priority — tek doğru kaynak. */
export const PRIORITY_OPTIONS: { value: "LOW" | "MEDIUM" | "HIGH"; label: string }[] = [
  { value: "LOW", label: "Düşük" },
  { value: "MEDIUM", label: "Orta" },
  { value: "HIGH", label: "Yüksek" },
];

export const DEFAULT_PRIORITY = "MEDIUM";

/** Proje departmanı (Project.department) → görünen etiket. */
export const PROJECT_DEPT_LABELS: Record<string, string> = {
  OUTSOURCE: "Outsource",
  BAGIMSIZ_DENETIM: "Bağımsız Denetim",
  MUHASEBE: "Muhasebe",
  YMM: "YMM",
};

/** Kullanıcı departmanı (User.department / proje dışı Task.departmentId) → görünen etiket. */
export const USER_DEPT_LABELS: Record<string, string> = {
  OUTSOURCE: "Outsource",
  BAGIMSIZ_DENETIM: "Bağımsız Denetim",
  MUHASEBE: "Muhasebe",
  YEMINLI_MALI_MUSAVIR: "YMM",
};

/** Planlanan başlangıç / son tarih için ortak hata metni (API + TaskForm). */
export const TASK_START_AFTER_DUE_ERROR = "Planlanan başlangıç tarihi son tarihten sonra olamaz";

/**
 * Planlanan başlangıç son tarihten sonra mı? Tarih-yalnız karşılaştırma
 * ("YYYY-MM-DD" ya da UTC gece yarısı Date). İkisinden biri boşsa kural yok.
 */
export function isTaskStartAfterDue(
  startDate: Date | string | null | undefined,
  dueDate: Date | string | null | undefined
): boolean {
  if (!startDate || !dueDate) return false;
  const key = (v: Date | string) => (typeof v === "string" ? v : v.toISOString()).slice(0, 10);
  return key(startDate) > key(dueDate);
}
