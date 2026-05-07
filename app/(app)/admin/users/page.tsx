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
      createdAt: true,
      _count: { select: { assignedTasks: true } },
      manages: { select: { subordinateId: true, relationType: true } },
    },
    orderBy: { createdAt: "asc" },
  });

  const mapped = users.map((u) => ({
    id: u.id,
    name: u.name,
    email: u.email,
    role: u.role as "ADMIN" | "MANAGER" | "EMPLOYEE",
    department: u.department,
    createdAt: u.createdAt.toISOString(),
    taskCount: u._count.assignedTasks,
    // OrgChart: sadece SUBORDINATE tipi
    subordinateIds: u.manages.filter((r) => r.relationType === "SUBORDINATE").map((r) => r.subordinateId),
    // UserTable RelationsEditor: tüm ilişkiler
    relations: u.manages.map((r) => ({ userId: r.subordinateId, relationType: r.relationType })),
  }));

  return (
    <div className="max-w-6xl mx-auto">
      <div className="mb-6">
        <h1 className="text-xl sm:text-2xl font-bold text-gray-800">Kullanıcı Yönetimi</h1>
        <p className="text-sm text-gray-400 mt-1">
          {users.length} kullanıcı · {users.filter((u) => u.role === "ADMIN").length} admin
        </p>
      </div>

      <UsersPageClient
        initialUsers={mapped}
        currentUserId={session!.user.id}
      />
    </div>
  );
}
