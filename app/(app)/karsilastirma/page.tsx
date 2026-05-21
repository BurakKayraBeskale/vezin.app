import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { redirect } from "next/navigation";
import KarsilastirmaTabs from "@/components/KarsilastirmaTabs";

export default async function KarsilastirmaPage() {
  const session = await getServerSession(authOptions);
  if (!session) redirect("/login");

  const { role, department } = session.user as any;
  const canView = role === "ADMIN" || department === "MUHASEBE";
  if (!canView) redirect("/");

  return (
    <div className="p-6 lg:p-8 max-w-5xl mx-auto">
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Karşılaştırma</h1>
        <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
          Muhasebe dönüştürme ve karşılaştırma araçları.
        </p>
      </div>
      <KarsilastirmaTabs />
    </div>
  );
}
