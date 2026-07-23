import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { redirect } from "next/navigation";
import BeyannameUploader from "@/components/BeyannameUploader";

export default async function BeyannamePage() {
  const session = await getServerSession(authOptions);
  if (!session) redirect("/login");

  const { role, department } = session.user as any;
  if (role !== "ADMIN" && department !== "YEMINLI_MALI_MUSAVIR") redirect("/");

  return (
    <div className="p-6 lg:p-8 max-w-3xl mx-auto">
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Beyanname Oluştur</h1>
        <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
          PDF veya görsel yükleyin — yapay zeka verileri çıkarır, Excel olarak indirin.
        </p>
      </div>
      <BeyannameUploader />
    </div>
  );
}
