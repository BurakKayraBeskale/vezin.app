/**
 * GET /api/users/assignable
 *
 * Mevcut kullanıcının atama yapabileceği kişileri döndürür.
 * Kural motoru: lib/task-assignment.ts → getEligibleAssignees (tek doğru kaynak).
 *
 * İsteğe bağlı sorgu parametreleri:
 *   ?projectId=<id>
 *   Projeli görev — yalnızca bu projenin aktif üyeleri döner.
 *
 *   ?projectDept=BAGIMSIZ_DENETIM | YMM | MUHASEBE | OUTSOURCE
 *   Projesiz görev — verilen proje departmanı kullanıcı departmanına çevrilip
 *   yalnızca o departmandaki kullanıcılar döner. projectId verilmişse yok sayılır.
 *
 *   ?departmentId=<user dept formatında departman>
 *   projectDept ile aynı işi görür, ancak zaten kullanıcı departman formatındadır
 *   (çeviri yapılmaz). projectId veya projectDept verilmişse yok sayılır.
 *
 *   ?purpose=member
 *   Proje üyelik yönetimi için: görev atama kuralları uygulanmaz, tüm aktif
 *   kullanıcılar listelenir (bu, getEligibleAssignees'in kapsamı dışındadır).
 *
 * UI bu endpoint'i kullanarak atanabilecekler listesini filtreler.
 * Sunucu da POST/PATCH /api/tasks sırasında bağımsız kontrol yapar (isEligibleAssignee).
 */
import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { HIDDEN_ACCOUNT_EMAILS } from "@/lib/hidden-accounts";
import { projectDeptToUserDept } from "@/lib/access";
import { getEligibleAssignees } from "@/lib/task-assignment";

export async function GET(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "Yetkisiz" }, { status: 401 });

  const userId = (session.user as any).id as string;

  const assigner = await prisma.user.findUnique({
    where: { id: userId },
    select: { seniorityLevel: true, canViewAllProjects: true, role: true, email: true },
  });
  if (!assigner) return NextResponse.json({ error: "Kullanıcı bulunamadı" }, { status: 404 });

  const searchParams = new URL(req.url).searchParams;
  const isMemberPurpose = searchParams.get("purpose") === "member";
  const projectId = searchParams.get("projectId");
  const projectDept = searchParams.get("projectDept");
  const rawDepartmentId = searchParams.get("departmentId");
  const departmentId = projectId
    ? null
    : (projectDept ? projectDeptToUserDept(projectDept) : rawDepartmentId);

  // purpose=member: proje üyelik yönetimi — görev atama kuralları (kıdem, canBeAssignedTasks,
  // proje üyeliği) uygulanmaz; yalnızca departman filtresi (verilmişse) geçerli kalır.
  if (isMemberPurpose) {
    const users = await prisma.user.findMany({
      where: {
        email: { notIn: HIDDEN_ACCOUNT_EMAILS },
        status: "ACTIVE",
        ...(departmentId ? { department: departmentId } : {}),
      },
      select: { id: true, name: true, email: true, department: true, title: true, seniorityLevel: true },
      orderBy: [{ seniorityLevel: "desc" }, { name: "asc" }],
    });
    return NextResponse.json(users);
  }

  const users = await getEligibleAssignees(
    { id: userId, role: assigner.role, seniorityLevel: assigner.seniorityLevel, canViewAllProjects: assigner.canViewAllProjects, email: assigner.email },
    { projectId: projectId || undefined, departmentId: departmentId || undefined }
  );

  return NextResponse.json(users);
}
