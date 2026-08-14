import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { redirect } from "next/navigation";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import CompanyList from "@/components/CompanyList";
import { canAccessCompanies } from "@/lib/access";

export default async function CompaniesPage() {
  const session = await getServerSession(authOptions);
  if (!session) redirect("/login");

  const user = session.user as any;

  if (!canAccessCompanies(user)) notFound();

  const [companies, allUsers] = await Promise.all([
    prisma.company.findMany({
      include: {
        assignments: {
          include: { user: { select: { id: true, name: true, email: true } } },
          orderBy: { assignedAt: "asc" },
        },
      },
      orderBy: { name: "asc" },
    }),
    prisma.user.findMany({
      where: { department: "BAGIMSIZ_DENETIM" },
      select: { id: true, name: true, email: true },
      orderBy: { name: "asc" },
    }),
  ]);

  return (
    <CompanyList
      initialCompanies={companies as any}
      users={allUsers}
      canManage={true}
      role={user.role}
    />
  );
}
