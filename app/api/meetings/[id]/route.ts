import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { BYPASS_AUTH_ROLES } from "@/lib/auth-bypass";

export async function GET(
  _req: NextRequest,
  { params }: { params: { id: string } }
) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "Yetkisiz" }, { status: 401 });

  const meeting = await (prisma as any).meeting.findUnique({
    where: { id: params.id },
    include: {
      createdBy: { select: { id: true, name: true, email: true } },
      attendees: {
        include: {
          user: { select: { id: true, name: true, email: true, department: true } },
        },
        orderBy: { user: { name: "asc" } },
      },
    },
  });

  if (!meeting) {
    return NextResponse.json({ error: "Toplantı bulunamadı" }, { status: 404 });
  }

  return NextResponse.json(meeting);
}

export async function DELETE(
  _req: NextRequest,
  { params }: { params: { id: string } }
) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "Yetkisiz" }, { status: 401 });

  const role = (session.user as any).role as string;
  if (role !== "ADMIN" && role !== "MANAGER") {
    return NextResponse.json({ error: "Sadece yönetici veya admin silebilir" }, { status: 403 });
  }

  try {
    await (prisma as any).meeting.delete({ where: { id: params.id } });
    return NextResponse.json({ ok: true });
  } catch (err: any) {
    console.error("[meetings DELETE]", err);
    return NextResponse.json({ error: "Toplantı silinemedi" }, { status: 500 });
  }
}
