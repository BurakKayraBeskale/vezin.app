import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { redirect } from "next/navigation";
import MailDraftPanel from "@/components/MailDraftPanel";
import DocumentSummaryPanel from "@/components/DocumentSummaryPanel";

export const dynamic = "force-dynamic";

export default async function MailDraftPage() {
  const session = await getServerSession(authOptions);
  if (!session) redirect("/login");

  return (
    <div className="p-6 lg:p-8">
      <div className="mb-6">
        <h1 className="text-xl font-bold text-gray-800 dark:text-white">Mail Taslağı & Belge Özeti</h1>
        <p className="text-sm text-gray-400 mt-1">
          Profesyonel iş maili oluştur veya belge yükleyerek otomatik özet çıkar.
        </p>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-2 gap-8 items-start">
        {/* Sol: Mail Taslağı */}
        <div>
          <h2 className="text-sm font-semibold text-gray-500 uppercase tracking-wider mb-4">Mail Taslağı</h2>
          <MailDraftPanel />
        </div>

        {/* Sağ: Belge Özeti */}
        <div>
          <h2 className="text-sm font-semibold text-gray-500 uppercase tracking-wider mb-4">Belge Özeti</h2>
          <DocumentSummaryPanel />
        </div>
      </div>
    </div>
  );
}
