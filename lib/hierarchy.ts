/**
 * Merkezi hiyerarşi modülü — unvan sistemi, seviye hesaplama, yetki yardımcıları.
 * Tüm unvan/seviye mantığı buradan türetilir; bu dosya tek doğru kaynaktır.
 */

// ── Unvan tanımları (14 seviye) ────────────────────────────────────────────

export const TITLES = [
  { key: "Stajyer",                 level: 1  },
  { key: "Assistant",               level: 2  },
  { key: "Experienced Assistant 1", level: 3  },
  { key: "Experienced Assistant 2", level: 4  },
  { key: "Senior 1",                level: 5  },
  { key: "Senior 2",                level: 6  },
  { key: "Assistant Manager",       level: 7  },
  { key: "Manager 1",               level: 8  },
  { key: "Manager 2",               level: 9  },
  { key: "Manager 3",               level: 10 },
  { key: "Senior Manager 1",        level: 11 },
  { key: "Senior Manager 2",        level: 12 },
  { key: "Senior Manager 3",        level: 13 },
  { key: "Partner",                 level: 14 },
] as const;

export type TitleKey = (typeof TITLES)[number]["key"];

/** Unvan anahtarları listesi (dropdown seçenekleri için) */
export const TITLE_KEYS: TitleKey[] = TITLES.map((t) => t.key);

/** Unvan → Seviye haritası */
export const TITLE_TO_LEVEL: Record<string, number> = Object.fromEntries(
  TITLES.map((t) => [t.key, t.level])
);

// ── Departman sabitleri ────────────────────────────────────────────────────

export const DEPARTMENTS = [
  "OUTSOURCE",
  "BAGIMSIZ_DENETIM",
  "MUHASEBE",
  "YEMINLI_MALI_MUSAVIR",
] as const;

export type DeptKey = (typeof DEPARTMENTS)[number];

export const DEPARTMENT_LABELS: Record<DeptKey, string> = {
  OUTSOURCE:            "Outsource",
  BAGIMSIZ_DENETIM:     "Bağımsız Denetim",
  MUHASEBE:             "Muhasebe",
  YEMINLI_MALI_MUSAVIR: "YMM",
};

// ── Yardımcı işlevler ─────────────────────────────────────────────────────

/** Unvandan seviye döndürür; tanınmayan unvan için null. */
export function getLevelFromTitle(title: string): number | null {
  return TITLE_TO_LEVEL[title] ?? null;
}

export function isAdmin(role: string): boolean {
  return role.toUpperCase() === "ADMIN";
}

/** Kullanıcı yönetimi (create/edit/delete) yetkisi: yalnızca ADMIN. */
export function canManageUsers(role: string): boolean {
  return isAdmin(role);
}

/**
 * Kıdeme dayalı görev atama: atayan, hedefin seviyesini KESİNLİKLE geçmelidir.
 * Eşit seviyeye veya üstüne atama yapılamaz.
 */
export function canAssignTaskByLevel(assignerLevel: number, targetLevel: number): boolean {
  return assignerLevel > targetLevel;
}

export function isSameDepartment(dept1: string, dept2: string): boolean {
  return dept1 === dept2;
}

/**
 * Proje açma yetkisi kıdem eşiği: Manager 1 (seviye 8) ve üstü.
 * ADMIN ayrıca her zaman proje açabilir (bu fonksiyon ADMIN kontrolü yapmaz).
 */
export function canCreateProjectByLevel(level: number): boolean {
  return level >= 8;
}

/**
 * Şablon oluşturma/düzenleme/silme yetkisi kıdem eşiği: Manager 1 (seviye 8) ve üstü.
 * ADMIN ayrıca her zaman yapabilir (bu fonksiyon ADMIN kontrolü yapmaz).
 */
export function canManageTemplatesByLevel(level: number): boolean {
  return level >= 8;
}
