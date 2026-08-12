import { NextRequest, NextResponse } from "next/server";
import { getToken } from "next-auth/jwt";
import { prisma } from "@/lib/prisma";

export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  const token = await getToken({ req, secret: process.env.NEXTAUTH_SECRET });
  if (!token) return NextResponse.json({ error: "Yetkisiz" }, { status: 401 });

  const userId = token.id as string;
  const userRole = (token as any).role as string;
  const canViewAllProjects = (token as any).canViewAllProjects as boolean ?? false;

  const project = await prisma.project.findUnique({
    where: { id: params.id },
    select: { id: true, createdById: true },
  });
  if (!project) return NextResponse.json({ error: "Proje bulunamadı" }, { status: 404 });

  // Üye yönetimi: kurucu, gözetmen, admin veya canViewAllProjects
  const overseesDepartment = (token as any).overseesDepartment as string | null ?? null;
  const canManage =
    userRole === "ADMIN" ||
    canViewAllProjects ||
    overseesDepartment != null ||
    project.createdById === userId;
  if (!canManage) return NextResponse.json({ error: "Üye yönetimi yetkiniz yok" }, { status: 403 });

  const body = await req.json();
  const addUserIds: string[] = Array.isArray(body.addUserIds) ? body.addUserIds.filter(Boolean) : [];
  const removeUserIds: string[] = Array.isArray(body.removeUserIds) ? body.removeUserIds.filter(Boolean) : [];

  // Ekleme: kıdem kontrolü
  if (addUserIds.length > 0) {
    const assigner = await prisma.user.findUnique({
      where: { id: userId },
      select: { seniorityLevel: true, canViewAllProjects: true, role: true },
    });
    const assignerCanAll = assigner ? (assigner.canViewAllProjects || assigner.role === "ADMIN") : false;
    if (!assignerCanAll && assigner) {
      for (const mid of addUserIds) {
        if (mid === userId) continue;
        const member = await prisma.user.findUnique({ where: { id: mid }, select: { seniorityLevel: true } });
        if (member && !(assigner.seniorityLevel > member.seniorityLevel)) {
          return NextResponse.json(
            { error: "Sadece kendinizden düşük kıdemlilere üye ekleyebilirsiniz" },
            { status: 403 }
          );
        }
      }
    }

    // SQLite: skipDuplicates desteklenmez — mevcut üyeleri filtrele
    const existing = await prisma.projectMember.findMany({
      where: { projectId: params.id, userId: { in: addUserIds } },
      select: { userId: true },
    });
    const existingSet = new Set(existing.map((e) => e.userId));
    const toAdd = addUserIds.filter((uid) => !existingSet.has(uid));
    if (toAdd.length > 0) {
      await prisma.projectMember.createMany({
        data: toAdd.map((uid) => ({ projectId: params.id, userId: uid, assignedBy: userId })),
      });
    }
  }

  if (removeUserIds.length > 0) {
    await prisma.projectMember.deleteMany({
      where: { projectId: params.id, userId: { in: removeUserIds } },
    });
  }

  const updated = await prisma.project.findUnique({
    where: { id: params.id },
    include: {
      members: {
        include: { user: { select: { id: true, name: true, email: true, seniorityLevel: true, title: true } } },
        orderBy: { assignedAt: "asc" },
      },
    },
  });
  return NextResponse.json(updated);
}
