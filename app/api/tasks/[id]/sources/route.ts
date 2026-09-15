/**
 * POST /api/tasks/[id]/sources — "Kaynaklar" bölümüne link ekler (TaskSource).
 *
 * Dosya türü kaynaklar için mevcut /api/tasks/[id]/files ucu kullanılır (File
 * modeli zaten retention/purge alanlarına sahip — bkz. D BLOĞU). Bu uç yalnızca
 * link (OneDrive/SharePoint vb.) kaynakları için TaskSource tablosuna yazar.
 *
 * Yetki: canManageTaskSource — görevin atananı kaynak ekleyemez.
 */
import { NextRequest, NextResponse } from "next/server";
import { getToken } from "next-auth/jwt";
import { prisma } from "@/lib/prisma";
import { buildTaskVisibilityWhereForUser } from "@/lib/task-visibility";
import { canManageTaskSource, WorkflowUser } from "@/lib/task-permissions";

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

  const task = await prisma.task.findFirst({
    where: { AND: [{ id: params.id }, buildTaskVisibilityWhereForUser(visUser) as any] },
    select: { id: true, assignedToId: true, reviewOwnerId: true },
  });
  if (!task) return NextResponse.json({ error: "Görev bulunamadı" }, { status: 404 });

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

  const body = await req.json();
  const name = (body.name as string | undefined)?.trim();
  const rawUrl = (body.url as string | undefined)?.trim();
  const description = (body.description as string | undefined)?.trim() || null;

  if (!name) return NextResponse.json({ error: "Ad zorunludur" }, { status: 400 });
  if (!rawUrl) return NextResponse.json({ error: "URL zorunludur" }, { status: 400 });

  let parsedUrl: URL;
  try {
    parsedUrl = new URL(rawUrl);
  } catch {
    return NextResponse.json({ error: "Geçersiz URL" }, { status: 400 });
  }
  if (parsedUrl.protocol !== "http:" && parsedUrl.protocol !== "https:") {
    return NextResponse.json({ error: "Yalnızca http(s) linkleri desteklenir" }, { status: 400 });
  }

  const source = await prisma.taskSource.create({
    data: {
      taskId: params.id,
      type: "LINK",
      name,
      url: rawUrl,
      description,
      addedById: token.id as string,
    },
    include: { addedBy: { select: { id: true, name: true } } },
  });

  return NextResponse.json(source, { status: 201 });
}
