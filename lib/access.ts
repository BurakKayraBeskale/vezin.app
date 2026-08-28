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

/** ADMIN veya MANAGER mı? */
export function isManagerOrAdmin(role: string): boolean {
  const r = role.toUpperCase();
  return r === "ADMIN" || r === "MANAGER";
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
export const TITLE_TO_SENIORITY: Record<string, number> = {
  "Asistant": 0,
  "Experienced Assistant 1": 1,
  "Experienced Assistant 2": 1,
  "Experienced Audit Assistant 1": 1,
  "Senior 1": 2,
  "Senior 2": 3,
  "Asistant Manager": 4,
  "Manager 1": 5,
  "Manager 2": 6,
  "Manager 3": 7,
  "Senior Manager 1": 8,
  "Senior Manager 2": 9,
  "Senior Manager 3": 10,
  "Partner": 14,
  "YMM": 100,
};

/**
 * Proje açma yetkisi:
 *   seniorityLevel >= 5 (Manager 1 ve üstü) VEYA overseesDepartment != null
 */
export function canCreateProject(user: {
  seniorityLevel: number;
  overseesDepartment?: string | null;
}): boolean {
  return user.seniorityLevel >= 5 || user.overseesDepartment != null;
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

  // MANAGER: admin-only dışı her şeye erişir (departmana bakılmaz)
  if (r === "MANAGER") return true;

  // EMPLOYEE: departman kurallarına bak
  const rule = DEPT_GATED_RULES.find((rr) => !rr.strictDept && pathname.startsWith(rr.pathPrefix));
  if (!rule || rule.allowedDepts.length === 0) return true; // kural yoksa açık
  return rule.allowedDepts.some((dept) => d === dept.toUpperCase());
}
