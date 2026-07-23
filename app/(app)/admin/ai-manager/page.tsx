import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { redirect } from "next/navigation";
import AiManager from "@/components/AiManager";
import { BYPASS_AUTH_ROLES } from "@/lib/auth-bypass";

export const dynamic = "force-dynamic";

export default async function AiManagerPage() {
  const session = await getServerSession(authOptions);
  if (session?.user.role !== "ADMIN") redirect("/");

  return (
    <div className="p-6">
      <div className="mb-6">
        <h1 className="text-xl font-bold text-gray-800">AI Yöneticisi</h1>
        <p className="text-sm text-gray-400 mt-1">
          AI modülleri için kullanılan promptları görüntüleyin ve düzenleyin.
        </p>
      </div>
      <AiManager />
    </div>
  );
}
