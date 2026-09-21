import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { redirect, notFound } from "next/navigation";
import BeyannameUploader from "@/components/BeyannameUploader";
import { canUseYmmTools } from "@/lib/access";

export default async function BeyannamePage() {
  const session = await getServerSession(authOptions);
  if (!session) redirect("/login");

  // YMM kadrosu / ADMIN / canViewAllProjects — yetkisiz erişimde 404 (403 değil)
  if (!canUseYmmTools(session.user as any)) notFound();

  return (
    <div className="p-6 lg:p-8 max-w-3xl mx-auto">
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Beyanname Oluştur</h1>
      </div>
      <BeyannameUploader />
    </div>
  );
}
