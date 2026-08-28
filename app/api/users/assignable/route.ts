/**
 * GET /api/users/assignable
 *
 * Mevcut kullanıcının atama yapabileceği kişileri döndürür.
 *
 * Kural: assigner.seniorityLevel > assignee.seniorityLevel (kesin büyük)
 * İstisna: canViewAllTasks || ADMIN → herkese atayabilir.
 *
 * UI bu endpoint'i kullanarak atanabilecekler listesini filtreler.
 * Sunucu da POST/PATCH /api/tasks sırasında bağımsız kontrol yapar.
 */
import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { HIDDEN_ACCOUNT_EMAILS } from "@/lib/hidden-accounts";

export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "Yetkisiz" }, { status: 401 });

  const userId = (session.user as any).id as string;

  const assigner = await prisma.user.findUnique({
    where: { id: userId },
    select: { seniorityLevel: true, canViewAllTasks: true, role: true },
  });
  if (!assigner) return NextResponse.json({ error: "Kullanıcı bulunamadı" }, { status: 404 });

  const canAssignAll = assigner.canViewAllTasks || assigner.role === "ADMIN";

  const users = await prisma.user.findMany({
    where: canAssignAll
      ? { email: { notIn: HIDDEN_ACCOUNT_EMAILS } }
      : {
          email: { notIn: HIDDEN_ACCOUNT_EMAILS },
          seniorityLevel: { lt: assigner.seniorityLevel },
        },
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
