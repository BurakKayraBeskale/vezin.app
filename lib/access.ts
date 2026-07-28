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

/** Departman kısıtı olan kurallar — SADECE EMPLOYEE rolü için geçerlidir */
export interface DeptRule {
  pathPrefix: string;
  allowedDepts: string[]; // boş = herkese açık
}

export const DEPT_GATED_RULES: DeptRule[] = [
  { pathPrefix: "/beyanname",       allowedDepts: ["YEMINLI_MALI_MUSAVIR"] },
  { pathPrefix: "/karsit-inceleme", allowedDepts: ["YEMINLI_MALI_MUSAVIR", "MUHASEBE"] },
  { pathPrefix: "/companies",       allowedDepts: ["BAGIMSIZ_DENETIM"] },
  // /karsilastirma ve /tarayici herkese açık — kural yok
];

/**
 * Bu rol+departman kombinasyonu verilen pathname'e erişebilir mi?
 * middleware, page guard ve API route'larında birebir aynı mantık.
 */
export function canAccess(role: string, department: string, pathname: string): boolean {
  const r = role.toUpperCase();
  const d = department.toUpperCase();

  // ADMIN: her şeye erişir
  if (r === "ADMIN") return true;

  // Admin-only path'lere ADMIN dışı kimse giremez
  if (isAdminOnly(pathname)) return false;

  // MANAGER: admin-only dışı her şeye erişir (departmana bakılmaz)
  if (r === "MANAGER") return true;

  // EMPLOYEE: departman kurallarına bak
  const rule = DEPT_GATED_RULES.find((rr) => pathname.startsWith(rr.pathPrefix));
  if (!rule || rule.allowedDepts.length === 0) return true; // kural yoksa açık
  return rule.allowedDepts.some((dept) => d === dept.toUpperCase());
}
