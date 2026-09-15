import { NextRequest, NextResponse } from "next/server";
import { getToken } from "next-auth/jwt";
import { prisma } from "@/lib/prisma";
import { buildTaskVisibilityWhereForUser } from "@/lib/task-visibility";
import { canManageTaskSource, WorkflowUser } from "@/lib/task-permissions";
import { writeFile, mkdir } from "fs/promises";
import path from "path";

export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  const token = await getToken({ req, secret: process.env.NEXTAUTH_SECRET });
  if (!token) return NextResponse.json({ error: "Yetkisiz" }, { status: 401 });

  const visUser = {
    id: token.id as string,
    role: (token as any).role as string,
    canViewAllProjects: ((token as any).canViewAllProjects as boolean) ?? false,
    overseesDepartment: ((token as any).overseesDepartment as string | null) ?? null,
    department: ((token as any).department as string) ?? "",
    seniorityLevel: ((token as any).seniorityLevel as number) ?? 0,
  };

  const taskWhere = buildTaskVisibilityWhereForUser(visUser);
  const task = await prisma.task.findFirst({
    where: { AND: [{ id: params.id }, taskWhere as any] },
    select: { id: true, assignedToId: true, reviewOwnerId: true },
  });
  if (!task) return NextResponse.json({ error: "Görev bulunamadı" }, { status: 404 });

  // Görevin atananı kaynak/dosya ekleyemez — yalnızca reviewOwner/yönetici/Senior Manager+
  const wfUser: WorkflowUser = {
    id: visUser.id,
    role: visUser.role,
    seniorityLevel: visUser.seniorityLevel,
    canViewAllProjects: visUser.canViewAllProjects,
    overseesDepartment: visUser.overseesDepartment,
    department: visUser.department,
  };
  if (!canManageTaskSource(wfUser, task)) {
    return NextResponse.json({ error: "Kaynak ekleme yetkiniz yok" }, { status: 403 });
  }

  const formData = await req.formData();
  const file = formData.get("file") as File | null;
  if (!file) return NextResponse.json({ error: "Dosya bulunamadı" }, { status: 400 });
  const comment = (formData.get("comment") as string | null) || null;

  const bytes = await file.arrayBuffer();
  const buffer = Buffer.from(bytes);

  const uploadsDir = path.join(process.cwd(), "uploads");
  await mkdir(uploadsDir, { recursive: true });

  const uniqueName = `${Date.now()}_${file.name.replace(/[^a-zA-Z0-9._-]/g, "_")}`;
  await writeFile(path.join(uploadsDir, uniqueName), buffer);

  const record = await prisma.file.create({
    data: {
      taskId: params.id,
      uploadedById: token.id as string,
      filename: file.name,
      path: uniqueName,
      comment: comment?.trim() || null,
    },
    include: { uploadedBy: { select: { id: true, name: true } } },
  });

  return NextResponse.json(record, { status: 201 });
}
