/**
 * TEST BYPASS — rol/departman kısıtlarını geçici devre dışı bırakır.
 * Kısıtları geri açmak için: false yapıp deploy et.
 *
 * Etkilenen dosyalar: middleware.ts, Sidebar.tsx,
 * app/(app)/*/page.tsx, app/api/*\/route.ts
 */
export const BYPASS_AUTH_ROLES = true;
