/**
 * Görev görünürlüğü yardımcısı.
 * Kullanıcının rolüne göre Prisma task.findMany where nesnesi döndürür.
 *
 * ADMIN    → {} (tüm görevler)
 * MANAGER  → kendi departmanındaki kullanıcılara atanmış görevler
 * EMPLOYEE → yalnızca kendisinin atandığı / oluşturduğu / TaskAssignee'de olduğu görevler
 */

import { prisma } from "@/lib/prisma";

export async function getVisibleTaskFilter(user: {
  id: string;
  role: string;
  department: string;
}): Promise<object> {
  if (user.role === "ADMIN") return {};

  if (user.role === "MANAGER") {
    const deptUsers = await prisma.user.findMany({
      where: { department: user.department },
      select: { id: true },
    });
    const deptIds = deptUsers.map((u) => u.id);
    return {
      OR: [
        { assignedToId: { in: deptIds } },
        { createdById: user.id },
        { assignees: { some: { userId: { in: deptIds } } } },
      ],
    };
  }

  // EMPLOYEE
  return {
    OR: [
      { assignedToId: user.id },
      { createdById: user.id },
      { assignees: { some: { userId: user.id } } },
    ],
  };
}
