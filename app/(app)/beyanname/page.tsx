import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { redirect } from "next/navigation";

export default async function BeyannamePage() {
  const session = await getServerSession(authOptions);
  if (!session) redirect("/login");

  const { department } = session.user as any;
  if (department !== "YEMINLI_MALI_MUSAVIR") redirect("/");

  return (
    <div className="p-6 lg:p-8 max-w-4xl mx-auto">
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Beyanname Oluştur</h1>
        <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
          Bu özellik yakında aktif olacak.
        </p>
      </div>

      <div className="rounded-2xl border-2 border-dashed border-gray-200 dark:border-white/10 bg-gray-50 dark:bg-white/[0.03] p-12 flex flex-col items-center justify-center text-center min-h-[420px] gap-6">
        <div className="w-16 h-16 rounded-2xl bg-[#F57C28]/10 flex items-center justify-center">
          <svg
            className="w-8 h-8 text-[#F57C28]"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
            strokeWidth={1.5}
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              d="M9.813 15.904L9 18.75l-.813-2.846a4.5 4.5 0 00-3.09-3.09L2.25 12l2.846-.813a4.5 4.5 0 003.09-3.09L9 5.25l.813 2.846a4.5 4.5 0 003.09 3.09L15.75 12l-2.846.813a4.5 4.5 0 00-3.09 3.09zM18.259 8.715L18 9.75l-.259-1.035a3.375 3.375 0 00-2.455-2.456L14.25 6l1.036-.259a3.375 3.375 0 002.455-2.456L18 2.25l.259 1.035a3.375 3.375 0 002.456 2.456L21.75 6l-1.035.259a3.375 3.375 0 00-2.456 2.456zM16.894 20.567L16.5 21.75l-.394-1.183a2.25 2.25 0 00-1.423-1.423L13.5 18.75l1.183-.394a2.25 2.25 0 001.423-1.423l.394-1.183.394 1.183a2.25 2.25 0 001.423 1.423l1.183.394-1.183.394a2.25 2.25 0 00-1.423 1.423z"
            />
          </svg>
        </div>

        <div>
          <h2 className="text-lg font-semibold text-gray-700 dark:text-white/70">
            Yapay Zeka ile Beyanname
          </h2>
          <p className="mt-2 text-sm text-gray-400 dark:text-white/35 max-w-sm leading-relaxed">
            Yapay zeka destekli beyanname oluşturma modülü geliştirme aşamasındadır.
            Yakında bu alandan beyannamelerinizi otomatik olarak hazırlayabileceksiniz.
          </p>
        </div>

        <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium bg-[#F57C28]/10 text-[#F57C28]">
          <span className="w-1.5 h-1.5 rounded-full bg-[#F57C28] animate-pulse" />
          Yakında Aktif
        </span>
      </div>
    </div>
  );
}
