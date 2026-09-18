import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { redirect, notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { canAccessRotasyon } from "@/lib/access";
import { VARSAYILAN_ROTASYON_AYARLARI } from "@/lib/rotasyon";
import RotasyonClient from "@/components/rotasyon/RotasyonClient";

export const dynamic = "force-dynamic";

export default async function RotasyonPage() {
  const session = await getServerSession(authOptions);
  if (!session) redirect("/login");

  const user = session.user as any;

  // Erişim kontrolü — kıdem/departman/e-postadan ASLA türetilmez, yalnızca ADMIN
  // veya canAccessRotasyon=true. Yetkisiz erişimde 404 (403 değil) — proje kuralı.
  if (!canAccessRotasyon(user)) notFound();

  const [isletmeler, ayarRow] = await Promise.all([
    prisma.rotasyonIsletme.findMany({
      where: { deletedAt: null },
      include: {
        sozlesmeler: {
          include: { kadrolar: true },
          orderBy: { donem: "asc" },
        },
      },
      orderBy: { unvan: "asc" },
    }),
    prisma.rotasyonAyar.upsert({
      where: { id: "singleton" },
      update: {},
      create: { id: "singleton", ...VARSAYILAN_ROTASYON_AYARLARI },
    }),
  ]);

  return (
    <RotasyonClient
      initialIsletmeler={JSON.parse(JSON.stringify(isletmeler))}
      ayar={{
        cariDonem: ayarRow.cariDonem,
        azamiSure: ayarRow.azamiSure,
        zorunluAra: ayarRow.zorunluAra,
        uyariEsigi: ayarRow.uyariEsigi,
      }}
      isAdmin={user.role === "ADMIN"}
    />
  );
}
