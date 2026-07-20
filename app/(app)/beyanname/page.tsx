import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { redirect } from "next/navigation";
import BeyannameUploader from "@/components/BeyannameUploader";

export default async function BeyannamePage() {
  const session = await getServerSession(authOptions);
  if (!session) redirect("/login");

  const { role } = session.user as any;
  if (role !== "ADMIN") redirect("/");

  return (
    <div className="-m-4 sm:-m-5 lg:-m-6 p-6 lg:p-8 min-h-screen bg-[#0B1A3D]">
      <div className="max-w-3xl mx-auto">
        <div className="mb-8">
          <h1 className="text-2xl font-bold text-white">Beyanname Oluştur</h1>
          <p className="mt-1 text-sm text-blue-200">
            PDF veya görsel yükleyin — yapay zeka verileri çıkarır, Excel olarak indirin.
          </p>
        </div>
        <BeyannameUploader />
      </div>
    </div>
  );
}
