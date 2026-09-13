import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import bcrypt from "bcryptjs";
import { HIDDEN_ACCOUNT_EMAILS } from "@/lib/hidden-accounts";
import { TITLE_TO_SENIORITY } from "@/lib/access";

const VALID_DEPARTMENTS = ["OUTSOURCE", "BAGIMSIZ_DENETIM", "MUHASEBE", "YEMINLI_MALI_MUSAVIR"];

export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "Yetkisiz" }, { status: 401 });
  if (session.user.role !== "ADMIN") return NextResponse.json({ error: "Sadece admin" }, { status: 403 });

  const target = await prisma.user.findUnique({ where: { id: params.id }, select: { email: true, role: true } });
  if (!target) return NextResponse.json({ error: "Kullanıcı bulunamadı" }, { status: 404 });
  if (HIDDEN_ACCOUNT_EMAILS.includes(target.email)) {
    return NextResponse.json({ error: "Bu kullanıcı değiştirilemez" }, { status: 403 });
  }

  const body = await req.json();
  const { name, email, password, role, department, title, status } = body;
  const data: Record<string, unknown> = {};

  if (name?.trim()) data.name = name.trim();
  if (email?.trim()) data.email = email.trim().toLowerCase();
  if (password) data.password = await bcrypt.hash(password, 10);

  if (role !== undefined) {
    const newRole = role === "ADMIN" ? "ADMIN" : "EMPLOYEE";
    data.role = newRole;
    // Admin kullanıcının departmanını zorla
    if (newRole === "ADMIN") data.department = "ADMIN";
  }

  if ("department" in body && body.department) {
    const targetRole = (data.role as string) ?? target.role;
    if (targetRole !== "ADMIN" && VALID_DEPARTMENTS.includes(body.department)) {
      data.department = body.department;
    }
  }

  if (title !== undefined) {
    const newTitle = (data.role === "ADMIN") ? "Partner" : title;
    data.title = newTitle;
    data.seniorityLevel = TITLE_TO_SENIORITY[newTitle] ?? 0;
  }

  if (status !== undefined) {
    const validStatuses = ["ACTIVE", "INACTIVE", "DELETED"];
    if (validStatuses.includes(status)) {
      // D BLOĞU: Pasife almadan önce tamamlanmamış görev kontrolü
      if (status === "INACTIVE" || status === "DELETED") {
        const openTaskCount = await prisma.task.count({
          where: {
            assignedToId: params.id,
            status: { in: ["TODO", "IN_PROGRESS", "REVIEW"] },
            deletedAt: null,
          },
        });
        if (openTaskCount > 0) {
          return NextResponse.json(
            {
              error: `Bu kullanıcının üzerinde ${openTaskCount} tamamlanmamış görev bulunmaktadır. Kullanıcıyı pasife almadan önce görevleri başka kullanıcılara devredin veya tamamlayın.`,
            },
            { status: 409 }
          );
        }
      }
      data.status = status;
      // Pasif yapılan kullanıcılara görev atanamaz
      if (status === "INACTIVE" || status === "DELETED") {
        data.canBeAssignedTasks = false;
      } else if (status === "ACTIVE") {
        data.canBeAssignedTasks = true;
      }
    }
  }

  const user = await prisma.user.update({
    where: { id: params.id },
    data,
    select: {
      id: true, name: true, email: true, role: true,
      department: true, title: true, seniorityLevel: true,
      status: true, createdAt: true,
    },
  });

  return NextResponse.json(user);
}

export async function DELETE(_: NextRequest, { params }: { params: { id: string } }) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "Yetkisiz" }, { status: 401 });
  if (session.user.role !== "ADMIN") return NextResponse.json({ error: "Sadece admin" }, { status: 403 });

  if (params.id === (session.user as any).id) {
    return NextResponse.json({ error: "Kendi hesabınızı silemezsiniz" }, { status: 400 });
  }

  const delTarget = await prisma.user.findUnique({ where: { id: params.id }, select: { email: true } });
  if (!delTarget) return NextResponse.json({ error: "Kullanıcı bulunamadı" }, { status: 404 });
  if (HIDDEN_ACCOUNT_EMAILS.includes(delTarget.email)) {
    return NextResponse.json({ error: "Bu kullanıcı silinemez" }, { status: 403 });
  }

  // Bağımlılık kontrolü — herhangi bir kayıt varsa soft delete
  const [assignedCount, createdCount, assigneeCount, projectCount, leaveCount] = await Promise.all([
    prisma.task.count({ where: { assignedToId: params.id } }),
    prisma.task.count({ where: { createdById: params.id } }),
    prisma.taskAssignee.count({ where: { userId: params.id } }),
    prisma.project.count({ where: { createdById: params.id } }),
    prisma.leaveRequest.count({ where: { userId: params.id } }),
  ]);

  const hasDependencies = assignedCount + createdCount + assigneeCount + projectCount + leaveCount > 0;

  if (hasDependencies) {
    // Soft delete — geçmiş verileri koru
    await prisma.user.update({
      where: { id: params.id },
      data: { status: "DELETED", canBeAssignedTasks: false },
    });
    return NextResponse.json({ ok: true, soft: true });
  } else {
    // Hard delete — bağımlılık yok
    await prisma.user.delete({ where: { id: params.id } });
    return NextResponse.json({ ok: true, soft: false });
  }
}
