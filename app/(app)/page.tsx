import { getServerSession } from "next-auth";
import { redirect } from "next/navigation";
import { authOptions } from "@/lib/auth";
import DashboardScreen from "@/components/dashboard/DashboardScreen";

export const dynamic = "force-dynamic";

/**
 * Dashboard — çalışma kontrol merkezi. Veri ve yetki kuralları sunucuda:
 * /api/dashboard (lib/dashboard/service.ts), /api/dashboard/people (lib/dashboard/people.ts).
 * ?person= yalnız geri dönüşte seçimi korumak içindir; yetki API'de doğrulanır.
 */
export default async function DashboardPage({ searchParams }: { searchParams?: { person?: string } }) {
  const session = await getServerSession(authOptions);
  if (!session) redirect("/login");
  const user = session.user as { id: string; name?: string | null; role?: string };

  return (
    <DashboardScreen
      currentUser={{ id: user.id, name: user.name ?? "" }}
      initialPersonId={searchParams?.person}
      isAdmin={user.role === "ADMIN"}
    />
  );
}
