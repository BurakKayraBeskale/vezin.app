import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { redirect } from "next/navigation";
import PublicHolidaysAdmin from "@/components/admin/PublicHolidaysAdmin";

export const dynamic = "force-dynamic";

/**
 * Yönetim → Sistem Ayarları (yalnız ADMIN). Şimdilik tek bölüm: Resmî Tatiller.
 * Sayfa kapısı: middleware (/admin → ADMIN_ONLY_PREFIXES) + burada rol kontrolü;
 * API kapısı ayrıca /api/admin/holidays içinde (loadHolidayAdmin).
 */
export default async function SistemAyarlariPage() {
  const session = await getServerSession(authOptions);
  if (session?.user.role !== "ADMIN") redirect("/");

  return (
    <div className="max-w-5xl mx-auto">
      <div className="mb-5">
        <h1 className="text-xl sm:text-2xl font-bold text-gray-800">Sistem Ayarları</h1>
        <p className="text-sm text-gray-400 mt-1">Uygulama genelinde kullanılan merkezi ayarlar</p>
      </div>
      <nav className="mb-5 flex gap-1 border-b border-gray-100" aria-label="Sistem Ayarları bölümleri">
        <span aria-current="page" className="px-3 py-2 text-sm font-semibold text-[#F57C28] border-b-2 border-[#F57C28] -mb-px">
          Resmî Tatiller
        </span>
      </nav>
      <PublicHolidaysAdmin />
    </div>
  );
}
