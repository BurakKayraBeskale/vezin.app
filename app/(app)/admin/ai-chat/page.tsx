import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { redirect } from "next/navigation";
import AiChat from "@/components/AiChat";

export const dynamic = "force-dynamic";

export default async function AiChatPage() {
  const session = await getServerSession(authOptions);
  if (session?.user.role !== "ADMIN") redirect("/");

  return (
    <div className="p-6">
      <div className="mb-4">
        <h1 className="text-xl font-bold text-gray-800">AI Sohbet</h1>
        <p className="text-sm text-gray-400 mt-1">
          Muhasebe ve vergi konularında AI asistanıyla sohbet edin.
        </p>
      </div>
      <AiChat />
    </div>
  );
}
