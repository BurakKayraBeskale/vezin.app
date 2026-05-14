import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import bcrypt from "bcryptjs";

const VALID_DEPARTMENTS = ["OUTSOURCE", "BAGIMSIZ_DENETIM", "MUHASEBE", "YEMINLI_MALI_MUSAVIR", "ADMIN"];

export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "Yetkisiz" }, { status: 401 });
  if (session.user.role !== "ADMIN") return NextResponse.json({ error: "Sadece admin" }, { status: 403 });

  const users = await prisma.user.findMany({
    select: { id: true, name: true, email: true, role: true, department: true, createdAt: true },
    orderBy: { createdAt: "asc" },
  });

  return NextResponse.json(users);
}

export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "Yetkisiz" }, { status: 401 });
  if (session.user.role !== "ADMIN") return NextResponse.json({ error: "Sadece admin" }, { status: 403 });

  const { name, email, password, role, department } = await req.json();
  if (!name?.trim() || !email?.trim() || !password) {
    return NextResponse.json({ error: "İsim, e-posta ve şifre zorunlu" }, { status: 400 });
  }

  const exists = await prisma.user.findUnique({ where: { email } });
  if (exists) return NextResponse.json({ error: "Bu e-posta zaten kayıtlı" }, { status: 409 });

  const dept = department && VALID_DEPARTMENTS.includes(department) ? department : "OUTSOURCE";

  const user = await prisma.user.create({
    data: {
      name: name.trim(),
      email: email.trim().toLowerCase(),
      password: await bcrypt.hash(password, 10),
      role: role || "EMPLOYEE",
      department: dept,
      mustChangePassword: true,
    },
    select: { id: true, name: true, email: true, role: true, department: true, createdAt: true },
  });

  return NextResponse.json(user, { status: 201 });
}
