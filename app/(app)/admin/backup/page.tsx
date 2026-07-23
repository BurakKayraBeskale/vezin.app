import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { redirect } from "next/navigation";
import BackupPanel from "@/components/BackupPanel";
import { BYPASS_AUTH_ROLES } from "@/lib/auth-bypass";

export const dynamic = "force-dynamic";

export default async function BackupPage() {
  const session = await getServerSession(authOptions);
  if (session?.user.role !== "ADMIN") redirect("/");

  return (
    <div className="p-6 lg:p-8">
      <div className="mb-6">
        <h1 className="text-xl font-bold text-gray-800 dark:text-white">Yedekleme & Raporlama</h1>
        <p className="text-sm text-gray-400 mt-1">
          Seçilen tarih aralığındaki tüm verileri Excel olarak indirin.
        </p>
      </div>
      <BackupPanel />
    </div>
  );
}
