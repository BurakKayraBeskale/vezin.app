import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { redirect } from "next/navigation";
import BeyannameUploader from "@/components/BeyannameUploader";
import { canAccess } from "@/lib/access";

export default async function BeyannamePage() {
  const session = await getServerSession(authOptions);
  if (!session) redirect("/login");

  const { role, department } = session.user as any;
  if (!canAccess(role, department, "/beyanname")) redirect("/");

  return (
    <div className="p-6 lg:p-8 max-w-3xl mx-auto">
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Beyanname Oluştur</h1>
      </div>
      <BeyannameUploader />
    </div>
  );
}
