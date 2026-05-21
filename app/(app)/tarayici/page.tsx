import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { redirect } from "next/navigation";
import GorselToExcel from "@/components/GorselToExcel";

export default async function TarayiciPage() {
  const session = await getServerSession(authOptions);
  if (!session) redirect("/login");

  const { role, department } = session.user as any;
  if (role !== "ADMIN" && department !== "BAGIMSIZ_DENETIM") redirect("/");

  return (
    <div className="p-6 lg:p-8 max-w-3xl mx-auto">
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Görsel → Excel Dönüştürücü</h1>
        <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
          e-Devlet çıktısı, vergi levhası, banka ekstresi, ekran görüntüsü gibi görselleri Excel&apos;e dönüştürün.
        </p>
      </div>
      <GorselToExcel />
    </div>
  );
}
