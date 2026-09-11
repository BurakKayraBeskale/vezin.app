/**
 * Merkezi yetki kuralları — middleware, Sidebar ve API rotalarında tek kaynak.
 *
 * ADMIN   : her şeye erişir
 * EMPLOYEE: departman kısıtlarına tabi (DEPT_GATED_RULES)
 */

/** Yalnızca ADMIN'in erişebildiği path önekleri */
export const ADMIN_ONLY_PREFIXES = ["/admin"];

/** Path'in admin-only olup olmadığı */
export function isAdminOnly(pathname: string): boolean {
  return ADMIN_ONLY_PREFIXES.some((p) => pathname.startsWith(p));
}

/** ADMIN mı? (geriye dönük uyumluluk için korunuyor) */
export function isManagerOrAdmin(role: string): boolean {
  return role.toUpperCase() === "ADMIN";
}

/** Departman kısıtı olan kurallar — EMPLOYEE rolü için geçerlidir */
export interface DeptRule {
  pathPrefix: string;
  allowedDepts: string[]; // boş = herkese açık
  /** true ise ADMIN da departman kısıtına tabidir */
  strictDept?: boolean;
}

export const DEPT_GATED_RULES: DeptRule[] = [
  { pathPrefix: "/beyanname",       allowedDepts: ["YEMINLI_MALI_MUSAVIR"] },
  { pathPrefix: "/karsit-inceleme", allowedDepts: ["YEMINLI_MALI_MUSAVIR", "MUHASEBE"] },
  // KDV İade — rol fark etmeksizin sadece YMM/Muhasebe erişir (ADMIN dahil)
  { pathPrefix: "/kdv-iade",        allowedDepts: ["YEMINLI_MALI_MUSAVIR", "MUHASEBE"], strictDept: true },
  { pathPrefix: "/api/kdv-iade",    allowedDepts: ["YEMINLI_MALI_MUSAVIR", "MUHASEBE"], strictDept: true },
];

/**
 * /companies sayfalarına ve firma yazma işlemlerine erişim:
 * yalnızca ADMIN rolü veya canManageCompanies=true olan kullanıcılar.
 */
export function canAccessCompanies(user: { role: string; canManageCompanies?: boolean }): boolean {
  return user.role === "ADMIN" || user.canManageCompanies === true;
}

// ── Kıdem Seviyesi Sistemi ──────────────────────────────────────────────────

/**
 * Tek doğru kaynak: unvan → kıdem seviyesi (14-seviyeli sistem).
 * Seed'de ve API'de seniorityLevel ataması buraya göre yapılır.
 *
 * Proje yönetim yetki eşikleri:
 *   >= 8  → Manager 1+ (proje oluşturabilir; üye ise yönetebilir)
 *   >= 11 → Senior Manager 1+ (üyelik gerektirmeden kendi departmanını yönetebilir)
 *   14    → Partner (Senior Manager ile aynı kural)
 */
export const TITLE_TO_SENIORITY: Record<string, number> = {
  "Stajyer":                 1,
  "Assistant":               2,
  "Experienced Assistant 1": 3,
  "Experienced Assistant 2": 4,
  "Senior 1":                5,
  "Senior 2":                6,
  "Assistant Manager":       7,
  "Manager 1":               8,
  "Manager 2":               9,
  "Manager 3":               10,
  "Senior Manager 1":        11,
  "Senior Manager 2":        12,
  "Senior Manager 3":        13,
  "Partner":                 14,
};

// ── Departman Eşleme ────────────────────────────────────────────────────────

/**
 * Proje departmanı → kullanıcı departmanı eşlemesi.
 * Bir projeye üye eklenirken hangi kullanıcı departmanından seçileceğini belirler.
 *
 * "YMM" projeleri → "YEMINLI_MALI_MUSAVIR" kadrosu
 */
export function projectDeptToUserDept(projectDept: string): string | null {
  if (projectDept === "BAGIMSIZ_DENETIM") return "BAGIMSIZ_DENETIM";
  if (projectDept === "YMM")             return "YEMINLI_MALI_MUSAVIR";
  if (projectDept === "MUHASEBE")        return "MUHASEBE";
  if (projectDept === "OUTSOURCE")       return "OUTSOURCE";
  return null;
}

/**
 * Kullanıcı departmanı → proje departmanı eşlemesi (ters yön).
 * Bir kullanıcının hangi proje departmanına ait olduğunu belirler.
 */
export function userDeptToProjectDept(userDept: string): string | null {
  if (userDept === "BAGIMSIZ_DENETIM")    return "BAGIMSIZ_DENETIM";
  if (userDept === "YEMINLI_MALI_MUSAVIR") return "YMM";
  if (userDept === "MUHASEBE")            return "MUHASEBE";
  if (userDept === "OUTSOURCE")           return "OUTSOURCE";
  return null;
}

/**
 * Proje oluşturma yetkisi:
 *   seniorityLevel >= 8 (Manager 1 ve üstü) VEYA ADMIN
 *   overseesDepartment → artık kullanılmıyor (seniorityLevel >= 11 kural ile kapsandı)
 */
export function canCreateProject(user: {
  seniorityLevel: number;
  role?: string;
}): boolean {
  if (user.role === "ADMIN") return true;
  return user.seniorityLevel >= 8;
}

/**
 * Proje yönetim yetkisi — tek doğru kaynak.
 *
 * Kurallar:
 *   1. ADMIN → her zaman
 *   2. canViewAllProjects=true → her zaman (admin eşdeğeri kullanıcılar)
 *   3. seniorityLevel >= 11 (Senior Manager+/Partner) + aynı departman → üyelik gerektirmez
 *   4. seniorityLevel >= 8 (Manager 1-3) + projeye üye → yönetebilir
 *   5. Diğerleri → hayır
 *
 * "Yönetim": proje düzenleme, üye ekleme/çıkarma, durumu değiştirme, arşivleme, silme.
 */
export function canManageProject(
  user: {
    id: string;
    role: string;
    department: string;
    seniorityLevel: number;
    canViewAllProjects: boolean;
    overseesDepartment?: string | null;
  },
  project: { department: string },
  isMember: boolean
): boolean {
  if (user.role === "ADMIN") return true;
  if (user.canViewAllProjects) return true;
  // Senior Manager 1+ ve Partner: kendi departmanında üyelik gerekmez
  const userProjectDept = userDeptToProjectDept(user.department);
  if (user.seniorityLevel >= 11 && userProjectDept === project.department) return true;
  // overseesDepartment (eski sistem) — backward compat
  if (user.overseesDepartment != null && user.overseesDepartment === project.department) return true;
  // Manager 1-3: projeye üye olmalı
  if (user.seniorityLevel >= 8 && isMember) return true;
  return false;
}

/**
 * Proje düzenleme yetkisi — canManageProject sarmalayıcısı.
 * @deprecated Yeni kod canManageProject kullanmalı.
 */
export function canEditProject(
  user: {
    id: string;
    role: string;
    department: string;
    seniorityLevel: number;
    canViewAllProjects: boolean;
    overseesDepartment?: string | null;
  },
  project: { createdById: string; department: string },
  isMember?: boolean
): boolean {
  return canManageProject(user, project, isMember ?? (user.id === project.createdById));
}

/**
 * Proje silme yetkisi — canManageProject ile aynı kural.
 * Silme işlemi backend'de ayrıca ARŞİVLENMİŞ durum kontrolü yapar.
 */
export function canDeleteProject(
  user: {
    id: string;
    role: string;
    department: string;
    seniorityLevel: number;
    canViewAllProjects: boolean;
    overseesDepartment?: string | null;
  },
  project: { createdById: string; department: string },
  isMember?: boolean
): boolean {
  return canManageProject(user, project, isMember ?? (user.id === project.createdById));
}

/**
 * Görev atama yetkisi (kıdeme bağlı):
 *   Atayan, hedefin seniorityLevel'ını KESİNLİKLE geçmelidir.
 */
export function canAssignTask(assignerLevel: number, targetLevel: number): boolean {
  return assignerLevel > targetLevel;
}

/**
 * Atama istisnası: belirli atayan → hedef e-posta çiftlerine,
 * canBeAssignedTasks=false kuralının uygulanmadığı istisnalar.
 */
export const ASSIGN_EXCEPTIONS: Record<string, string[]> = {
  "muratozgur@vezin.com.tr": ["ebubekirozturk@vezin.com.tr"],
};

/**
 * Proje içinde görev atama yetkisi — tek doğru kaynak (UI ve API kullanır).
 */
export function canAssignTaskInProject(
  assigner: {
    id: string;
    role: string;
    canViewAllProjects: boolean;
    overseesDepartment?: string | null;
    seniorityLevel: number;
    department?: string;
    email?: string;
  },
  project: { department: string; createdById: string },
  target?: { seniorityLevel: number; canBeAssignedTasks?: boolean; email?: string }
): boolean {
  if (target && target.canBeAssignedTasks === false) {
    const exceptions = ASSIGN_EXCEPTIONS[assigner.email?.toLowerCase() ?? ""] ?? [];
    if (!exceptions.includes(target.email?.toLowerCase() ?? "")) return false;
  }
  if (assigner.role === "ADMIN" || assigner.canViewAllProjects) return true;
  // Proje otoritesi
  const userProjectDept = userDeptToProjectDept(assigner.department ?? "");
  const hasProjectAuthority =
    (assigner.overseesDepartment != null && assigner.overseesDepartment === project.department) ||
    (assigner.seniorityLevel >= 11 && userProjectDept === project.department) ||
    assigner.id === project.createdById;
  if (!hasProjectAuthority) return false;
  if (!target) return true;
  return assigner.seniorityLevel > target.seniorityLevel;
}

/**
 * Görev silme yetkisi.
 * A BLOĞU: assignedToId tek kaynak — assigneeIds artık kontrol edilmiyor.
 */
export function canDeleteTask(
  user: { id: string; role: string; canViewAllProjects: boolean; overseesDepartment?: string | null; department?: string; seniorityLevel?: number },
  task: { createdById: string; assignedToId?: string | null },
  project?: { department: string; createdById: string } | null
): boolean {
  // Göreve atanan kişi silemez
  if (task.assignedToId === user.id) return false;
  if (user.role === "ADMIN" || user.canViewAllProjects) return true;
  if (project != null) {
    const userProjectDept = userDeptToProjectDept(user.department ?? "");
    if (user.overseesDepartment != null && user.overseesDepartment === project.department) return true;
    if ((user.seniorityLevel ?? 0) >= 11 && userProjectDept === project.department) return true;
  }
  if (task.createdById === user.id) return true;
  if (project != null && project.createdById === user.id) return true;
  return false;
}

/**
 * Performans ekranı erişim kapsamı.
 */
const PERFORMANCE_ACCESS: Record<string, "ALL" | "BAGIMSIZ_DENETIM" | "YEMINLI_MALI_MUSAVIR"> = {
  "ismailkos@vezin.com.tr":       "ALL",
  "ahmetoruc@vezin.com.tr":       "BAGIMSIZ_DENETIM",
  "muratozgur@vezin.com.tr":      "YEMINLI_MALI_MUSAVIR",
  "ebubekirozturk@vezin.com.tr":  "YEMINLI_MALI_MUSAVIR",
};

export function getPerformanceScope(user: {
  role: string;
  email: string;
}): "ALL" | "BAGIMSIZ_DENETIM" | "YEMINLI_MALI_MUSAVIR" | null {
  if (user.role === "ADMIN") return "ALL";
  return PERFORMANCE_ACCESS[user.email.toLowerCase()] ?? null;
}

/**
 * /projeler sayfaları ve /api/projects* uçlarına erişim.
 *
 * Tüm dört departman (OUTSOURCE, BAGIMSIZ_DENETIM, MUHASEBE, YMM) aktiftir.
 * Yalnızca IDARI_ISLER ve ADMIN departmanı bloklıdır.
 */
export function canAccessProjects(user: {
  role: string;
  department: string;
  canViewAllProjects?: boolean;
  overseesDepartment?: string | null;
}): boolean {
  if (user.role === "ADMIN") return true;
  if (user.canViewAllProjects) return true;
  if (user.overseesDepartment != null) return true;
  const blocked = ["IDARI_ISLER", "ADMIN"];
  return !blocked.includes(user.department?.toUpperCase());
}

/**
 * Bu rol+departman kombinasyonu verilen pathname'e erişebilir mi?
 */
export function canAccess(role: string, department: string, pathname: string): boolean {
  const r = role.toUpperCase();
  const d = department.toUpperCase();

  const strictRule = DEPT_GATED_RULES.find(
    (rr) => rr.strictDept && pathname.startsWith(rr.pathPrefix)
  );
  if (strictRule) {
    return strictRule.allowedDepts.some((dept) => d === dept.toUpperCase());
  }

  if (r === "ADMIN") return true;
  if (isAdminOnly(pathname)) return false;

  const rule = DEPT_GATED_RULES.find((rr) => !rr.strictDept && pathname.startsWith(rr.pathPrefix));
  if (!rule || rule.allowedDepts.length === 0) return true;
  return rule.allowedDepts.some((dept) => d === dept.toUpperCase());
}
