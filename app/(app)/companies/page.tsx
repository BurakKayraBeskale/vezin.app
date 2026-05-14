import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import CompanyList from "@/components/CompanyList";

export default async function CompaniesPage() {
  const session = await getServerSession(authOptions);
  if (!session) redirect("/login");

  const { role, department } = session.user as any;

  const canView = role === "ADMIN" || department === "BAGIMSIZ_DENETIM";
  if (!canView) redirect("/");

  const canManage = role === "ADMIN" || (department === "BAGIMSIZ_DENETIM" && role === "MANAGER");
  const userId = (session.user as any).id as string;

  const [companies, allUsers] = await Promise.all([
    role === "EMPLOYEE" && department === "BAGIMSIZ_DENETIM"
      ? prisma.company.findMany({
          where: { assignments: { some: { userId } } },
          include: {
            assignments: {
              include: { user: { select: { id: true, name: true, email: true } } },
              orderBy: { assignedAt: "asc" },
            },
          },
          orderBy: { name: "asc" },
        })
      : prisma.company.findMany({
          include: {
            assignments: {
              include: { user: { select: { id: true, name: true, email: true } } },
              orderBy: { assignedAt: "asc" },
            },
          },
          orderBy: { name: "asc" },
        }),
    canManage
      ? prisma.user.findMany({
          where: { department: "BAGIMSIZ_DENETIM" },
          select: { id: true, name: true, email: true },
          orderBy: { name: "asc" },
        })
      : Promise.resolve([]),
  ]);

  return (
    <CompanyList
      initialCompanies={companies as any}
      users={allUsers}
      canManage={canManage}
      role={role}
    />
  );
}
