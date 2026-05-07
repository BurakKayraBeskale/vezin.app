import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import bcrypt from "bcryptjs";

const VALID_DEPARTMENTS = ["OUTSOURCE", "BAGIMSIZ_DENETIM", "MUHASEBE", "YEMINLI_MALI_MUSAVIR", "ADMIN"];

export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "Yetkisiz" }, { status: 401 });
  if (session.user.role !== "ADMIN") return NextResponse.json({ error: "Sadece admin" }, { status: 403 });

  const body = await req.json();
  const { name, email, password, role } = body;
  const data: Record<string, unknown> = {};

  if (name?.trim()) data.name = name.trim();
  if (email?.trim()) data.email = email.trim().toLowerCase();
  if (password) data.password = await bcrypt.hash(password, 10);
  if (role) data.role = role;
  if ("department" in body && body.department && VALID_DEPARTMENTS.includes(body.department)) {
    data.department = body.department;
  }

  const user = await prisma.user.update({
    where: { id: params.id },
    data,
    select: {
      id: true, name: true, email: true, role: true,
      department: true, createdAt: true,
    },
  });

  return NextResponse.json(user);
}

export async function DELETE(_: NextRequest, { params }: { params: { id: string } }) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "Yetkisiz" }, { status: 401 });
  if (session.user.role !== "ADMIN") return NextResponse.json({ error: "Sadece admin" }, { status: 403 });

  if (params.id === session.user.id) {
    return NextResponse.json({ error: "Kendi hesabınızı silemezsiniz" }, { status: 400 });
  }

  await prisma.user.delete({ where: { id: params.id } });
  return NextResponse.json({ ok: true });
}
