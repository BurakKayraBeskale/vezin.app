/**
 * Merkezi yetki kuralları — middleware, Sidebar ve API rotalarında tek kaynak.
 *
 * ADMIN   : her şeye erişir
 * MANAGER : /admin/* path'leri hariç her şeye erişir; departmana bakılmaz
 * EMPLOYEE: departman kısıtlarına tabi (DEPT_GATED_RULES)
 */

/** Yalnızca ADMIN'in erişebildiği path önekleri */
export const ADMIN_ONLY_PREFIXES = ["/admin"];

/** Path'in admin-only olup olmadığı */
export function isAdminOnly(pathname: string): boolean {
  return ADMIN_ONLY_PREFIXES.some((p) => pathname.startsWith(p));
}

/** ADMIN mı? (MANAGER rolü kaldırıldı; bu fonksiyon geriye dönük uyumluluk için korunuyor) */
export function isManagerOrAdmin(role: string): boolean {
  return role.toUpperCase() === "ADMIN";
}

/** Departman kısıtı olan kurallar — EMPLOYEE rolü için geçerlidir */
export interface DeptRule {
  pathPrefix: string;
  allowedDepts: string[]; // boş = herkese açık
  /** true ise ADMIN ve MANAGER da departman kısıtına tabidir */
  strictDept?: boolean;
}

export const DEPT_GATED_RULES: DeptRule[] = [
  { pathPrefix: "/beyanname",       allowedDepts: ["YEMINLI_MALI_MUSAVIR"] },
  { pathPrefix: "/karsit-inceleme", allowedDepts: ["YEMINLI_MALI_MUSAVIR", "MUHASEBE"] },
  // KDV İade — rol fark etmeksizin sadece YMM/Muhasebe erişir (ADMIN dahil)
  { pathPrefix: "/kdv-iade",        allowedDepts: ["YEMINLI_MALI_MUSAVIR", "MUHASEBE"], strictDept: true },
  { pathPrefix: "/api/kdv-iade",    allowedDepts: ["YEMINLI_MALI_MUSAVIR", "MUHASEBE"], strictDept: true },
  // /karsilastirma ve /tarayici herkese açık — kural yok
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
 * Tek doğru kaynak: unvan → kıdem seviyesi.
 * Seed'de seniorityLevel ataması buraya göre yapılır; kod içinde
 * bu tablodan türetme yapılmaz — canViewAllProjects ve overseesDepartment
 * yalnızca DB'deki boolean/string alandan okunur.
 */
/**
 * Tek doğru kaynak: unvan → kıdem seviyesi (14-seviyeli sistem).
 * Seed'de ve API'de seniorityLevel ataması buraya göre yapılır.
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

/**
 * Proje açma yetkisi:
 *   seniorityLevel >= 8 (Manager 1 ve üstü) VEYA overseesDepartment != null
 */
export function canCreateProject(user: {
  seniorityLevel: number;
  overseesDepartment?: string | null;
}): boolean {
  return user.seniorityLevel >= 8 || user.overseesDepartment != null;
}

/**
 * Görev atama yetkisi (kıdeme bağlı):
 *   Atayan, hedefin seniorityLevel'ını KESİNLİKLE geçmelidir.
 *   Eşit veya yüksek kıdemliye atama yapılamaz.
 */
export function canAssignTask(assignerLevel: number, targetLevel: number): boolean {
  return assignerLevel > targetLevel;
}

/**
 * Proje departmanını kullanıcı departmanına eşler.
 * "VERGI" projelerinde çalışanlar kadro tarafında "YEMINLI_MALI_MUSAVIR" olarak tutulur.
 * ADMIN/MUHASEBE/IDARI_ISLER/OUTSOURCE hiçbir projeye üye olamaz (null döner → filtre geçersiz).
 */
export function projectDeptToUserDept(projectDept: string): string | null {
  if (projectDept === "BAGIMSIZ_DENETIM") return "BAGIMSIZ_DENETIM";
  if (projectDept === "VERGI") return "YEMINLI_MALI_MUSAVIR";
  return null;
}

/**
 * Proje silme yetkisi (tek doğru kaynak — route ve UI buradan çağırır):
 *   1. ADMIN → her zaman silebilir
 *   2. Departman gözetmeni (overseesDepartment) → kendi departmanındaki projeyi silebilir
 *   3. Projeyi oluşturan kişi (createdById) → kendi projesini silebilir
 *   Hiçbiri sağlanmıyorsa → false (route 404 döndürür, buton gizlenir)
 */
export function canDeleteProject(
  user: { id: string; role: string; overseesDepartment?: string | null },
  project: { createdById: string; department: string }
): boolean {
  if (user.role === "ADMIN") return true;
  if (user.overseesDepartment != null && project.department === user.overseesDepartment) return true;
  if (project.createdById === user.id) return true;
  return false;
}

/**
 * Proje düzenleme yetkisi — canDeleteProject ile birebir aynı kural:
 *   1. ADMIN → her zaman düzenleyebilir
 *   2. Departman gözetmeni → kendi departmanındaki projeyi düzenleyebilir
 *   3. Projeyi oluşturan kişi → kendi projesini düzenleyebilir
 *   Hiçbiri sağlanmıyorsa → false (route 404 döndürür, buton gizlenir)
 */
export function canEditProject(
  user: { id: string; role: string; overseesDepartment?: string | null },
  project: { createdById: string; department: string }
): boolean {
  if (user.role === "ADMIN") return true;
  if (user.overseesDepartment != null && project.department === user.overseesDepartment) return true;
  if (project.createdById === user.id) return true;
  return false;
}

/**
 * Atama istisnası: belirli atayan → hedef e-posta çiftlerine,
 * canBeAssignedTasks=false kuralının uygulanmadığı istisnalar.
 *
 * Kural: ASSIGN_EXCEPTIONS[atayan.email] içinde hedef.email varsa atamaya izin ver.
 */
export const ASSIGN_EXCEPTIONS: Record<string, string[]> = {
  "muratozgur@vezin.com.tr": ["ebubekirozturk@vezin.com.tr"],
};

/**
 * Proje içinde görev atama yetkisi — tek doğru kaynak (UI ve API kullanır).
 *
 * Kural:
 *   ADMIN veya canViewAllProjects → kıdem koşulu uygulanmaz, doğrudan true.
 *   Diğerleri (overseer / proje kurucusu):
 *     A) Proje otoritesi sağlanmalı (overseer VEYA kurucu)
 *     B) assigner.seniorityLevel > target.seniorityLevel (kesin büyük)
 *
 * target isteğe bağlıdır; verilmezse yalnızca otorite kontrolü yapılır
 * (UI'dan "bu kişiye görev atama butonu gösterilsin mi?" sorusu için).
 */
export function canAssignTaskInProject(
  assigner: {
    id: string;
    role: string;
    canViewAllProjects: boolean;
    overseesDepartment?: string | null;
    seniorityLevel: number;
    email?: string;
  },
  project: { department: string; createdById: string },
  target?: { seniorityLevel: number; canBeAssignedTasks?: boolean; email?: string }
): boolean {
  // canBeAssignedTasks=false → HİÇBİR DURUMDA atama yapılamaz (ADMIN dahil)
  // İstisna: ASSIGN_EXCEPTIONS'da tanımlı atayan→hedef e-posta ikilisi
  if (target && target.canBeAssignedTasks === false) {
    const exceptions = ASSIGN_EXCEPTIONS[assigner.email?.toLowerCase() ?? ""] ?? [];
    if (!exceptions.includes(target.email?.toLowerCase() ?? "")) return false;
  }
  // ADMIN / canViewAllProjects → kıdem koşulu HİÇ uygulanmaz
  if (assigner.role === "ADMIN" || assigner.canViewAllProjects) return true;
  // Proje otoritesi (overseer veya kurucu)
  const hasProjectAuthority =
    (assigner.overseesDepartment != null && assigner.overseesDepartment === project.department) ||
    assigner.id === project.createdById;
  if (!hasProjectAuthority) return false;
  // Yalnızca otorite soruluyorsa (target yok) → yeterli
  if (!target) return true;
  // Kıdem koşulu — overseer ve kurucu için zorunlu
  return assigner.seniorityLevel > target.seniorityLevel;
}

/**
 * Görev silme yetkisi (tek doğru kaynak — route ve UI buradan çağırır):
 *   0. Göreve atanan kişi (assignee) → HİÇBİR DURUMDA silemez (ADMIN dahil)
 *   1. ADMIN veya canViewAllProjects → her zaman silebilir
 *   2. Departman gözetmeni → kendi departmanındaki projenin görevini silebilir
 *   3. Görevi oluşturan kişi (createdById) → kendi oluşturduğu görevi silebilir
 *   4. Projeyi oluşturan kişi → projesindeki herhangi bir görevi silebilir
 *   Hiçbiri sağlanmıyorsa → false (route 404 döndürür, buton gizlenir)
 */
export function canDeleteTask(
  user: { id: string; role: string; canViewAllProjects: boolean; overseesDepartment?: string | null },
  task: { createdById: string; assignedToId?: string | null; assigneeIds?: string[] },
  project?: { department: string; createdById: string } | null
): boolean {
  // Kural 0: Atanan kişi HİÇBİR DURUMDA silemez (ADMIN dahil)
  const assigneeIds = task.assigneeIds ?? [];
  if (task.assignedToId === user.id || assigneeIds.includes(user.id)) return false;
  // Kural 1: ADMIN veya canViewAllProjects → her zaman silebilir
  if (user.role === "ADMIN" || user.canViewAllProjects) return true;
  // Kural 2: Departman gözetmeni → kendi departmanındaki proje görevini silebilir
  if (project != null && user.overseesDepartment != null && user.overseesDepartment === project.department) return true;
  // Kural 3: Görevi oluşturan kişi → kendi oluşturduğu görevi silebilir
  if (task.createdById === user.id) return true;
  // Kural 4: Projeyi oluşturan kişi → projesindeki görevi silebilir
  if (project != null && project.createdById === user.id) return true;
  return false;
}

/**
 * Performans ekranı erişim kapsamı — e-posta bazlı, canViewAllProjects'ten BAĞIMSIZ.
 *
 * "ALL"                  → her iki birimi görebilir (ADMIN + İsmail Koş)
 * "BAGIMSIZ_DENETIM"     → yalnızca bağımsız denetim birimi (Ahmet Oruç)
 * "YEMINLI_MALI_MUSAVIR" → yalnızca YMM birimi (Murat Özgür, Ebubekir Öztürk)
 * null                   → bu bölümü hiç göremez
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
 * /projeler sayfaları ve /api/projects* uçlarına erişim:
 *   - ADMIN → her zaman erişebilir
 *   - canViewAllProjects=true → erişebilir (İsmail Koş, Murat Özgür)
 *   - overseesDepartment != null → erişebilir (Ahmet Oruç, Ebubekir Öztürk)
 *   - MUHASEBE veya IDARI_ISLER departmanı → HAYIR (diğer tüm istisnalar hariç)
 *   - Diğer departmanlar → erişebilir
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
  const blocked = ["MUHASEBE", "IDARI_ISLER"];
  return !blocked.includes(user.department.toUpperCase());
}

/**
 * Bu rol+departman kombinasyonu verilen pathname'e erişebilir mi?
 * middleware, page guard ve API route'larında birebir aynı mantık.
 */
export function canAccess(role: string, department: string, pathname: string): boolean {
  const r = role.toUpperCase();
  const d = department.toUpperCase();

  // Önce strictDept kurallarını kontrol et (ADMIN dahil herkese uygulanır)
  const strictRule = DEPT_GATED_RULES.find(
    (rr) => rr.strictDept && pathname.startsWith(rr.pathPrefix)
  );
  if (strictRule) {
    return strictRule.allowedDepts.some((dept) => d === dept.toUpperCase());
  }

  // ADMIN: (strictDept dışında) her şeye erişir
  if (r === "ADMIN") return true;

  // Admin-only path'lere ADMIN dışı kimse giremez
  if (isAdminOnly(pathname)) return false;

  // EMPLOYEE: departman kurallarına bak
  const rule = DEPT_GATED_RULES.find((rr) => !rr.strictDept && pathname.startsWith(rr.pathPrefix));
  if (!rule || rule.allowedDepts.length === 0) return true; // kural yoksa açık
  return rule.allowedDepts.some((dept) => d === dept.toUpperCase());
}
