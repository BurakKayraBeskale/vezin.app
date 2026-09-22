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
