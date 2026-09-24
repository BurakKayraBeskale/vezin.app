import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { redirect, notFound } from "next/navigation";
import { getPerformanceScope } from "@/lib/access";
import PerformancePanel from "@/components/PerformancePanel";

export const dynamic = "force-dynamic";

export default async function PerformansPage() {
  const session = await getServerSession(authOptions);
  if (!session) redirect("/login");

  const user = session.user as any;

  // Erişim kontrolü — mevcut getPerformanceScope tek doğru kaynak (lib/access.ts).
  // Yeni bir kural yazılmadı; canViewAllProjects'ten TÜRETİLMEDİ (Murat Özgür'ün
  // bayrağı kapalı ama e-posta bazlı eşlemeden erişimi var). Yetkisiz erişimde
  // 404 (403 değil) — diğer kısıtlı modüllerle tutarlı.
  const scope = getPerformanceScope({ role: user.role, email: user.email ?? "" });
  if (!scope) notFound();

  return (
    <div className="max-w-screen-2xl mx-auto">
      <div className="mb-2">
        <h1 className="text-xl sm:text-2xl font-bold text-gray-800 dark:text-gray-100">Personel Performansı</h1>
        <p className="text-sm text-gray-400 dark:text-gray-500 mt-1">
          Görev tamamlama başarı oranı — isme tıklayarak dökümü görüntüleyin
        </p>
      </div>
      <PerformancePanel />
    </div>
  );
}
