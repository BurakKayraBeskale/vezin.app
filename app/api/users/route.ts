import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import bcrypt from "bcryptjs";
import { HIDDEN_ACCOUNT_EMAILS } from "@/lib/hidden-accounts";
import { TITLE_TO_SENIORITY } from "@/lib/access";

const VALID_DEPARTMENTS = ["OUTSOURCE", "BAGIMSIZ_DENETIM", "MUHASEBE", "YEMINLI_MALI_MUSAVIR"];

export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "Yetkisiz" }, { status: 401 });
  if (session.user.role !== "ADMIN") return NextResponse.json({ error: "Sadece admin" }, { status: 403 });

  const users = await prisma.user.findMany({
    where: { email: { notIn: HIDDEN_ACCOUNT_EMAILS } },
    select: {
      id: true, name: true, email: true, role: true,
      department: true, title: true, seniorityLevel: true,
      status: true, createdAt: true,
    },
    orderBy: { createdAt: "asc" },
  });

  return NextResponse.json(users);
}

export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "Yetkisiz" }, { status: 401 });
  if (session.user.role !== "ADMIN") return NextResponse.json({ error: "Sadece admin" }, { status: 403 });

  const { name, email, password, role, department, title } = await req.json();
  if (!name?.trim() || !email?.trim() || !password) {
    return NextResponse.json({ error: "İsim, e-posta ve şifre zorunlu" }, { status: 400 });
  }

  const exists = await prisma.user.findUnique({ where: { email } });
  if (exists) return NextResponse.json({ error: "Bu e-posta zaten kayıtlı" }, { status: 409 });

  const userRole = role === "ADMIN" ? "ADMIN" : "EMPLOYEE";

  // Admin kullanıcının departmanı "ADMIN" olur; diğerleri için doğrulama yap
  let dept: string;
  if (userRole === "ADMIN") {
    dept = "ADMIN";
  } else {
    dept = department && VALID_DEPARTMENTS.includes(department) ? department : "OUTSOURCE";
  }

  // Unvandan kıdem seviyesi türet; Admin için Partner (14)
  const userTitle = userRole === "ADMIN" ? "Partner" : (title || "");
  const seniorityLevel = TITLE_TO_SENIORITY[userTitle] ?? 0;

  const user = await prisma.user.create({
    data: {
      name: name.trim(),
      email: email.trim().toLowerCase(),
      password: await bcrypt.hash(password, 10),
      role: userRole,
      department: dept,
      title: userTitle,
      seniorityLevel,
      mustChangePassword: true,
      status: "ACTIVE",
    },
    select: {
      id: true, name: true, email: true, role: true,
      department: true, title: true, seniorityLevel: true,
      status: true, createdAt: true,
    },
  });

  return NextResponse.json(user, { status: 201 });
}
