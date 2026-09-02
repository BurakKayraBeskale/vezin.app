/**
 * GET /api/users/assignable
 *
 * Mevcut kullanıcının atama yapabileceği kişileri döndürür.
 *
 * Kural: assigner.seniorityLevel > assignee.seniorityLevel (kesin büyük)
 * İstisna: canViewAllTasks || ADMIN → herkese atayabilir.
 *
 * İsteğe bağlı sorgu parametresi:
 *   ?projectDept=BAGIMSIZ_DENETIM | VERGI
 *   Verildiğinde Prisma WHERE'e departman filtresi eklenir (server-side).
 *   ADMIN/MUHASEBE/IDARI_ISLER/OUTSOURCE kadroları bu filtre kapsamında hiç dönmez.
 *
 * UI bu endpoint'i kullanarak atanabilecekler listesini filtreler.
 * Sunucu da POST/PATCH /api/tasks sırasında bağımsız kontrol yapar.
 */
import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { HIDDEN_ACCOUNT_EMAILS } from "@/lib/hidden-accounts";
import { projectDeptToUserDept } from "@/lib/access";

export async function GET(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "Yetkisiz" }, { status: 401 });

  const userId = (session.user as any).id as string;

  const assigner = await prisma.user.findUnique({
    where: { id: userId },
    select: { seniorityLevel: true, canViewAllTasks: true, role: true },
  });
  if (!assigner) return NextResponse.json({ error: "Kullanıcı bulunamadı" }, { status: 404 });

  const canAssignAll = assigner.canViewAllTasks || assigner.role === "ADMIN";

  // İsteğe bağlı proje departman filtresi
  const projectDept = new URL(req.url).searchParams.get("projectDept");
  const userDeptFilter = projectDept ? projectDeptToUserDept(projectDept) : null;

  const where: Record<string, unknown> = {
    email: { notIn: HIDDEN_ACCOUNT_EMAILS },
    ...(!canAssignAll && { seniorityLevel: { lt: assigner.seniorityLevel } }),
    // Departman filtresi verilmişse Prisma WHERE'e eklenir (server-side)
    ...(userDeptFilter !== null && { department: userDeptFilter }),
  };

  const users = await prisma.user.findMany({
    where,
    select: {
      id: true,
      name: true,
      email: true,
      department: true,
      title: true,
      seniorityLevel: true,
    },
    orderBy: [{ seniorityLevel: "desc" }, { name: "asc" }],
  });

  return NextResponse.json(users);
}
