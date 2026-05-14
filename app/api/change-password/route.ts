import { NextRequest, NextResponse } from "next/server";
import { getToken } from "next-auth/jwt";
import { prisma } from "@/lib/prisma";
import bcrypt from "bcryptjs";

export async function PATCH(req: NextRequest) {
  const token = await getToken({ req, secret: process.env.NEXTAUTH_SECRET });
  if (!token) return NextResponse.json({ error: "Yetkisiz" }, { status: 401 });

  const { currentPassword, newPassword } = await req.json();
  if (!currentPassword || !newPassword) {
    return NextResponse.json({ error: "Tüm alanlar zorunlu" }, { status: 400 });
  }
  if (newPassword.length < 6) {
    return NextResponse.json({ error: "Yeni şifre en az 6 karakter olmalı" }, { status: 400 });
  }

  const user = await prisma.user.findUnique({ where: { id: token.id as string } });
  if (!user) return NextResponse.json({ error: "Kullanıcı bulunamadı" }, { status: 404 });

  const valid = await bcrypt.compare(currentPassword, user.password);
  if (!valid) return NextResponse.json({ error: "Mevcut şifre hatalı" }, { status: 400 });

  await prisma.user.update({
    where: { id: user.id },
    data: {
      password: await bcrypt.hash(newPassword, 10),
      mustChangePassword: false,
    },
  });

  return NextResponse.json({ ok: true });
}
