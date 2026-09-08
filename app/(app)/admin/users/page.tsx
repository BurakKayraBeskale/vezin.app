import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import UsersPageClient from "./UsersPageClient";

export const dynamic = "force-dynamic";

export default async function UsersPage() {
  const session = await getServerSession(authOptions);
  if (session?.user.role !== "ADMIN") redirect("/");

  const users = await prisma.user.findMany({
    select: {
      id: true,
      name: true,
      email: true,
      role: true,
      department: true,
      title: true,
      seniorityLevel: true,
      status: true,
      createdAt: true,
    },
    orderBy: { createdAt: "asc" },
  });

  const mapped = users.map((u) => ({
    id: u.id,
    name: u.name,
    email: u.email,
    role: u.role as "ADMIN" | "EMPLOYEE",
    department: u.department,
    title: u.title,
    seniorityLevel: u.seniorityLevel,
    status: u.status,
    createdAt: u.createdAt.toISOString(),
  }));

  const activeCount = mapped.filter((u) => u.status === "ACTIVE").length;
  const adminCount = mapped.filter((u) => u.role === "ADMIN").length;

  return (
    <div className="max-w-6xl mx-auto">
      <div className="mb-6">
        <h1 className="text-xl sm:text-2xl font-bold text-gray-800 dark:text-gray-100">Kullanıcı Yönetimi</h1>
        <p className="text-sm text-gray-400 mt-1">
          {activeCount} aktif kullanıcı · {adminCount} admin
        </p>
      </div>

      <UsersPageClient
        initialUsers={mapped}
        currentUserId={session!.user.id}
      />
    </div>
  );
}
