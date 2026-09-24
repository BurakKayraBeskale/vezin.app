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

/**
 * /rotasyon sayfalarına ve /api/rotasyon/* uçlarına erişim.
 *
 * Rotasyon modülü, ADMIN rolünün global istisna olduğu bir modül DEĞİLDİR —
 * erişim yalnızca canAccessRotasyon bayrağıyla verilir, çünkü ADMIN rolüne
 * sahip bazı kullanıcıların bu modülü görmemesi gerekiyor.
 * Kıdemden, departmandan veya e-postadan ASLA türetilmez; rol kısayolu yoktur.
 * Yetkisiz erişimde çağıran taraf 404 döner (403 değil).
 */
export function canAccessRotasyon(user: { role: string; canAccessRotasyon?: boolean }): boolean {
  return user.canAccessRotasyon === true;
}

/**
 * YMM araçları (Beyanname sayfası ve KDV İade XML liste uçları) erişim kuralı —
 * sayfa guard'ı, API uçları ve Sidebar bu tek fonksiyonu çağırır.
 *
 * Erişebilenler (aktif kullanıcılar):
 *   - department === "YEMINLI_MALI_MUSAVIR" (kıdem sınırı YOK — asistan dahil)
 *   - ADMIN
 *   - canViewAllProjects === true
 * Bağımsız Denetim, Muhasebe, İdari İşler, Outsource kullanamaz.
 * Rol string'ine (MANAGER vb.) değil departmana bağlıdır.
 * Yetkisiz erişimde çağıran taraf 404 döner (403 değil).
 */
export function canUseYmmTools(user: {
  role?: string | null;
  department?: string | null;
  canViewAllProjects?: boolean | null;
  status?: string | null;
}): boolean {
  if (user.status === "INACTIVE" || user.status === "DELETED") return false;
  if (user.role === "ADMIN") return true;
  if (user.canViewAllProjects === true) return true;
  return user.department === "YEMINLI_MALI_MUSAVIR";
}

/**
 * canUseYmmTools ile korunan path önekleri. Middleware bu yollarda departman
 * kısıtını uygulamaz (redirect yerine sayfa/API kendi 404'ünü döner).
 */
export const YMM_TOOL_PATH_PREFIXES = [
  "/beyanname",
  "/api/kdv-iade/indirilecek-liste",
  "/api/kdv-iade/yuklenilen-liste",
  "/api/kdv-iade/satis-listesi",
];

export function isYmmToolPath(pathname: string): boolean {
  return YMM_TOOL_PATH_PREFIXES.some((p) => pathname === p || pathname.startsWith(p + "/"));
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
 * İzin Yönetimi — onay zinciri (bkz. app/(app)/leave, app/api/leave).
 *
 * Talep sahibinin User.department değerine göre onaylayıcı(lar):
 *   YEMINLI_MALI_MUSAVIR              → Murat Özgür (birincil) + Ebubekir Öztürk
 *   BAGIMSIZ_DENETIM                  → Ahmet Oruç
 *   MUHASEBE / IDARI_ISLER / OUTSOURCE / ADMIN (ve eşleşmeyen her departman) → İsmail Koş
 *
 * E-posta bazlı eşlemede tutulur, rol string'ine (MANAGER vb.) ASLA bağlanmaz.
 * Murat Özgür, Ebubekir Öztürk ve Ahmet Oruç'un GERÇEK User.department alanı
 * "OUTSOURCE" (varsayılan; hiçbiri departman kayıtlarında YMM/BD olarak
 * saklanmaz — erişimleri her yerde overseesDepartment/e-posta üzerinden
 * yürür) olduğundan, kendi talepleri de doğal olarak İsmail Koş/ADMIN
 * onayına düşer — bunun için ayrıca özel bir istisna yazılmadı.
 */
const LEAVE_APPROVERS_BY_DEPARTMENT: Record<string, string[]> = {
  YEMINLI_MALI_MUSAVIR: ["muratozgur@vezin.com.tr", "ebubekirozturk@vezin.com.tr"],
  BAGIMSIZ_DENETIM:     ["ahmetoruc@vezin.com.tr"],
  MUHASEBE:              ["ismailkos@vezin.com.tr"],
  IDARI_ISLER:           ["ismailkos@vezin.com.tr"],
  OUTSOURCE:             ["ismailkos@vezin.com.tr"],
  ADMIN:                 ["ismailkos@vezin.com.tr"],
};

/** Verilen (talep sahibinin) departmanı için onaylayabilecek e-postalar. Eşleşmeyen departman → İsmail Koş. */
export function getLeaveApprovers(department: string | null | undefined): string[] {
  const key = (department ?? "").toUpperCase();
  return LEAVE_APPROVERS_BY_DEPARTMENT[key] ?? ["ismailkos@vezin.com.tr"];
}

/**
 * Bu kullanıcı verilen izin talebini onaylayabilir/reddedebilir mi?
 * Kimse KENDİ talebini onaylayamaz (ADMIN dahil). ADMIN dışında e-posta
 * getLeaveApprovers(request.userDepartment) listesinde olmalı.
 */
export function canApproveLeave(
  user: { id: string; role: string; email?: string | null },
  request: { userId: string; userDepartment: string }
): boolean {
  if (request.userId === user.id) return false;
  if (user.role === "ADMIN") return true;
  const approvers = getLeaveApprovers(request.userDepartment);
  return approvers.includes((user.email ?? "").toLowerCase());
}

/**
 * İzin Yönetimi — "Personel İzin Durumu" (/izin-durumu) kapsamı: bu kullanıcı
 * hangi departmanın personel listesini/izin geçmişini görebilir. Tek doğru
 * kaynak — mevcut getPerformanceScope deseni örnek alınmıştır (bkz. yukarıda).
 * canViewAllProjects/canViewAllTasks'tan ASLA TÜRETİLMEZ; e-posta bazlı
 * eşleme. Bu, aynı zamanda "kim izin onaylayabilir" kümesiyle birebir aynıdır
 * (getLeaveApprovers'ın kapsadığı departmanların birleşimi) — tek kaynaktan
 * geldiği için ayrı bir liste olarak tutulmaz.
 *
 *   ADMIN, İsmail Koş           → "ALL"
 *   Murat Özgür, Ebubekir Öztürk → "YEMINLI_MALI_MUSAVIR"
 *   Ahmet Oruç                  → "BAGIMSIZ_DENETIM"
 *   Diğer herkes                → null (bölüm hiç görünmez, API 404 döner)
 */
export function getLeaveOverviewScope(user: {
  role: string;
  email?: string | null;
}): "ALL" | "YEMINLI_MALI_MUSAVIR" | "BAGIMSIZ_DENETIM" | null {
  if (user.role === "ADMIN") return "ALL";
  const email = (user.email ?? "").toLowerCase();
  if (email === "ismailkos@vezin.com.tr") return "ALL";
  if (email === "muratozgur@vezin.com.tr" || email === "ebubekirozturk@vezin.com.tr") return "YEMINLI_MALI_MUSAVIR";
  if (email === "ahmetoruc@vezin.com.tr") return "BAGIMSIZ_DENETIM";
  return null;
}

/**
 * Bu kullanıcı hangi departmanların izin taleplerini GÖREBİLİR (kendi talepleri
 * ayrıca her zaman görülür, burada dahil değildir).
 * getLeaveOverviewScope'un dizi biçimindeki sarmalayıcısı — istek bazlı
 * görünürlük (buildLeaveVisibilityWhere, GET /api/leave/[id]) tarafından
 * kullanılır; kural TEK yerde (getLeaveOverviewScope) tanımlıdır.
 */
export function getLeaveViewScope(user: { role: string; email?: string | null }): "ALL" | string[] {
  const scope = getLeaveOverviewScope(user);
  if (scope === "ALL") return "ALL";
  if (scope === null) return [];
  return [scope];
}

/**
 * İzin talepleri listesi için Prisma WHERE filtresi — tek doğru kaynak.
 * Her zaman kendi talepleri + (varsa) getLeaveViewScope kapsamındaki
 * departmanların talepleri.
 */
export function buildLeaveVisibilityWhere(user: { id: string; role: string; email?: string | null }): object {
  const scope = getLeaveViewScope(user);
  if (scope === "ALL") return {};
  if (scope.length === 0) return { userId: user.id };
  return { OR: [{ userId: user.id }, { user: { department: { in: scope } } }] };
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
