import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { redirect } from "next/navigation";
import AiManager from "@/components/AiManager";

export const dynamic = "force-dynamic";

export default async function AiManagerPage() {
  const session = await getServerSession(authOptions);
  if (session?.user.role !== "ADMIN") redirect("/");

  return (
    <div className="p-6">
      <div className="mb-6">
        <h1 className="text-xl font-bold text-white">AI Yöneticisi</h1>
        <p className="text-sm text-white/45 mt-1">
          AI modülleri için kullanılan promptları görüntüleyin ve düzenleyin.
        </p>
      </div>
      <AiManager />
    </div>
  );
}
