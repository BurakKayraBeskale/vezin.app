import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { redirect } from "next/navigation";
import MailDraftPanel from "@/components/MailDraftPanel";

export const dynamic = "force-dynamic";

export default async function MailDraftPage() {
  const session = await getServerSession(authOptions);
  if (!session) redirect("/login");

  return (
    <div className="p-6 lg:p-8">
      <div className="mb-6">
        <h1 className="text-xl font-bold text-gray-800 dark:text-white">Mail Taslağı</h1>
        <p className="text-sm text-gray-400 mt-1">
          Konu ve kısa notunla profesyonel bir iş maili oluştur.
        </p>
      </div>
      <MailDraftPanel />
    </div>
  );
}
