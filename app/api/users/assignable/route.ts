/**
 * GET /api/users/assignable
 *
 * Mevcut kullanıcının atama yapabileceği kişileri döndürür.
 *
 * Kural: assigner.seniorityLevel > assignee.seniorityLevel (kesin büyük)
 * İstisna: canViewAllTasks || ADMIN → herkese atayabilir.
 *
 * İsteğe bağlı sorgu parametresi:
 *   ?projectDept=BAGIMSIZ_DENETIM | YMM | MUHASEBE | OUTSOURCE
 *   Verildiğinde Prisma WHERE'e departman filtresi eklenir (server-side).
 *
 *   ?purpose=member
 *   Proje üyelik yönetimi için: kıdem kısıtı uygulanmaz, tüm aktif kullanıcılar listelenir.
 *
 * UI bu endpoint'i kullanarak atanabilecekler listesini filtreler.
 * Sunucu da POST/PATCH /api/tasks sırasında bağımsız kontrol yapar.
 */
import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { HIDDEN_ACCOUNT_EMAILS } from "@/lib/hidden-accounts";
import { projectDeptToUserDept, ASSIGN_EXCEPTIONS } from "@/lib/access";

export async function GET(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "Yetkisiz" }, { status: 401 });

  const userId = (session.user as any).id as string;

  const assigner = await prisma.user.findUnique({
    where: { id: userId },
    select: { seniorityLevel: true, canViewAllTasks: true, role: true, email: true },
  });
  if (!assigner) return NextResponse.json({ error: "Kullanıcı bulunamadı" }, { status: 404 });

  const canAssignAll = assigner.canViewAllTasks || assigner.role === "ADMIN";

  const searchParams = new URL(req.url).searchParams;
  // İsteğe bağlı proje departman filtresi
  const projectDept = searchParams.get("projectDept");
  const userDeptFilter = projectDept ? projectDeptToUserDept(projectDept) : null;
  // purpose=member → proje üyelik yönetimi için kıdem kısıtı kaldırılır
  const isMemberPurpose = searchParams.get("purpose") === "member";

  const userSelect = {
    id: true,
    name: true,
    email: true,
    department: true,
    title: true,
    seniorityLevel: true,
  } as const;

  const applySenitoryFilter = !canAssignAll && !isMemberPurpose;
  const where: Record<string, unknown> = {
    email: { notIn: HIDDEN_ACCOUNT_EMAILS },
    status: "ACTIVE",
    ...(isMemberPurpose ? {} : { canBeAssignedTasks: true }),
    ...(applySenitoryFilter && { seniorityLevel: { lt: assigner.seniorityLevel } }),
    // Departman filtresi verilmişse Prisma WHERE'e eklenir (server-side)
    ...(userDeptFilter !== null && { department: userDeptFilter }),
  };

  const users = await prisma.user.findMany({
    where,
    select: userSelect,
    orderBy: [{ seniorityLevel: "desc" }, { name: "asc" }],
  });

  // ASSIGN_EXCEPTIONS: atayan için tanımlı istisna kullanıcıları ekle
  // (canBeAssignedTasks=false olsalar bile listeye dahil edilir)
  const assignerEmail = assigner.email?.toLowerCase() ?? "";
  const exceptionEmails = ASSIGN_EXCEPTIONS[assignerEmail] ?? [];
  if (exceptionEmails.length > 0) {
    const exceptionWhere: Record<string, unknown> = {
      email: { in: exceptionEmails },
      ...(userDeptFilter !== null && { department: userDeptFilter }),
    };
    const exceptionUsers = await prisma.user.findMany({
      where: exceptionWhere,
      select: userSelect,
    });
    const existingIds = new Set(users.map((u) => u.id));
    for (const eu of exceptionUsers) {
      if (!existingIds.has(eu.id)) users.push(eu);
    }
    users.sort(
      (a, b) => b.seniorityLevel - a.seniorityLevel || a.name.localeCompare(b.name, "tr")
    );
  }

  return NextResponse.json(users);
}
